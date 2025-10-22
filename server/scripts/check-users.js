const { getDb } = require('../config/firebase');
require('dotenv').config();

async function checkUsers() {
  try {
    const db = getDb();
    if (!db) {
      console.log('❌ Firebase not initialized');
      return;
    }

    console.log('🔍 Checking all users...');
    const usersSnapshot = await db.collection('users').get();
    
    if (usersSnapshot.empty) {
      console.log('📭 No users found in database');
      return;
    }

    console.log(`👥 Found ${usersSnapshot.size} users:`);
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      console.log(`\n👤 User: ${doc.id}`);
      console.log(`   Email: ${userData.email}`);
      console.log(`   Display Name: ${userData.displayName}`);
      console.log(`   Roles: ${JSON.stringify(userData.roles)}`);
      console.log(`   Household ID: ${userData.householdId || 'NOT SET'}`);
      console.log(`   Created: ${userData.createdAt}`);
    });

    // Check audit events
    console.log('\n🔍 Checking audit events...');
    const auditSnapshot = await db.collection('audit_events').get();
    console.log(`📊 Found ${auditSnapshot.size} audit events`);
    
    if (auditSnapshot.size > 0) {
      auditSnapshot.forEach(doc => {
        const eventData = doc.data();
        console.log(`\n📝 Event: ${doc.id}`);
        console.log(`   Type: ${eventData.type}`);
        console.log(`   Household ID: ${eventData.householdId || 'NOT SET'}`);
        console.log(`   Timestamp: ${eventData.timestamp}`);
      });
    }

  } catch (error) {
    console.error('❌ Error checking users:', error);
  }
}

checkUsers();
