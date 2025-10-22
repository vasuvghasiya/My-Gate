const { admin } = require('../config/firebase');

// Middleware to verify Firebase ID token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No valid authorization header found' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    // Verify the ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Base user info
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      roles: Array.isArray(decodedToken.roles) ? decodedToken.roles : []
    };

    // Always prefer Firestore roles as source of truth (custom claims can lag)
    try {
      const { getDb, setCustomClaims } = require('../config/firebase');
      const db = getDb();
      const userDoc = await db.collection('users').doc(req.user.uid).get();
      if (userDoc.exists) {
        const data = userDoc.data();
        if (Array.isArray(data.roles) && data.roles.length > 0) {
          req.user.roles = data.roles;
          // Propagate to custom claims asynchronously
          setCustomClaims(req.user.uid, { roles: data.roles }).catch(() => {});
        }
        if (data.householdId) {
          req.user.householdId = data.householdId;
        }
      }
    } catch (_) {
      // Ignore Firestore lookup issues; continue with token roles
    }

    // Dev log to confirm resolved roles (only in development)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Auth resolved roles for ${req.user.email || req.user.uid}:`, req.user.roles);
    }

    next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Middleware to check if user has required role
const requireRole = (requiredRoles) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let userRoles = Array.isArray(req.user.roles) ? req.user.roles : [];

    // Fallback: fetch roles from Firestore if missing on token
    if (userRoles.length === 0) {
      try {
        const { getDb, setCustomClaims } = require('../config/firebase');
        const db = getDb();
        const userDoc = await db.collection('users').doc(req.user.uid).get();
        if (userDoc.exists) {
          const data = userDoc.data();
          if (Array.isArray(data.roles) && data.roles.length > 0) {
            userRoles = data.roles;
            req.user.roles = data.roles;
            // Try to persist to custom claims for next requests (non-blocking)
            setCustomClaims(req.user.uid, { roles: data.roles }).catch(() => {});
          }
        }
      } catch (_) {}
    }

    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: requiredRoles,
        current: userRoles
      });
    }

    next();
  };
};

// Helper function to check if user can access household
const canAccessHousehold = async (userId, householdId) => {
  try {
    const db = require('../config/firebase').getDb();
    
    // Get user document
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return false;
    }

    const userData = userDoc.data();
    
    // Admins can access any household
    if (userData.roles && userData.roles.includes('admin')) {
      return true;
    }

    // Users can only access their own household
    return userData.householdId === householdId;
  } catch (error) {
    console.error('Error checking household access:', error.message);
    return false;
  }
};

module.exports = {
  verifyToken,
  requireRole,
  canAccessHousehold
};
