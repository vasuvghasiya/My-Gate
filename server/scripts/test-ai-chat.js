#!/usr/bin/env node

/**
 * Test script for AI Chat functionality
 * Run this script to test the OpenAI-based chat system with tool calling
 * 
 * Usage: node scripts/test-ai-chat.js
 */

require('dotenv').config();
const { processChatMessage } = require('../services/ai-simple');

function checkApiKey(provider) {
  switch (provider) {
    case 'simple':
      return true; // Simple AI doesn't need API keys
    case 'huggingface':
      return process.env.HUGGINGFACE_API_KEY && 
             process.env.HUGGINGFACE_API_KEY !== 'your_huggingface_api_key_here';
    case 'openai':
      return process.env.OPENAI_API_KEY && 
             process.env.OPENAI_API_KEY !== 'your_openai_api_key_here';
    case 'cohere':
      return process.env.COHERE_API_KEY && 
             process.env.COHERE_API_KEY !== 'your_cohere_api_key_here';
    default:
      return false;
  }
}

async function testAIChat() {
  console.log('🤖 Testing AI Chat System...\n');
  
  // Check if any AI API key is set
  const provider = process.env.AI_PROVIDER || 'simple';
  const hasApiKey = checkApiKey(provider);
  
  if (!hasApiKey) {
    console.error('❌ No AI API key configured!');
    console.log('Please set up one of these AI providers:');
    console.log('1. Simple AI (No API key needed): AI_PROVIDER=simple');
    console.log('2. Hugging Face (Free): HUGGINGFACE_API_KEY=your_token_here');
    console.log('3. OpenAI Free Trial: OPENAI_API_KEY=your_key_here');
    console.log('4. Cohere Free Tier: COHERE_API_KEY=your_key_here');
    console.log('\nSee FREE_AI_SETUP_GUIDE.md for detailed instructions.\n');
    return;
  }
  
  console.log(`✅ Using ${provider.toUpperCase()} AI provider`);
  
  const testCases = [
    {
      message: "Hello, can you help me?",
      userId: "test-user-1",
      userRoles: ["resident"],
      description: "Basic greeting test"
    },
    {
      message: "Approve visitor Ramesh",
      userId: "test-user-2", 
      userRoles: ["resident"],
      description: "Test approve visitor command"
    },
    {
      message: "Deny visitor John with reason 'Not expected'",
      userId: "test-user-3",
      userRoles: ["resident"], 
      description: "Test deny visitor with reason"
    },
    {
      message: "Check in Mr Verma",
      userId: "test-user-4",
      userRoles: ["guard"],
      description: "Test check-in command (guard role)"
    },
    {
      message: "Show me pending visitors",
      userId: "test-user-5",
      userRoles: ["resident"],
      description: "Test get visitors command"
    }
  ];
  
  for (const testCase of testCases) {
    try {
      console.log(`📝 Test: ${testCase.description}`);
      console.log(`💬 Message: "${testCase.message}"`);
      console.log(`👤 User: ${testCase.userId} (${testCase.userRoles.join(', ')})`);
      
      const result = await processChatMessage(
        testCase.message, 
        testCase.userId, 
        testCase.userRoles
      );
      
      console.log(`✅ Response: ${result.message}`);
      
      if (result.toolCalls && result.toolCalls.length > 0) {
        console.log(`🔧 Tool Calls: ${result.toolCalls.length}`);
        result.toolCalls.forEach((call, index) => {
          console.log(`   ${index + 1}. ${call.function.name}(${call.function.arguments})`);
        });
      }
      
      if (result.toolResults && result.toolResults.length > 0) {
        console.log(`📊 Tool Results: ${result.toolResults.length}`);
        result.toolResults.forEach((result, index) => {
          console.log(`   ${index + 1}. ${result.result}`);
        });
      }
      
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
    
    console.log('─'.repeat(50));
  }
  
  console.log('\n🎉 AI Chat testing completed!');
  console.log('\n📋 Next steps:');
  console.log('1. Make sure your AI API key is valid');
  console.log('2. Test the chat endpoint via your API');
  console.log('3. Integrate with your frontend chat UI');
  console.log('4. Check FREE_AI_SETUP_GUIDE.md for more options');
}

// Run the test
testAIChat().catch(console.error);
