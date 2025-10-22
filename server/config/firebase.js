const admin = require('firebase-admin');

let db;
let messaging;

const initializeFirebase = () => {
  try {
    // Treat missing or placeholder credentials as demo mode
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    const isMissingCreds = !projectId || !privateKey || !clientEmail;
    const hasPlaceholders = (
      /your-project-id/i.test(projectId || '') ||
      /YOUR_PRIVATE_KEY_HERE/i.test(privateKey || '') ||
      /firebase-adminsdk-.*@your-project\.iam\.gserviceaccount\.com/i.test(clientEmail || '')
    );

    if (isMissingCreds || hasPlaceholders || projectId === 'demo-project') {
      console.log('⚠️  Using demo mode - Firebase not initialized');
      console.log('⚠️  To enable full features, set valid Firebase Admin credentials in server/.env');
      return;
    }

    // Initialize Firebase Admin SDK
    const serviceAccount = {
      type: "service_account",
      project_id: projectId,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: privateKey.includes('\\n') ? privateKey.replace(/\\n/g, '\n') : privateKey,
      client_email: clientEmail,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${clientEmail}`
    };

    // Check if Firebase is already initialized
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: projectId
      });
    }

    db = admin.firestore();
    messaging = admin.messaging();
    
    console.log('✅ Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    console.log('⚠️  Running in demo mode - some features will be limited');
  }
};

const getDb = () => {
  if (!db) {
    console.log('⚠️  Firebase not initialized - running in demo mode');
    return null;
  }
  return db;
};

const getMessaging = () => {
  if (!messaging) {
    console.log('⚠️  Firebase messaging not initialized - running in demo mode');
    return null;
  }
  return messaging;
};

// Helper function to set custom claims for roles
const setCustomClaims = async (uid, claims) => {
  try {
    await admin.auth().setCustomUserClaims(uid, claims);
    console.log(`✅ Custom claims set for user ${uid}:`, claims);
    return true;
  } catch (error) {
    console.error(`❌ Failed to set custom claims for user ${uid}:`, error.message);
    return false;
  }
};

// Helper function to get user by email
const getUserByEmail = async (email) => {
  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    return userRecord;
  } catch (error) {
    console.error(`❌ Failed to get user by email ${email}:`, error.message);
    return null;
  }
};

module.exports = {
  initializeFirebase,
  getDb,
  getMessaging,
  setCustomClaims,
  getUserByEmail,
  admin
};
