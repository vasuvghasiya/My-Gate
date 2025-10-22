const { getMessaging, getDb } = require('../config/firebase');

const sendNotification = async ({ type, userId, householdId, roles, data, createdBy }) => {
  try {
    console.log(`📱 Sending notification: ${type}`);
    console.log(`📱 Notification details:`, { type, userId, householdId, roles, data, createdBy });
    
    const messaging = getMessaging();
    const db = getDb();

    if (!db) {
      console.log('⚠️  Firebase not initialized - cannot send notification');
      return { success: false, error: 'Firebase not initialized' };
    }

    let targetUsers = [];
    let tokens = [];
    let topic = null;

    // Determine target based on type
    if (userId) {
      // Send to specific user
      const userDoc = await db.collection('users').doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        targetUsers.push({ id: userId, ...userData });
        tokens = userData.fcmTokens || [];
      }
    } else if (householdId) {
      // Send to all members of household
      const householdMembers = await db.collection('users')
        .where('householdId', '==', householdId)
        .get();
      
      householdMembers.forEach(doc => {
        const memberData = doc.data();
        targetUsers.push({ id: doc.id, ...memberData });
        if (memberData.fcmTokens) {
          tokens.push(...memberData.fcmTokens);
        }
      });
    } else if (roles && Array.isArray(roles)) {
      // Send to users with specific roles
      for (const role of roles) {
        const roleUsers = await db.collection('users')
          .where('roles', 'array-contains', role)
          .get();
        
        roleUsers.forEach(doc => {
          const userData = doc.data();
          targetUsers.push({ id: doc.id, ...userData });
          if (userData.fcmTokens) {
            tokens.push(...userData.fcmTokens);
          }
        });
      }
    } else {
      // Send to all guards by default
      topic = 'guards';
    }

    // Prepare notification payload
    const notification = getNotificationPayload(type, data);

    // Store notifications in database for each target user
    if (targetUsers.length > 0) {
      const notificationData = {
        type,
        title: notification.notification.title,
        message: notification.notification.body,
        data: notification.data,
        createdBy: createdBy || 'system',
        createdAt: new Date(),
        read: false
      };

      // Create notification documents for each target user
      const batch = db.batch();
      targetUsers.forEach(user => {
        const notificationRef = db.collection('notifications').doc();
        batch.set(notificationRef, {
          ...notificationData,
          userId: user.id,
          userRoles: user.roles || []
        });
      });
      await batch.commit();
      console.log(`📝 Stored ${targetUsers.length} notifications in database`);
    }

    if (tokens.length > 0) {
      // Send to specific tokens
      const message = {
        notification: notification.notification,
        data: notification.data,
        tokens: tokens
      };

      const response = await messaging.sendMulticast(message);
      console.log(`📱 Notification sent to ${response.successCount}/${tokens.length} devices`);
      
      // Remove invalid tokens
      if (response.failureCount > 0) {
        await cleanupInvalidTokens(tokens, response.responses);
      }
    }

    if (topic) {
      // Send to topic
      const message = {
        notification: notification.notification,
        data: notification.data,
        topic: topic
      };

      await messaging.send(message);
      console.log(`📢 Notification sent to topic: ${topic}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Error sending notification:', error);
    return { success: false, error: error.message };
  }
};

const getNotificationPayload = (type, data) => {
  const baseData = {
    type,
    timestamp: new Date().toISOString(),
    ...data
  };

  switch (type) {
    case 'visitor_created':
      return {
        notification: {
          title: 'New Visitor Request',
          body: `${data.visitorName} wants to visit you`
        },
        data: baseData
      };

    case 'visitor_approved':
      return {
        notification: {
          title: 'Visitor Approved',
          body: `${data.visitorName} has been approved by ${data.approvedBy}`
        },
        data: baseData
      };

    case 'visitor_denied':
      return {
        notification: {
          title: 'Visitor Denied',
          body: `${data.visitorName} has been denied. Reason: ${data.reason}`
        },
        data: baseData
      };

    case 'visitor_checked_in':
      return {
        notification: {
          title: 'Visitor Arrived',
          body: `${data.visitorName} has checked in at the gate`
        },
        data: baseData
      };

    case 'visitor_checked_out':
      return {
        notification: {
          title: 'Visitor Left',
          body: `${data.visitorName} has checked out`
        },
        data: baseData
      };

    case 'audit_event_created':
      return {
        notification: {
          title: 'New Audit Event',
          body: `${data.eventType} reported by ${data.createdBy}`
        },
        data: baseData
      };

    case 'amenity_added':
      return {
        notification: {
          title: 'New Amenity Available',
          body: `${data.amenityName} has been added to the community`
        },
        data: baseData
      };

    case 'amenity_updated':
      return {
        notification: {
          title: 'Amenity Updated',
          body: `${data.amenityName} has been updated`
        },
        data: baseData
      };

    case 'guard_alert':
      return {
        notification: {
          title: 'Gate Alert',
          body: data.message
        },
        data: baseData
      };

    case 'security_incident':
      return {
        notification: {
          title: 'Security Incident',
          body: data.message || 'A security incident has been reported'
        },
        data: baseData
      };

    default:
      return {
        notification: {
          title: 'Community Update',
          body: 'You have a new notification'
        },
        data: baseData
      };
  }
};

const cleanupInvalidTokens = async (tokens, responses) => {
  try {
    const db = getDb();
    const invalidTokens = [];

    responses.forEach((response, index) => {
      if (!response.success && response.error?.code === 'messaging/invalid-registration-token') {
        invalidTokens.push(tokens[index]);
      }
    });

    if (invalidTokens.length > 0) {
      // Find users with invalid tokens and remove them
      const users = await db.collection('users').get();
      
      for (const userDoc of users.docs) {
        const userData = userDoc.data();
        if (userData.fcmTokens) {
          const validTokens = userData.fcmTokens.filter(token => 
            !invalidTokens.includes(token)
          );
          
          if (validTokens.length !== userData.fcmTokens.length) {
            await userDoc.ref.update({ fcmTokens: validTokens });
            console.log(`🧹 Cleaned up ${userData.fcmTokens.length - validTokens.length} invalid tokens for user ${userDoc.id}`);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error cleaning up invalid tokens:', error);
  }
};

const subscribeToTopic = async (tokens, topic) => {
  try {
    const messaging = getMessaging();
    await messaging.subscribeToTopic(tokens, topic);
    console.log(`✅ Subscribed ${tokens.length} tokens to topic: ${topic}`);
    return { success: true };
  } catch (error) {
    console.error('Error subscribing to topic:', error);
    return { success: false, error: error.message };
  }
};

const unsubscribeFromTopic = async (tokens, topic) => {
  try {
    const messaging = getMessaging();
    await messaging.unsubscribeFromTopic(tokens, topic);
    console.log(`✅ Unsubscribed ${tokens.length} tokens from topic: ${topic}`);
    return { success: true };
  } catch (error) {
    console.error('Error unsubscribing from topic:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendNotification,
  subscribeToTopic,
  unsubscribeFromTopic,
  cleanupInvalidTokens
};
