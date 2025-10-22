const { getDb } = require('../config/firebase');
const { sendNotification } = require('../services/notifications');
require('dotenv').config();

async function testNotifications() {
  try {
    const db = getDb();
    if (!db) {
      console.log('❌ Firebase not initialized');
      return;
    }

    console.log('🧪 Testing notification system...');

    // Get a sample user to test with
    const usersSnapshot = await db.collection('users').get();
    if (usersSnapshot.empty) {
      console.log('❌ No users found in database');
      return;
    }

    const sampleUser = usersSnapshot.docs[0];
    const userData = sampleUser.data();
    console.log(`👤 Testing with user: ${userData.displayName || userData.email}`);

    // Test 1: Send notification to specific user
    console.log('\n📱 Test 1: Sending notification to specific user...');
    await sendNotification({
      type: 'visitor_created',
      userId: sampleUser.id,
      createdBy: 'Test System',
      data: {
        visitorName: 'Test Visitor',
        visitorId: 'test123',
        purpose: 'Testing notification system'
      }
    });

    // Test 2: Send notification to all admins
    console.log('\n📱 Test 2: Sending notification to all admins...');
    await sendNotification({
      type: 'audit_event_created',
      roles: ['admin'],
      createdBy: 'Test System',
      data: {
        eventType: 'security_incident',
        subject: 'Test security incident',
        eventId: 'test-audit-123'
      }
    });

    // Test 3: Send notification to all users
    console.log('\n📱 Test 3: Sending notification to all users...');
    await sendNotification({
      type: 'amenity_added',
      roles: ['resident', 'guard', 'admin'],
      createdBy: 'Test System',
      data: {
        amenityName: 'Test Swimming Pool',
        amenityDescription: 'A test amenity for notification testing',
        amenityId: 'test-amenity-123',
        capacity: 50,
        hourlyRate: 100
      }
    });

    console.log('\n✅ Notification tests completed!');
    console.log('🔍 Check the notifications collection in Firestore to see the stored notifications.');
    console.log('🔔 Check the bell icon in the app to see the notifications.');

  } catch (error) {
    console.error('❌ Error testing notifications:', error);
  }
}

testNotifications();
