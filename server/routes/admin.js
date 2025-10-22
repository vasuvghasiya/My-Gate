const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const { getDb } = require('../config/firebase');
const { getAuditEvents, getAuditStats } = require('../services/audit');
const { sendNotification } = require('../services/notifications');
const Joi = require('joi');

const router = express.Router();
const db = getDb();

// Get all users (admin only)
router.get('/users', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const snapshot = await db.collection('users').get();
    const users = [];

    snapshot.forEach(doc => {
      users.push({
        uid: doc.id,
        ...doc.data()
      });
    });

    res.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user (admin only)
router.put('/users/:userId', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const updateSchema = Joi.object({
      displayName: Joi.string().optional(),
      phone: Joi.string().optional(),
      householdId: Joi.string().optional(),
      roles: Joi.array().items(Joi.string().valid('resident', 'guard', 'admin')).optional()
    });

    const { error, value } = updateSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.params.userId;
    
    // Update user document
    const updateData = {
      ...value,
      updatedAt: new Date()
    };

    await db.collection('users').doc(userId).update(updateData);

    // Update custom claims if roles changed
    if (value.roles) {
      const { setCustomClaims } = require('../config/firebase');
      await setCustomClaims(userId, { roles: value.roles });
    }

    res.json({
      message: 'User updated successfully',
      updated: updateData
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Get audit events (admin only)
router.get('/audit', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const filters = {};
    
    if (req.query.type) filters.type = req.query.type;
    if (req.query.actorUserId) filters.actorUserId = req.query.actorUserId;
    if (req.query.subjectId) filters.subjectId = req.query.subjectId;
    if (req.query.limit) filters.limit = parseInt(req.query.limit);

    const events = await getAuditEvents(filters);
    
    res.json({ events });
  } catch (error) {
    console.error('Error fetching audit events:', error);
    res.status(500).json({ error: 'Failed to fetch audit events' });
  }
});

// Get system statistics (admin only)
router.get('/stats', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    // Get user count
    const usersSnapshot = await db.collection('users').get();
    const totalUsers = usersSnapshot.size;

    // Get visitor count
    const visitorsSnapshot = await db.collection('visitors').get();
    const totalVisitors = visitorsSnapshot.size;

    // Get audit events count
    const auditSnapshot = await db.collection('audit_events').get();
    const totalEvents = auditSnapshot.size;

    // Get audit stats for last 24 hours
    const auditStats = await getAuditStats(24);

    // Calculate active sessions (users with recent activity)
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000));
    
    const recentUsers = usersSnapshot.docs.filter(doc => {
      const userData = doc.data();
      return userData.lastLogin && new Date(userData.lastLogin) > oneHourAgo;
    });
    
    const activeSessions = recentUsers.length;

    const stats = {
      totalUsers,
      totalVisitors,
      totalEvents,
      activeSessions,
      systemUptime: '99.9%',
      lastBackup: new Date().toISOString(),
      auditStats
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Create or update household (admin only)
router.post('/households', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const schema = Joi.object({
      id: Joi.string().required(),
      flatNo: Joi.string().required(),
      name: Joi.string().required(),
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const payload = {
      id: value.id,
      flatNo: value.flatNo,
      name: value.name,
      members: {},
      updatedAt: new Date(),
      createdAt: new Date(),
    };

    await db.collection('households').doc(value.id).set(payload, { merge: true });
    res.status(201).json({ message: 'Household saved', household: payload });
  } catch (err) {
    console.error('Error saving household:', err);
    res.status(500).json({ error: 'Failed to save household' });
  }
});

// Create amenity (admin only)
router.post('/amenities', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const schema = Joi.object({
      name: Joi.string().required(),
      description: Joi.string().required(),
      capacity: Joi.number().integer().min(1).required(),
      hourlyRate: Joi.number().min(0).required(),
      availableHours: Joi.object({ start: Joi.string().required(), end: Joi.string().required() }).required(),
      isActive: Joi.boolean().default(true)
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const payload = {
      ...value,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const ref = await db.collection('amenities').add(payload);
    
    // Send notifications to all users about new amenity
    try {
      const userData = await db.collection('users').doc(req.user.uid).get();
      const user = userData.exists ? userData.data() : {};
      
      await sendNotification({
        type: 'amenity_added',
        roles: ['resident', 'guard', 'admin'],
        createdBy: user.displayName || req.user.email,
        data: {
          amenityName: value.name,
          amenityDescription: value.description,
          amenityId: ref.id,
          capacity: value.capacity,
          hourlyRate: value.hourlyRate
        }
      });
    } catch (notificationError) {
      console.error('Failed to send amenity notification:', notificationError);
      // Don't fail the request if notification fails
    }
    
    res.status(201).json({ message: 'Amenity created', amenity: { id: ref.id, ...payload } });
  } catch (err) {
    console.error('Error creating amenity:', err);
    res.status(500).json({ error: 'Failed to create amenity' });
  }
});

// Approve audit event (admin only)
router.put('/audit/:id/approve', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const id = req.params.id;
    const update = { status: 'approved' };
    await db.collection('audit_events').doc(id).set(update, { merge: true });
    const doc = await db.collection('audit_events').doc(id).get();
    res.json({ message: 'Audit event approved', event: { id: doc.id, ...doc.data() } });
  } catch (err) {
    console.error('Error approving audit event:', err);
    res.status(500).json({ error: 'Failed to approve audit event' });
  }
});

// Deny audit event (admin only)
router.put('/audit/:id/deny', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const id = req.params.id;
    const update = { status: 'denied' };
    await db.collection('audit_events').doc(id).set(update, { merge: true });
    const doc = await db.collection('audit_events').doc(id).get();
    res.json({ message: 'Audit event denied', event: { id: doc.id, ...doc.data() } });
  } catch (err) {
    console.error('Error denying audit event:', err);
    res.status(500).json({ error: 'Failed to deny audit event' });
  }
});

module.exports = router;
