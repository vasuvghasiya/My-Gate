const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const { sendNotification, subscribeToTopic, unsubscribeFromTopic } = require('../services/notifications');
const { getDb } = require('../config/firebase');
const Joi = require('joi');

const router = express.Router();
const db = getDb();

// Schema for notification request
const notificationSchema = Joi.object({
  type: Joi.string().valid(
    'visitor_created',
    'visitor_approved', 
    'visitor_denied',
    'visitor_checked_in',
    'visitor_checked_out',
    'audit_event_created',
    'amenity_added',
    'amenity_updated',
    'security_incident',
    'guard_alert',
    'broadcast'
  ).required(),
  userId: Joi.string().optional(),
  householdId: Joi.string().optional(),
  roles: Joi.array().items(Joi.string().valid('resident', 'guard', 'admin')).optional(),
  data: Joi.object().required()
});

// Send notification
router.post('/', verifyToken, requireRole(['admin', 'guard']), async (req, res) => {
  try {
    const { error, value } = notificationSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await sendNotification(value);
    
    if (result.success) {
      res.json({ message: 'Notification sent successfully' });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Register FCM token
router.post('/register-token', verifyToken, async (req, res) => {
  try {
    const registerTokenSchema = Joi.object({
      token: Joi.string().required(),
      deviceType: Joi.string().valid('web', 'android', 'ios').optional()
    });
    
    const { error, value } = registerTokenSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.user.uid;
    const { token, deviceType } = value;
    
    // Get user document
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    const existingTokens = userData.fcmTokens || [];
    
    // Add token if not already present
    if (!existingTokens.includes(token)) {
      existingTokens.push(token);
      
      await db.collection('users').doc(userId).update({
        fcmTokens: existingTokens,
        deviceType: deviceType,
        lastTokenUpdate: new Date()
      });
      
      // Subscribe guards to guard topic
      if (userData.roles && userData.roles.includes('guard')) {
        await subscribeToTopic([token], 'guards');
      }
    }
    
    res.json({ message: 'FCM token registered successfully' });
  } catch (error) {
    console.error('Error registering FCM token:', error);
    res.status(500).json({ error: 'Failed to register FCM token' });
  }
});

// Unregister FCM token
router.delete('/unregister-token', verifyToken, async (req, res) => {
  try {
    const unregisterTokenSchema = Joi.object({
      token: Joi.string().required()
    });
    
    const { error, value } = unregisterTokenSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.user.uid;
    const { token } = value;
    
    // Get user document
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    const existingTokens = userData.fcmTokens || [];
    
    // Remove token
    const updatedTokens = existingTokens.filter(t => t !== token);
    
    await db.collection('users').doc(userId).update({
      fcmTokens: updatedTokens,
      lastTokenUpdate: new Date()
    });
    
    // Unsubscribe from guard topic if user is guard
    if (userData.roles && userData.roles.includes('guard')) {
      await unsubscribeFromTopic([token], 'guards');
    }
    
    res.json({ message: 'FCM token unregistered successfully' });
  } catch (error) {
    console.error('Error unregistering FCM token:', error);
    res.status(500).json({ error: 'Failed to unregister FCM token' });
  }
});

// Subscribe to topic
router.post('/subscribe-topic', verifyToken, async (req, res) => {
  try {
    const subscribeSchema = Joi.object({
      topic: Joi.string().required(),
      tokens: Joi.array().items(Joi.string()).required()
    });
    
    const { error, value } = subscribeSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { topic, tokens } = value;
    const result = await subscribeToTopic(tokens, topic);
    
    if (result.success) {
      res.json({ message: `Successfully subscribed to topic: ${topic}` });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error subscribing to topic:', error);
    res.status(500).json({ error: 'Failed to subscribe to topic' });
  }
});

// Unsubscribe from topic
router.post('/unsubscribe-topic', verifyToken, async (req, res) => {
  try {
    const unsubscribeSchema = Joi.object({
      topic: Joi.string().required(),
      tokens: Joi.array().items(Joi.string()).required()
    });
    
    const { error, value } = unsubscribeSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { topic, tokens } = value;
    const result = await unsubscribeFromTopic(tokens, topic);
    
    if (result.success) {
      res.json({ message: `Successfully unsubscribed from topic: ${topic}` });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error unsubscribing from topic:', error);
    res.status(500).json({ error: 'Failed to unsubscribe from topic' });
  }
});

// Get notifications for user
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const limit = parseInt(req.query.limit) || 20;
    
    console.log(`🔍 Fetching notifications for user: ${userId}`);
    
    // Check if Firebase is available
    if (!db) {
      console.log('⚠️  Firebase not initialized - returning empty notifications');
      return res.json({ notifications: [] });
    }
    
    // Fetch notifications from Firestore
    console.log('📊 Querying notifications collection...');
    let notifications = [];
    
    try {
      const notificationsSnapshot = await db.collection('notifications')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
      
      console.log(`📝 Found ${notificationsSnapshot.size} notifications`);
      
      notificationsSnapshot.forEach(doc => {
        const data = doc.data();
        notifications.push({
          id: doc.id,
          type: data.type,
          title: data.title,
          message: data.message,
          data: data.data,
          createdBy: data.createdBy,
          read: data.read || false,
          timestamp: data.createdAt
        });
      });
    } catch (queryError) {
      console.log('⚠️  Notifications collection query failed, returning empty array:', queryError.message);
      notifications = [];
    }
    
    // If no notifications found, create some sample notifications for testing
    if (notifications.length === 0) {
      console.log('📝 No notifications found, creating sample notifications...');
      try {
        const sampleNotifications = [
          {
            type: 'visitor_created',
            title: 'New Visitor Request',
            message: 'John Doe wants to visit you',
            data: { visitorName: 'John Doe', visitorId: 'sample123' },
            createdBy: 'System',
            userId: userId,
            userRoles: ['resident'],
            createdAt: new Date(),
            read: false
          },
          {
            type: 'audit_event_created',
            title: 'New Audit Event',
            message: 'Security incident reported by Guard',
            data: { eventType: 'security_incident', createdBy: 'Guard' },
            createdBy: 'System',
            userId: userId,
            userRoles: ['resident'],
            createdAt: new Date(Date.now() - 3600000), // 1 hour ago
            read: false
          },
          {
            type: 'amenity_added',
            title: 'New Amenity Available',
            message: 'Swimming Pool has been added to the community',
            data: { amenityName: 'Swimming Pool', amenityId: 'sample-amenity-123' },
            createdBy: 'System',
            userId: userId,
            userRoles: ['resident'],
            createdAt: new Date(Date.now() - 7200000), // 2 hours ago
            read: true
          }
        ];

        // Store sample notifications in database
        const batch = db.batch();
        sampleNotifications.forEach(notification => {
          const notificationRef = db.collection('notifications').doc();
          batch.set(notificationRef, notification);
        });
        await batch.commit();
        
        // Return the sample notifications
        notifications = sampleNotifications.map((n, index) => ({
          id: `sample-${index}`,
          type: n.type,
          title: n.title,
          message: n.message,
          data: n.data,
          createdBy: n.createdBy,
          read: n.read,
          timestamp: n.createdAt
        }));
        
        console.log('✅ Created and returned sample notifications');
      } catch (sampleError) {
        console.error('❌ Failed to create sample notifications:', sampleError);
        notifications = [];
      }
    }
    
    console.log(`✅ Returning ${notifications.length} notifications`);
    res.json({ notifications });
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    console.error('❌ Error details:', error.message);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.put('/:id/read', verifyToken, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user.uid;
    
    // Check if Firebase is available
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    // Update notification in Firestore
    await db.collection('notifications').doc(notificationId).update({
      read: true,
      readAt: new Date()
    });
    
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Get notification settings
router.get('/settings', verifyToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    
    res.json({
      fcmTokens: userData.fcmTokens || [],
      deviceType: userData.deviceType,
      lastTokenUpdate: userData.lastTokenUpdate,
      notificationSettings: userData.notificationSettings || {
        visitorUpdates: true,
        securityAlerts: true,
        announcements: true
      }
    });
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    res.status(500).json({ error: 'Failed to fetch notification settings' });
  }
});

// Update notification settings
router.put('/settings', verifyToken, async (req, res) => {
  try {
    const settingsSchema = Joi.object({
      notificationSettings: Joi.object({
        visitorUpdates: Joi.boolean(),
        securityAlerts: Joi.boolean(),
        announcements: Joi.boolean()
      }).required()
    });
    
    const { error, value } = settingsSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.user.uid;
    
    await db.collection('users').doc(userId).update({
      notificationSettings: value.notificationSettings,
      updatedAt: new Date()
    });
    
    res.json({ message: 'Notification settings updated successfully' });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    res.status(500).json({ error: 'Failed to update notification settings' });
  }
});

module.exports = router;
