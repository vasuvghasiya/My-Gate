const express = require('express');
const { verifyToken, requireRole, canAccessHousehold } = require('../middleware/auth');
const { getDb } = require('../config/firebase');
const { sendNotification } = require('../services/notifications');
const { logAuditEvent } = require('../services/audit');
const Joi = require('joi');

const router = express.Router();
// Access db lazily to ensure initialization and avoid stale references
const db = getDb();

// Visitor status enum
const VISITOR_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  DENIED: 'denied',
  CHECKED_IN: 'checked_in',
  CHECKED_OUT: 'checked_out'
};

// Schema for visitor creation
const createVisitorSchema = Joi.object({
  name: Joi.string().required(),
  phone: Joi.string().required(),
  purpose: Joi.string().required(),
  scheduledTime: Joi.date().optional(),
  notes: Joi.string().optional()
});

// Schema for visitor update
const updateVisitorSchema = Joi.object({
  status: Joi.string().valid(...Object.values(VISITOR_STATUS)).required(),
  reason: Joi.string().optional()
});

// Create visitor (resident only)
router.post('/', verifyToken, requireRole(['resident', 'admin']), async (req, res) => {
  try {
    const { error, value } = createVisitorSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.user.uid;
    
    // Get user's household ID
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    const householdId = userData.householdId;
    const userRoles = Array.isArray(userData.roles) ? userData.roles : [];

    if (!userRoles.includes('resident') && !userRoles.includes('admin')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    if (!householdId && !userRoles.includes('admin')) {
      return res.status(400).json({ error: 'User has no household assigned' });
    }

    // Create visitor document
    const visitorData = {
      ...value,
      hostHouseholdId: householdId,
      hostUserId: userId,
      status: VISITOR_STATUS.PENDING,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const visitorRef = await db.collection('visitors').add(visitorData);
    const visitorId = visitorRef.id;

    // Log audit event
    await logAuditEvent({
      type: 'visitor_created',
      actorUserId: userId,
      subjectId: visitorId,
      payload: { ...visitorData, id: visitorId }
    });

    // Send notification to household members
    console.log('🔔 Sending visitor creation notification...');
    try {
      const notificationResult = await sendNotification({
        type: 'visitor_created',
        householdId: householdId,
        createdBy: userData.displayName || req.user.email,
        data: {
          visitorId,
          visitorName: value.name,
          purpose: value.purpose
        }
      });
      console.log('🔔 Notification result:', notificationResult);
    } catch (notificationError) {
      console.error('❌ Failed to send visitor notification:', notificationError);
    }

    res.status(201).json({
      message: 'Visitor created successfully',
      visitor: {
        id: visitorId,
        ...visitorData
      }
    });
  } catch (error) {
    console.error('Error creating visitor:', error);
    res.status(500).json({ error: 'Failed to create visitor' });
  }
});

// Get visitors (role-based filtering)
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    const userRoles = userData.roles || [];

    let query = db.collection('visitors');

    // Role-based filtering
    if (userRoles.includes('admin') || userRoles.includes('guard')) {
      // Admins/guards can see all visitors, apply sort
      query = query.orderBy('createdAt', 'desc');
    } else if (userRoles.includes('resident')) {
      // Residents can only see visitors for their household
      if (!userData.householdId) {
        return res.json({ visitors: [] });
      }
      query = query.where('hostHouseholdId', '==', userData.householdId);
      // Avoid composite index requirement by skipping orderBy when filtering by household
    } else {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Status filtering
    if (req.query.status) {
      query = query.where('status', '==', req.query.status);
    }

    // Limit results
    const limit = parseInt(req.query.limit) || 50;
    query = query.limit(limit);

    const snapshot = await query.get();
    const visitors = [];

    snapshot.forEach(doc => {
      visitors.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({ visitors });
  } catch (error) {
    console.error('Error fetching visitors:', error);
    res.status(500).json({ error: 'Failed to fetch visitors' });
  }
});

// Get specific visitor
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const visitorId = req.params.id;
    const userId = req.user.uid;
    
    const visitorDoc = await db.collection('visitors').doc(visitorId).get();
    
    if (!visitorDoc.exists) {
      return res.status(404).json({ error: 'Visitor not found' });
    }

    const visitorData = visitorDoc.data();
    
    // Check if user can access this visitor
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userRoles = userData.roles || [];

    if (!userRoles.includes('admin') && 
        !userRoles.includes('guard') && 
        visitorData.hostHouseholdId !== userData.householdId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      id: visitorId,
      ...visitorData
    });
  } catch (error) {
    console.error('Error fetching visitor:', error);
    res.status(500).json({ error: 'Failed to fetch visitor' });
  }
});

