const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { getDb } = require('../config/firebase');
const Joi = require('joi');

const router = express.Router();
const db = getDb();

// Schema for user creation
const createUserSchema = Joi.object({
  displayName: Joi.string().required(),
  email: Joi.string().email().required(),
  phone: Joi.string().optional(),
  householdId: Joi.string().required(),
  roles: Joi.array().items(Joi.string().valid('resident', 'guard', 'admin')).default(['resident'])
});

// Verify token and return user info
router.post('/verify', verifyToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    
    // Get or create user document from/in Firestore
    let userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      const defaultRoles = ['resident'];
      const defaultUser = {
        displayName: req.user.email?.split('@')[0] || 'User',
        email: req.user.email,
        phone: null,
        householdId: null,
        roles: defaultRoles,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.collection('users').doc(userId).set(defaultUser);

      // Set custom claims for roles to ensure downstream authorization works
      try {
        const { setCustomClaims } = require('../config/firebase');
        await setCustomClaims(userId, { roles: defaultRoles });
      } catch (e) {
        // Non-fatal; proceed even if claims couldn't be set immediately
        console.warn('Warning: failed to set custom claims for new user:', e?.message || e);
      }

      userDoc = await db.collection('users').doc(userId).get();
    }

    const userData = userDoc.data();
    
    res.json({
      uid: userId,
      email: req.user.email,
      displayName: userData.displayName,
      phone: userData.phone,
      householdId: userData.householdId,
      roles: userData.roles || [],
      createdAt: userData.createdAt
    });
  } catch (error) {
    console.error('Error verifying user:', error);
    res.status(500).json({ error: 'Failed to verify user' });
  }
});

// Create user profile (called after Firebase Auth signup)
router.post('/create-profile', verifyToken, async (req, res) => {
  try {
    // Accept client-provided role but constrain to allowed values
    const parsed = createUserSchema.validate(req.body);
    const error = parsed.error;
    let value = parsed.value;
    if (!error) {
      // Normalize role input defensively
      if (Array.isArray(value.roles) && value.roles.length > 0) {
        const r = String(value.roles[0] || '').toLowerCase();
        const allowed = ['resident', 'guard', 'admin'];
        value.roles = [allowed.includes(r) ? r : 'resident'];
      } else {
        value.roles = ['resident'];
      }
      if (typeof value.householdId === 'string') value.householdId = value.householdId.trim();
      if (typeof value.displayName === 'string') value.displayName = value.displayName.trim();
      if (typeof value.phone === 'string' && value.phone.trim() === '') value.phone = null;
    }
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.user.uid;
    
    // Check if user already exists
    const existingUser = await db.collection('users').doc(userId).get();

    // Prepare profile payload from request
    const userData = {
      displayName: value.displayName,
      email: req.user.email,
      phone: value.phone || null,
      householdId: value.householdId || null,
      roles: value.roles && Array.isArray(value.roles) && value.roles.length > 0
        ? value.roles
        : ['resident'],
      emailVerified: req.user.emailVerified,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (existingUser.exists) {
      // Merge into existing profile instead of failing with 409
      const updateData = {
        displayName: userData.displayName,
        phone: userData.phone,
        householdId: userData.householdId,
        roles: userData.roles,
        updatedAt: new Date()
      };
      await db.collection('users').doc(userId).set(updateData, { merge: true });

      // Update custom claims to requested role
      const { setCustomClaims } = require('../config/firebase');
      await setCustomClaims(userId, { roles: userData.roles });

      return res.json({
        message: 'User profile updated successfully',
        user: {
          uid: userId,
          ...existingUser.data(),
          ...updateData
        }
      });
    } else {
      // Create new profile
      await db.collection('users').doc(userId).set(userData);

      // Set custom claims for roles
      const { setCustomClaims } = require('../config/firebase');
      await setCustomClaims(userId, { roles: userData.roles });

      return res.status(201).json({
        message: 'User profile created successfully',
        user: {
          uid: userId,
          ...userData
        }
      });
    }
  } catch (error) {
    console.error('Error creating user profile:', error);
    res.status(500).json({ error: 'Failed to create user profile' });
  }
});

// Update user profile
router.put('/profile', verifyToken, async (req, res) => {
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

    const userId = req.user.uid;
    
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
      message: 'User profile updated successfully',
      updated: updateData
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
});

module.exports = router;
