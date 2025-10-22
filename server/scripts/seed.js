const { initializeFirebase, getDb, setCustomClaims, getUserByEmail } = require('../config/firebase');
require('dotenv').config();

// Initialize Firebase
initializeFirebase();

const seedData = async () => {
  try {
    const db = getDb();
    console.log('🌱 Starting database seeding...');

    // Create households
    const households = [
      {
        id: 'household_001',
        flatNo: 'A-101',
        name: 'The Johnson Family',
        members: {},
        createdAt: new Date()
      },
      {
        id: 'household_002', 
        flatNo: 'B-205',
        name: 'The Smith Family',
        members: {},
        createdAt: new Date()
      }
    ];

    for (const household of households) {
      await db.collection('households').doc(household.id).set(household);
      console.log(`✅ Created household: ${household.flatNo}`);
    }

    // Create users with different roles
    const users = [
      {
        email: 'resident@example.com',
        displayName: 'John Johnson',
        phone: '+1234567890',
        householdId: 'household_001',
        roles: ['resident'],
        password: 'password123'
      },
      {
        email: 'guard@example.com',
        displayName: 'Security Guard Mike',
        phone: '+1234567891',
        householdId: null,
        roles: ['guard'],
        password: 'password123'
      },
      {
        email: 'admin@example.com',
        displayName: 'Admin Sarah',
        phone: '+1234567892',
        householdId: 'household_002',
        roles: ['admin'],
        password: 'password123'
      }
    ];

    const { admin } = require('../config/firebase');
    
    for (const userData of users) {
      try {
        // Create Firebase Auth user
        const userRecord = await admin.auth().createUser({
          email: userData.email,
          password: userData.password,
          displayName: userData.displayName,
          emailVerified: true
        });

        // Create user document in Firestore
        const userDoc = {
          displayName: userData.displayName,
          email: userData.email,
          phone: userData.phone,
          householdId: userData.householdId,
          roles: userData.roles,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await db.collection('users').doc(userRecord.uid).set(userDoc);

        // Set custom claims for roles
        await setCustomClaims(userRecord.uid, { roles: userData.roles });

        // Update household members
        if (userData.householdId) {
          await db.collection('households').doc(userData.householdId).update({
            [`members.${userRecord.uid}`]: {
              name: userData.displayName,
              email: userData.email,
              role: userData.roles[0]
            }
          });
        }

        console.log(`✅ Created user: ${userData.displayName} (${userData.roles.join(', ')})`);
      } catch (error) {
        if (error.code === 'auth/email-already-exists') {
          console.log(`⚠️  User already exists: ${userData.email}`);
          
          // Get existing user and update their document
          const existingUser = await getUserByEmail(userData.email);
          if (existingUser) {
            await db.collection('users').doc(existingUser.uid).set({
              displayName: userData.displayName,
              email: userData.email,
              phone: userData.phone,
              householdId: userData.householdId,
              roles: userData.roles,
              createdAt: new Date(),
              updatedAt: new Date()
            }, { merge: true });

            await setCustomClaims(existingUser.uid, { roles: userData.roles });
            console.log(`✅ Updated existing user: ${userData.displayName}`);
          }
        } else {
          console.error(`❌ Error creating user ${userData.email}:`, error.message);
        }
      }
    }

    // Create sample visitors
    const visitors = [
      {
        name: 'Ramesh Kumar',
        phone: '+9876543210',
        purpose: 'Delivery - Amazon package',
        hostHouseholdId: 'household_001',
        hostUserId: null, // Will be set after user creation
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Priya Sharma',
        phone: '+9876543211',
        purpose: 'Meeting with resident',
        hostHouseholdId: 'household_002',
        hostUserId: null, // Will be set after user creation
        status: 'approved',
        approvedBy: null, // Will be set after user creation
        approvedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    // Get user IDs for visitors
    const residentUser = await getUserByEmail('resident@example.com');
    const adminUser = await getUserByEmail('admin@example.com');

    for (let i = 0; i < visitors.length; i++) {
      const visitor = visitors[i];
      
      if (visitor.hostHouseholdId === 'household_001' && residentUser) {
        visitor.hostUserId = residentUser.uid;
      } else if (visitor.hostHouseholdId === 'household_002' && adminUser) {
        visitor.hostUserId = adminUser.uid;
        visitor.approvedBy = adminUser.uid;
      }

      const visitorRef = await db.collection('visitors').add(visitor);
      console.log(`✅ Created visitor: ${visitor.name} (${visitor.status})`);
    }

    // Create sample audit events
    const auditEvents = [
      {
        type: 'visitor_created',
        actorUserId: residentUser ? residentUser.uid : 'system',
        subjectId: 'visitor_001',
        payload: { visitorName: 'Ramesh Kumar', purpose: 'Delivery' },
        timestamp: new Date(Date.now() - 3600000) // 1 hour ago
      },
      {
        type: 'visitor_approved',
        actorUserId: adminUser ? adminUser.uid : 'system',
        subjectId: 'visitor_002',
        payload: { visitorName: 'Priya Sharma', approvedBy: 'Admin Sarah' },
        timestamp: new Date(Date.now() - 1800000) // 30 minutes ago
      }
    ];

    for (const event of auditEvents) {
      await db.collection('audit_events').add(event);
    }
    console.log(`✅ Created ${auditEvents.length} audit events`);

    // Create sample amenities (plus feature)
    const amenities = [
      {
        name: 'Clubhouse',
        description: 'Community clubhouse for events and meetings',
        capacity: 50,
        hourlyRate: 500,
        availableHours: { start: '06:00', end: '22:00' },
        isActive: true,
        createdAt: new Date()
      },
      {
        name: 'Gym',
        description: 'Fitness center with modern equipment',
        capacity: 20,
        hourlyRate: 200,
        availableHours: { start: '05:00', end: '23:00' },
        isActive: true,
        createdAt: new Date()
      }
    ];

    for (const amenity of amenities) {
      await db.collection('amenities').add(amenity);
      console.log(`✅ Created amenity: ${amenity.name}`);
    }

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📋 Test Accounts:');
    console.log('Resident: resident@example.com / password123');
    console.log('Guard: guard@example.com / password123');
    console.log('Admin: admin@example.com / password123');
    console.log('\n📱 Sample Data:');
    console.log('- 2 households with members');
    console.log('- 2 sample visitors (1 pending, 1 approved)');
    console.log('- Audit events for tracking');
    console.log('- 2 amenities for booking');

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  }
};

// Run seeding
seedData().then(() => {
  console.log('✅ Seeding process completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});