// Approve visitor
router.put('/:id/approve', verifyToken, requireRole(['resident', 'admin']), async (req, res) => {
  try {
    const visitorId = req.params.id;
    const userId = req.user.uid;
    
    const visitorDoc = await db.collection('visitors').doc(visitorId).get();
    
    if (!visitorDoc.exists) {
      return res.status(404).json({ error: 'Visitor not found' });
    }

    const visitorData = visitorDoc.data();
    
    // Check if visitor is in pending status
    if (visitorData.status !== VISITOR_STATUS.PENDING) {
      return res.status(400).json({ error: 'Visitor is not in pending status' });
    }

    // Check if user can approve this visitor
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userRoles = userData.roles || [];

    if (!userRoles.includes('admin') && visitorData.hostHouseholdId !== userData.householdId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update visitor status
    const updateData = {
      status: VISITOR_STATUS.APPROVED,
      approvedBy: userId,
      approvedAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection('visitors').doc(visitorId).update(updateData);

    // Log audit event
    await logAuditEvent({
      type: 'visitor_approved',
      actorUserId: userId,
      subjectId: visitorId,
      payload: { ...updateData }
    });

    // Send notifications
    await sendNotification({
      type: 'visitor_approved',
      householdId: visitorData.hostHouseholdId,
      data: {
        visitorId,
        visitorName: visitorData.name,
        approvedBy: userData.displayName
      }
    });

    res.json({
      message: 'Visitor approved successfully',
      visitor: {
        id: visitorId,
        ...visitorData,
        ...updateData
      }
    });
  } catch (error) {
    console.error('Error approving visitor:', error);
    res.status(500).json({ error: 'Failed to approve visitor' });
  }
});

// Deny visitor
router.put('/:id/deny', verifyToken, requireRole(['resident', 'admin']), async (req, res) => {
  try {
    const visitorId = req.params.id;
    const userId = req.user.uid;
    const { reason } = req.body;
    
    const visitorDoc = await db.collection('visitors').doc(visitorId).get();
    
    if (!visitorDoc.exists) {
      return res.status(404).json({ error: 'Visitor not found' });
    }

    const visitorData = visitorDoc.data();
    
    // Check if visitor is in pending status
    if (visitorData.status !== VISITOR_STATUS.PENDING) {
      return res.status(400).json({ error: 'Visitor is not in pending status' });
    }

    // Check if user can deny this visitor
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userRoles = userData.roles || [];

    if (!userRoles.includes('admin') && visitorData.hostHouseholdId !== userData.householdId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update visitor status
    const updateData = {
      status: VISITOR_STATUS.DENIED,
      deniedBy: userId,
      deniedAt: new Date(),
      reason: reason || 'No reason provided',
      updatedAt: new Date()
    };

    await db.collection('visitors').doc(visitorId).update(updateData);

    // Log audit event
    await logAuditEvent({
      type: 'visitor_denied',
      actorUserId: userId,
      subjectId: visitorId,
      payload: { ...updateData }
    });

    // Send notifications
    await sendNotification({
      type: 'visitor_denied',
      householdId: visitorData.hostHouseholdId,
      data: {
        visitorId,
        visitorName: visitorData.name,
        deniedBy: userData.displayName,
        reason: reason
      }
    });

    res.json({
      message: 'Visitor denied successfully',
      visitor: {
        id: visitorId,
        ...visitorData,
        ...updateData
      }
    });
  } catch (error) {
    console.error('Error denying visitor:', error);
    res.status(500).json({ error: 'Failed to deny visitor' });
  }
});

// Check-in visitor (guard only)
router.put('/:id/checkin', verifyToken, async (req, res, next) => {
  // Allow guard or admin; fetch roles if needed
  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  if (!roles.includes('guard') && !roles.includes('admin')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
}, async (req, res) => {
  try {
    const visitorId = req.params.id;
    const userId = req.user.uid;
    
    const visitorDoc = await db.collection('visitors').doc(visitorId).get();
    
    if (!visitorDoc.exists) {
      return res.status(404).json({ error: 'Visitor not found' });
    }

    const visitorData = visitorDoc.data();
    
    // Check if visitor is approved
    if (visitorData.status !== VISITOR_STATUS.APPROVED) {
      return res.status(400).json({ error: 'Visitor must be approved before check-in' });
    }

    // Update visitor status
    const updateData = {
      status: VISITOR_STATUS.CHECKED_IN,
      checkedInBy: userId,
      checkedInAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection('visitors').doc(visitorId).update(updateData);

    // Log audit event
    await logAuditEvent({
      type: 'visitor_checked_in',
      actorUserId: userId,
      subjectId: visitorId,
      payload: { ...updateData }
    });

    // Send notifications
    await sendNotification({
      type: 'visitor_checked_in',
      householdId: visitorData.hostHouseholdId,
      data: {
        visitorId,
        visitorName: visitorData.name
      }
    });

    res.json({
      message: 'Visitor checked in successfully',
      visitor: {
        id: visitorId,
        ...visitorData,
        ...updateData
      }
    });
  } catch (error) {
    console.error('Error checking in visitor:', error);
    res.status(500).json({ error: 'Failed to check in visitor' });
  }
});

// Check-out visitor (guard only)
router.put('/:id/checkout', verifyToken, async (req, res, next) => {
  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  if (!roles.includes('guard') && !roles.includes('admin')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
}, async (req, res) => {
  try {
    const visitorId = req.params.id;
    const userId = req.user.uid;
    
    const visitorDoc = await db.collection('visitors').doc(visitorId).get();
    
    if (!visitorDoc.exists) {
      return res.status(404).json({ error: 'Visitor not found' });
    }

    const visitorData = visitorDoc.data();
    
    // Check if visitor is checked in
    if (visitorData.status !== VISITOR_STATUS.CHECKED_IN) {
      return res.status(400).json({ error: 'Visitor must be checked in before check-out' });
    }

    // Update visitor status
    const updateData = {
      status: VISITOR_STATUS.CHECKED_OUT,
      checkedOutBy: userId,
      checkedOutAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection('visitors').doc(visitorId).update(updateData);

    // Log audit event
    await logAuditEvent({
      type: 'visitor_checked_out',
      actorUserId: userId,
      subjectId: visitorId,
      payload: { ...updateData }
    });

    // Send notifications
    await sendNotification({
      type: 'visitor_checked_out',
      householdId: visitorData.hostHouseholdId,
      data: {
        visitorId,
        visitorName: visitorData.name
      }
    });

    res.json({
      message: 'Visitor checked out successfully',
      visitor: {
        id: visitorId,
        ...visitorData,
        ...updateData
      }
    });
  } catch (error) {
    console.error('Error checking out visitor:', error);
    res.status(500).json({ error: 'Failed to check out visitor' });
  }
});

module.exports = router;
