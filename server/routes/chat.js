const express = require('express');
const { verifyToken } = require('../middleware/auth');
const Joi = require('joi');

// Dynamically import AI service based on environment variable
const getAIService = () => {
  const provider = process.env.AI_PROVIDER || 'simple';
  
  switch (provider) {
    case 'openai':
      return require('../services/ai');
    case 'huggingface':
    case 'cohere':
      return require('../services/ai-free');
    case 'simple':
    default:
      return require('../services/ai-simple');
  }
};

const router = express.Router();

// Schema for chat message
const chatMessageSchema = Joi.object({
  message: Joi.string().required().max(1000)
});

// Chat endpoint
router.post('/', verifyToken, async (req, res) => {
  try {
    const { error, value } = chatMessageSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.user.uid;
    const userRoles = req.user.roles || [];
    
    // Get the appropriate AI service based on environment configuration
    const aiService = getAIService();
    const { processChatMessage } = aiService;
    
    // Process the chat message with AI
    const result = await processChatMessage(value.message, userId, userRoles);
    
    res.json({
      message: result.message,
      toolCalls: result.toolCalls,
      toolResults: result.toolResults,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error processing chat message:', error?.response?.data || error?.message || error);
    return res.status(502).json({ 
      error: 'AI gateway error',
      message: "I'm having trouble with the AI service right now. Please try again shortly."
    });
  }
});

// Get chat history (optional feature)
router.get('/history', verifyToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { getDb } = require('../config/firebase');
    const db = getDb();
    
    const limit = parseInt(req.query.limit) || 20;
    
    const snapshot = await db.collection('chat_history')
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    
    const messages = [];
    snapshot.forEach(doc => {
      messages.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    res.json({ messages: messages.reverse() }); // Return in chronological order
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// Save chat message to history (optional feature)
router.post('/save', verifyToken, async (req, res) => {
  try {
    const saveMessageSchema = Joi.object({
      message: Joi.string().required(),
      response: Joi.string().required(),
      toolCalls: Joi.array().optional()
    });
    
    const { error, value } = saveMessageSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.user.uid;
    const { getDb } = require('../config/firebase');
    const db = getDb();
    
    const chatMessage = {
      userId,
      message: value.message,
      response: value.response,
      toolCalls: value.toolCalls || [],
      timestamp: new Date()
    };
    
    await db.collection('chat_history').add(chatMessage);
    
    res.json({ message: 'Chat message saved successfully' });
  } catch (error) {
    console.error('Error saving chat message:', error);
    res.status(500).json({ error: 'Failed to save chat message' });
  }
});

module.exports = router;
