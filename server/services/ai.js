const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// AI Tools/Functions for OpenAI
const aiTools = [
  {
    type: "function",
    function: {
      name: "approve_visitor",
      description: "Approve a pending visitor",
      parameters: {
        type: "object",
        properties: {
          visitorId: {
            type: "string",
            description: "The ID of the visitor to approve"
          }
        },
        required: ["visitorId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "deny_visitor",
      description: "Deny a pending visitor with optional reason",
      parameters: {
        type: "object",
        properties: {
          visitorId: {
            type: "string",
            description: "The ID of the visitor to deny"
          },
          reason: {
            type: "string",
            description: "Optional reason for denying the visitor"
          }
        },
        required: ["visitorId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "checkin_visitor",
      description: "Check in an approved visitor (guard only)",
      parameters: {
        type: "object",
        properties: {
          visitorId: {
            type: "string",
            description: "The ID of the visitor to check in"
          }
        },
        required: ["visitorId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "checkout_visitor",
      description: "Check out a visitor (guard only)",
      parameters: {
        type: "object",
        properties: {
          visitorId: {
            type: "string",
            description: "The ID of the visitor to check out"
          }
        },
        required: ["visitorId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_visitors",
      description: "Get list of visitors with optional filtering",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            description: "Filter by visitor status (pending, approved, denied, checked_in, checked_out)",
            enum: ["pending", "approved", "denied", "checked_in", "checked_out"]
          },
          limit: {
            type: "number",
            description: "Maximum number of visitors to return (default: 10)"
          }
        }
      }
    }
  }
];

const processChatMessage = async (message, userId, userRoles) => {
  try {
    // Get user context
    const userContext = await getUserContext(userId, userRoles);
    
    const systemPrompt = `You are an AI assistant for a community management app called MyGate. 
You can help residents, guards, and admins manage visitors and community operations.

User Context:
- Roles: ${userRoles.join(', ')}
- ${userContext}

Available actions:
- Approve/deny visitors
- Check in/out visitors (guard only)
- Get visitor information
- Provide general assistance

Always be helpful, professional, and follow security guidelines. Only perform actions the user is authorized to do.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      tools: aiTools,
      tool_choice: "auto",
      temperature: 0.7,
      max_tokens: 1000
    });

    const response = completion.choices[0].message;
    
    // Process tool calls if any
    if (response.tool_calls && response.tool_calls.length > 0) {
      const toolResults = await processToolCalls(response.tool_calls, userId, userRoles);
      
      // Get follow-up response from AI with tool results
      const followUpCompletion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
          { role: "assistant", content: response.content, tool_calls: response.tool_calls },
          ...toolResults.map(result => ({
            role: "tool",
            content: result.result,
            tool_call_id: result.tool_call_id
          }))
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      return {
        message: followUpCompletion.choices[0].message.content,
        toolCalls: response.tool_calls,
        toolResults: toolResults
      };
    }

    return {
      message: response.content,
      toolCalls: null,
      toolResults: null
    };
  } catch (error) {
    console.error('Error processing chat message:', error);
    throw new Error('Failed to process chat message');
  }
};

const processToolCalls = async (toolCalls, userId, userRoles) => {
  const results = [];
  
  for (const toolCall of toolCalls) {
    try {
      const { name, arguments: args } = toolCall.function;
      const parsedArgs = JSON.parse(args);
      
      let result;
      
      switch (name) {
        case 'approve_visitor':
          result = await approveVisitor(parsedArgs.visitorId, userId, userRoles);
          break;
          
        case 'deny_visitor':
          result = await denyVisitor(parsedArgs.visitorId, parsedArgs.reason, userId, userRoles);
          break;
          
        case 'checkin_visitor':
          result = await checkinVisitor(parsedArgs.visitorId, userId, userRoles);
          break;
          
        case 'checkout_visitor':
          result = await checkoutVisitor(parsedArgs.visitorId, userId, userRoles);
          break;
          
        case 'get_visitors':
          result = await getVisitors(parsedArgs, userId, userRoles);
          break;
          
        default:
          result = { error: `Unknown tool: ${name}` };
      }
      
      results.push({
        tool_call_id: toolCall.id,
        result: JSON.stringify(result)
      });
    } catch (error) {
      console.error(`Error executing tool call ${toolCall.function.name}:`, error);
      results.push({
        tool_call_id: toolCall.id,
        result: JSON.stringify({ error: error.message })
      });
    }
  }
  
  return results;
};

// Tool implementations
const approveVisitor = async (visitorId, userId, userRoles) => {
  const { getDb } = require('../config/firebase');
  const { sendNotification } = require('./notifications');
  const { logAuditEvent } = require('./audit');
  
  const db = getDb();
  
  // Check permissions
  if (!userRoles.includes('resident') && !userRoles.includes('admin')) {
    return { error: 'Insufficient permissions to approve visitors' };
  }
  
  const visitorDoc = await db.collection('visitors').doc(visitorId).get();
  if (!visitorDoc.exists) {
    return { error: 'Visitor not found' };
  }
  
  const visitorData = visitorDoc.data();
  
  // Check if user can approve this visitor
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();
  
  if (!userRoles.includes('admin') && visitorData.hostHouseholdId !== userData.householdId) {
    return { error: 'Access denied' };
  }
  
  if (visitorData.status !== 'pending') {
    return { error: 'Visitor is not in pending status' };
  }
  
  // Approve visitor
  await db.collection('visitors').doc(visitorId).update({
    status: 'approved',
    approvedBy: userId,
    approvedAt: new Date(),
    updatedAt: new Date()
  });
  
  // Log audit event
  await logAuditEvent({
    type: 'visitor_approved',
    actorUserId: userId,
    subjectId: visitorId,
    payload: { approvedBy: userData.displayName }
  });
  
  // Send notification
  await sendNotification({
    type: 'visitor_approved',
    householdId: visitorData.hostHouseholdId,
    data: {
      visitorId,
      visitorName: visitorData.name,
      approvedBy: userData.displayName
    }
  });
  
  return { success: true, message: `Visitor ${visitorData.name} approved successfully` };
};

const denyVisitor = async (visitorId, reason, userId, userRoles) => {
  const { getDb } = require('../config/firebase');
  const { sendNotification } = require('./notifications');
  const { logAuditEvent } = require('./audit');
  
  const db = getDb();
  
  // Check permissions
  if (!userRoles.includes('resident') && !userRoles.includes('admin')) {
    return { error: 'Insufficient permissions to deny visitors' };
  }
  
  const visitorDoc = await db.collection('visitors').doc(visitorId).get();
  if (!visitorDoc.exists) {
    return { error: 'Visitor not found' };
  }
  
  const visitorData = visitorDoc.data();
  
  // Check if user can deny this visitor
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();
  
  if (!userRoles.includes('admin') && visitorData.hostHouseholdId !== userData.householdId) {
    return { error: 'Access denied' };
  }
  
  if (visitorData.status !== 'pending') {
    return { error: 'Visitor is not in pending status' };
  }
  
  // Deny visitor
  await db.collection('visitors').doc(visitorId).update({
    status: 'denied',
    deniedBy: userId,
    deniedAt: new Date(),
    reason: reason || 'No reason provided',
    updatedAt: new Date()
  });
  
  // Log audit event
  await logAuditEvent({
    type: 'visitor_denied',
    actorUserId: userId,
    subjectId: visitorId,
    payload: { deniedBy: userData.displayName, reason }
  });
  
  // Send notification
  await sendNotification({
    type: 'visitor_denied',
    householdId: visitorData.hostHouseholdId,
    data: {
      visitorId,
      visitorName: visitorData.name,
      deniedBy: userData.displayName,
      reason: reason
    }
  });
  
  return { success: true, message: `Visitor ${visitorData.name} denied successfully` };
};

const checkinVisitor = async (visitorId, userId, userRoles) => {
  const { getDb } = require('../config/firebase');
  const { sendNotification } = require('./notifications');
  const { logAuditEvent } = require('./audit');
  
  const db = getDb();
  
  // Check permissions (guard or admin only)
  if (!userRoles.includes('guard') && !userRoles.includes('admin')) {
    return { error: 'Only guards can check in visitors' };
  }
  
  const visitorDoc = await db.collection('visitors').doc(visitorId).get();
  if (!visitorDoc.exists) {
    return { error: 'Visitor not found' };
  }
  
  const visitorData = visitorDoc.data();
  
  if (visitorData.status !== 'approved') {
    return { error: 'Visitor must be approved before check-in' };
  }
  
  // Check in visitor
  await db.collection('visitors').doc(visitorId).update({
    status: 'checked_in',
    checkedInBy: userId,
    checkedInAt: new Date(),
    updatedAt: new Date()
  });
  
  // Log audit event
  await logAuditEvent({
    type: 'visitor_checked_in',
    actorUserId: userId,
    subjectId: visitorId,
    payload: {}
  });
  
  // Send notification
  await sendNotification({
    type: 'visitor_checked_in',
    householdId: visitorData.hostHouseholdId,
    data: {
      visitorId,
      visitorName: visitorData.name
    }
  });
  
  return { success: true, message: `Visitor ${visitorData.name} checked in successfully` };
};

const checkoutVisitor = async (visitorId, userId, userRoles) => {
  const { getDb } = require('../config/firebase');
  const { sendNotification } = require('./notifications');
  const { logAuditEvent } = require('./audit');
  
  const db = getDb();
  
  // Check permissions (guard or admin only)
  if (!userRoles.includes('guard') && !userRoles.includes('admin')) {
    return { error: 'Only guards can check out visitors' };
  }
  
  const visitorDoc = await db.collection('visitors').doc(visitorId).get();
  if (!visitorDoc.exists) {
    return { error: 'Visitor not found' };
  }
  
  const visitorData = visitorDoc.data();
  
  if (visitorData.status !== 'checked_in') {
    return { error: 'Visitor must be checked in before check-out' };
  }
  
  // Check out visitor
  await db.collection('visitors').doc(visitorId).update({
    status: 'checked_out',
    checkedOutBy: userId,
    checkedOutAt: new Date(),
    updatedAt: new Date()
  });
  
  // Log audit event
  await logAuditEvent({
    type: 'visitor_checked_out',
    actorUserId: userId,
    subjectId: visitorId,
    payload: {}
  });
  
  // Send notification
  await sendNotification({
    type: 'visitor_checked_out',
    householdId: visitorData.hostHouseholdId,
    data: {
      visitorId,
      visitorName: visitorData.name
    }
  });
  
  return { success: true, message: `Visitor ${visitorData.name} checked out successfully` };
};

const getVisitors = async (params, userId, userRoles) => {
  const { getDb } = require('../config/firebase');
  
  const db = getDb();
  
  let query = db.collection('visitors').orderBy('createdAt', 'desc');
  
  // Apply filters
  if (params.status) {
    query = query.where('status', '==', params.status);
  }
  
  // Check permissions and apply household filter for residents
  if (userRoles.includes('resident') && !userRoles.includes('admin')) {
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    query = query.where('hostHouseholdId', '==', userData.householdId);
  }
  
  const limit = params.limit || 10;
  query = query.limit(limit);
  
  const snapshot = await query.get();
  const visitors = [];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    visitors.push({
      id: doc.id,
      name: data.name,
      phone: data.phone,
      purpose: data.purpose,
      status: data.status,
      createdAt: data.createdAt
    });
  });
  
  return { visitors };
};

const getUserContext = async (userId, userRoles) => {
  const { getDb } = require('../config/firebase');
  
  try {
    const db = getDb();
    
    if (!db) {
      return `Demo mode - User roles: ${userRoles.join(', ')}`;
    }
    
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return 'User profile not found';
    }
    
    const userData = userDoc.data();
    
    // Get recent visitors for context
    let visitorQuery = db.collection('visitors').orderBy('createdAt', 'desc').limit(5);
    
    if (userRoles.includes('resident') && !userRoles.includes('admin')) {
      visitorQuery = visitorQuery.where('hostHouseholdId', '==', userData.householdId);
    }
    
    const visitorSnapshot = await visitorQuery.get();
    const recentVisitors = [];
    
    visitorSnapshot.forEach(doc => {
      const visitor = doc.data();
      recentVisitors.push({
        id: doc.id,
        name: visitor.name,
        status: visitor.status,
        purpose: visitor.purpose
      });
    });
    
    return `Household: ${userData.householdId || 'Unknown'}, Recent visitors: ${JSON.stringify(recentVisitors)}`;
  } catch (error) {
    console.error('Error getting user context:', error);
    return 'Unable to load user context';
  }
};

module.exports = {
  processChatMessage,
  aiTools
};
