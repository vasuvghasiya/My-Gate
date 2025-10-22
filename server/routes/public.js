const express = require('express');
const { getDb } = require('../config/firebase');

const router = express.Router();
const db = getDb();

// List household IDs for signup selection
router.get('/households', async (req, res) => {
  try {
    const snapshot = await db.collection('households').get();
    const households = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ households });
  } catch (err) {
    console.error('Error listing households:', err);
    res.status(500).json({ error: 'Failed to list households' });
  }
});

// List public amenities (everyone can view)
router.get('/amenities', async (req, res) => {
  try {
    const snapshot = await db.collection('amenities').where('isActive', '==', true).get();
    const amenities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ amenities });
  } catch (err) {
    console.error('Error listing amenities:', err);
    res.status(500).json({ error: 'Failed to list amenities' });
  }
});

module.exports = router;


