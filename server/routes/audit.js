const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { getDb } = require('../config/firebase');
const { sendNotification } = require('../services/notifications');
const Joi = require('joi');

const router = express.Router();
const db = getDb();

// List audits role-scoped
router.get('/', verifyToken, async (req, res) => {
  try {
    // Check if Firebase is available
    if (!db) {
      console.log('⚠️  Firebase not initialized - returning empty audit events');
      return res.json({ events: [] });
    }

    const userId = req.user.uid;
    const roles = Array.isArray(req.user.roles) ? req.user.roles : [];
    
    console.log(`🔍 Audit request from user ${userId} with roles:`, roles);
    
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    
    console.log(`👤 User data:`, { 
      exists: userDoc.exists, 
      householdId: userData.householdId, 
      roles: userData.roles 
    });

    let query = db.collection('audit_events').orderBy('timestamp', 'desc').limit(100);
    if (roles.includes('resident') && !roles.includes('admin') && !roles.includes('guard')) {
      // Residents see only their household events
      if (userData.householdId) {
        console.log(`🏠 Querying audit events for household: ${userData.householdId}`);
        // Use a simpler query that doesn't require composite index
        query = db.collection('audit_events').where('householdId', '==', userData.householdId).limit(100);
      } else {
        console.log(`⚠️  User ${userId} has no householdId - returning empty events`);
        return res.json({ events: [] });
      }
    } else {
      console.log(`👑 Admin/Guard querying all audit events`);
    }

    const snapshot = await query.get();
    let events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Sort events by timestamp in descending order (newest first)
    events.sort((a, b) => {
      const timestampA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
      const timestampB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
      return timestampB - timestampA;
    });
    
    console.log(`📊 Found ${events.length} audit events`);
    res.json({ events });
  } catch (err) {
    console.error('❌ Error listing audits:', err);
    console.error('❌ Error details:', err.message);
    console.error('❌ Error stack:', err.stack);
    res.status(500).json({ error: 'Failed to list audit events' });
  }
});

// Create audit (resident)
router.post('/', verifyToken, async (req, res) => {
  try {
    // Check if Firebase is available
    if (!db) {
      console.log('⚠️  Firebase not initialized - cannot create audit events');
      return res.status(503).json({ error: 'Service temporarily unavailable - database not initialized' });
    }

    const roles = Array.isArray(req.user.roles) ? req.user.roles : [];
    if (!roles.includes('resident') && !roles.includes('guard')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const schema = Joi.object({
      type: Joi.string().required(),
      subject: Joi.string().optional(),
      actor: Joi.string().optional(),
      date: Joi.string().optional(), // YYYY-MM-DD
      time: Joi.string().optional(), // HH:mm
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Get user data for householdId
    const userId = req.user.uid;
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    
    // Guards can create events without householdId, residents need householdId
    if (roles.includes('resident') && !userData.householdId) {
      return res.status(400).json({ error: 'Residents must belong to a household to create audit events' });
    }

    let eventTime = new Date();
    if (value.date && value.time) {
      const iso = `${value.date}T${value.time}`;
      const parsed = new Date(iso);
      if (!isNaN(parsed.getTime())) eventTime = parsed;
    }
    const event = {
      type: value.type,
      subject: value.subject || null,
      actor: value.actor || null,
      date: value.date || null,
      time: value.time || null,
      timestamp: eventTime,
      status: 'pending',
      householdId: userData.householdId || null, // Guards might not have householdId
      actorUserId: userId,
      actorRole: roles.includes('guard') ? 'guard' : 'resident',
      createdAt: new Date(),
    };
    const ref = await db.collection('audit_events').add(event);
    
    // Send notifications to admins and guards
    console.log('🔔 Sending audit event notification...');
    try {
      const notificationResult = await sendNotification({
        type: 'audit_event_created',
        roles: ['admin', 'guard'],
        createdBy: userData.displayName || req.user.email,
        data: {
          eventType: value.type,
          subject: value.subject,
          actor: value.actor,
          eventId: ref.id
        }
      });
      console.log('🔔 Audit notification result:', notificationResult);
    } catch (notificationError) {
      console.error('❌ Failed to send audit event notification:', notificationError);
      // Don't fail the request if notification fails
    }
    
    res.status(201).json({ message: 'Audit event created', event: { id: ref.id, ...event } });
  } catch (err) {
    console.error('Error creating audit event:', err);
    res.status(500).json({ error: 'Failed to create audit event' });
  }
});

module.exports = router;


