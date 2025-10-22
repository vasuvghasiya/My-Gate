// Simple Rule-Based AI Chat System
// No external API required - works completely offline!

// AI Tools/Functions (same as other versions)
const aiTools = [
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
];

const processChatMessage = async (message, userId, userRoles) => {
  try {
    console.log(`🤖 Processing message: "${message}" for user ${userId} with roles: ${userRoles.join(', ')}`);
    
    // Get user context
    const userContext = await getUserContext(userId, userRoles);
    
    // Parse the message to extract intent and parameters
    const parsedIntent = parseMessage(message, userRoles);
    console.log(`📋 Parsed intent:`, parsedIntent);
    
    if (parsedIntent && parsedIntent.action) {
      // Execute the action
      const toolResult = await executeAction(parsedIntent.action, parsedIntent.parameters, userId, userRoles);
      
      return {
        message: parsedIntent.message || toolResult.message || `Executed ${parsedIntent.action} successfully`,
        toolCalls: [{
          id: Date.now().toString(),
          type: "function",
          function: {
            name: parsedIntent.action,
            arguments: JSON.stringify(parsedIntent.parameters)
          }
        }],
        toolResults: [{
          tool_call_id: Date.now().toString(),
          result: JSON.stringify(toolResult)
        }]
      };
    }

    // Handle general queries
    return {
      message: generateResponse(message, userRoles, userContext),
      toolCalls: null,
      toolResults: null
    };
  } catch (error) {
    console.error('Error processing chat message:', error);
    throw new Error('Failed to process chat message');
  }
};

// Simple message parsing using keyword matching
const parseMessage = (message, userRoles) => {
  const lowerMessage = message.toLowerCase();
  
  // Approve visitor patterns - improved to catch more names
  if (lowerMessage.includes('approve')) {
    const nameMatch = message.match(/(?:approve|approve\s+visitor)\s+(\w+)/i);
    const visitorId = nameMatch ? nameMatch[1] : 'unknown_visitor';
    
    return {
      action: 'approve_visitor',
      parameters: { visitorId: visitorId },
      message: `Approving visitor ${visitorId}...`
    };
  }
  
  // Deny visitor patterns - improved to catch more names
  if (lowerMessage.includes('deny')) {
    const nameMatch = message.match(/(?:deny|deny\s+visitor)\s+(\w+)/i);
    const reasonMatch = message.match(/reason\s+['"]([^'"]+)['"]|with\s+reason\s+['"]([^'"]+)['"]|because\s+(.+)/i);
    
    const visitorId = nameMatch ? nameMatch[1] : 'unknown_visitor';
    const reason = reasonMatch ? (reasonMatch[1] || reasonMatch[2] || reasonMatch[3]) : 'No reason provided';
    
    return {
      action: 'deny_visitor',
      parameters: { visitorId: visitorId, reason: reason },
      message: `Denying visitor ${visitorId} with reason: ${reason}`
    };
  }
  
  // Check in patterns (guard only)
  if (lowerMessage.includes('check') && lowerMessage.includes('in') && userRoles.includes('guard')) {
    const nameMatch = message.match(/(?:check\s+in|checkin)\s+(\w+)/i);
    const visitorId = nameMatch ? nameMatch[1] : 'unknown_visitor';
    
    return {
      action: 'checkin_visitor',
      parameters: { visitorId: visitorId },
      message: `Checking in visitor ${visitorId}...`
    };
  }
  
  // Check out patterns (guard only)
  if (lowerMessage.includes('check') && lowerMessage.includes('out') && userRoles.includes('guard')) {
    const nameMatch = message.match(/(?:check\s+out|checkout)\s+(\w+)/i);
    const visitorId = nameMatch ? nameMatch[1] : 'unknown_visitor';
    
    return {
      action: 'checkout_visitor',
      parameters: { visitorId: visitorId },
      message: `Checking out visitor ${visitorId}...`
    };
  }
  
  // Find visitor by name patterns
  if (lowerMessage.includes('find') || lowerMessage.includes('search')) {
    const nameMatch = message.match(/(?:find|search)\s+(\w+)/i);
    const visitorName = nameMatch ? nameMatch[1] : null;
    
    if (visitorName) {
      return {
        action: 'find_visitor_by_name',
        parameters: { name: visitorName },
        message: `Searching for visitor named ${visitorName}...`
      };
    }
  }
  
  // Get visitors patterns
  if (lowerMessage.includes('show') || lowerMessage.includes('list') || lowerMessage.includes('get')) {
    let status = null;
    if (lowerMessage.includes('pending')) status = 'pending';
    else if (lowerMessage.includes('approved')) status = 'approved';
    else if (lowerMessage.includes('denied')) status = 'denied';
    else if (lowerMessage.includes('checked in')) status = 'checked_in';
    else if (lowerMessage.includes('checked out')) status = 'checked_out';
    
    return {
      action: 'get_visitors',
      parameters: { status: status, limit: 10 },
      message: `Getting visitors${status ? ` with status: ${status}` : ''}...`
    };
  }
  
  return null; // No action found
};

// Generate contextual responses
const generateResponse = (message, userRoles, userContext) => {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
    return `Hello! I'm your MyGate AI assistant. I can help you manage visitors. As a ${userRoles.join(' and ')}, you can:
    ${userRoles.includes('resident') ? '• Approve or deny visitors for your household' : ''}
    ${userRoles.includes('guard') ? '• Check in/out visitors' : ''}
    ${userRoles.includes('admin') ? '• Manage all visitors and operations' : ''}
    
    Try saying: "approve Ramesh", "deny John with reason not expected", or "show me pending visitors"`;
  }
  
  if (lowerMessage.includes('help')) {
    return `I can help you with visitor management! Here are some commands you can try:
    
    **For Residents & Admins:**
    • "approve [visitor name]" - Approve a visitor
    • "deny [visitor name] with reason [reason]" - Deny a visitor
    • "show me pending visitors" - List pending visitors
    
    **For Guards & Admins:**
    • "check in [visitor name]" - Check in a visitor
    • "check out [visitor name]" - Check out a visitor
    • "show me approved visitors" - List approved visitors
    
    **Find Visitors:**
    • "find [visitor name]" - Search for a specific visitor
    • "search [visitor name]" - Search for a specific visitor
    
    **General:**
    • "show me all visitors" - List all visitors
    • "help" - Show this help message`;
  }
  
  return `I understand you want help with visitor management. Try saying:
  • "approve Ramesh" to approve a visitor
  • "deny John with reason not expected" to deny a visitor
  • "show me pending visitors" to see pending visitors
  • "help" for more commands`;
};

const executeAction = async (actionName, parameters, userId, userRoles) => {
  switch (actionName) {
    case 'approve_visitor':
      return await approveVisitor(parameters.visitorId, userId, userRoles);
      
    case 'deny_visitor':
      return await denyVisitor(parameters.visitorId, parameters.reason, userId, userRoles);
      
    case 'checkin_visitor':
      return await checkinVisitor(parameters.visitorId, userId, userRoles);
      
    case 'checkout_visitor':
      return await checkoutVisitor(parameters.visitorId, userId, userRoles);
      
    case 'get_visitors':
      return await getVisitors(parameters, userId, userRoles);
      
    case 'find_visitor_by_name':
      return await findVisitorByName(parameters.name, userId, userRoles);
      
    default:
      return { error: `Unknown action: ${actionName}` };
  }
};

// Tool implementations (same as other versions)
const approveVisitor = async (visitorId, userId, userRoles) => {
  try {
    console.log(`🔍 approveVisitor called with visitorId: "${visitorId}", userId: ${userId}, userRoles: ${userRoles.join(', ')}`);
    
    const { getDb } = require('../config/firebase');
    const { sendNotification } = require('./notifications');
    const { logAuditEvent } = require('./audit');
    
    const db = getDb();
    
    if (!db) {
      // Demo mode - find visitor by name
      const mockVisitors = [
        { id: 'visitor_1', name: 'Vasu', phone: '9876543210', purpose: 'Meeting', status: 'pending', createdAt: new Date() },
        { id: 'visitor_2', name: 'Ramesh', phone: '9876543211', purpose: 'Delivery', status: 'approved', createdAt: new Date() },
        { id: 'visitor_3', name: 'John', phone: '9876543212', purpose: 'Visit', status: 'pending', createdAt: new Date() },
        { id: 'visitor_4', name: 'Priya', phone: '9876543213', purpose: 'Service', status: 'checked_in', createdAt: new Date() },
        { id: 'visitor_5', name: 'Amit', phone: '9876543214', purpose: 'Guest', status: 'denied', createdAt: new Date() }
      ];
      
      // Find visitor by name (case insensitive and flexible matching)
      console.log(`🔍 Looking for visitor: "${visitorId}" in mock visitors:`, mockVisitors.map(v => v.name));
      const visitor = mockVisitors.find(v => 
        v.name.toLowerCase() === visitorId.toLowerCase() ||
        v.name.toLowerCase().includes(visitorId.toLowerCase()) ||
        visitorId.toLowerCase().includes(v.name.toLowerCase())
      );
      
      console.log(`🔍 Found visitor:`, visitor);
      
      if (!visitor) {
        const availableNames = mockVisitors.map(v => v.name).join(', ');
        console.log(`❌ Visitor "${visitorId}" not found. Available: ${availableNames}`);
        return { error: `Visitor "${visitorId}" not found. Available visitors: ${availableNames}` };
      }
      
      if (visitor.status !== 'pending') {
        console.log(`❌ Visitor "${visitor.name}" is not in pending status. Current status: ${visitor.status}`);
        return { error: `Visitor "${visitor.name}" is not in pending status. Current status: ${visitor.status}` };
      }
      
      console.log(`✅ Successfully found and would approve visitor "${visitor.name}" (ID: ${visitor.id})`);
      return { success: true, message: `Demo: Would approve visitor "${visitor.name}" (ID: ${visitor.id})` };
    }

    // Real Firebase mode - search visitors by name
    console.log(`🔍 Looking for visitor: "${visitorId}" in Firebase database`);
    
    // Get all visitors and search by name
    const visitorsSnapshot = await db.collection('visitors').get();
    const allVisitors = [];
    
    visitorsSnapshot.forEach(doc => {
      const data = doc.data();
      allVisitors.push({
        id: doc.id,
        name: data.name,
        phone: data.phone,
        purpose: data.purpose,
        status: data.status,
        createdAt: data.createdAt
      });
    });
    
    console.log(`🔍 Available visitors in database:`, allVisitors.map(v => v.name));
    
    // Find visitor by name (case insensitive and flexible matching)
    const visitor = allVisitors.find(v => 
      v.name.toLowerCase() === visitorId.toLowerCase() ||
      v.name.toLowerCase().includes(visitorId.toLowerCase()) ||
      visitorId.toLowerCase().includes(v.name.toLowerCase())
    );
    
    console.log(`🔍 Found visitor:`, visitor);
    
    if (!visitor) {
      const availableNames = allVisitors.map(v => v.name).join(', ');
      console.log(`❌ Visitor "${visitorId}" not found. Available: ${availableNames}`);
      return { error: `Visitor "${visitorId}" not found. Available visitors: ${availableNames}` };
    }

    // Check if visitor is in pending status
    if (visitor.status !== 'pending') {
      console.log(`❌ Visitor "${visitor.name}" is not in pending status. Current status: ${visitor.status}`);
      return { error: `Visitor "${visitor.name}" is not in pending status. Current status: ${visitor.status}` };
    }

    // Check permissions
    if (!userRoles.includes('resident') && !userRoles.includes('admin')) {
      return { error: 'Insufficient permissions to approve visitors' };
    }

    // Update visitor status to approved
    await db.collection('visitors').doc(visitor.id).update({
      status: 'approved',
      approvedAt: new Date(),
      approvedBy: userId,
      updatedAt: new Date()
    });

    console.log(`✅ Successfully approved visitor "${visitor.name}" (ID: ${visitor.id})`);
    return { 
      success: true, 
      message: `Successfully approved visitor "${visitor.name}"`,
      updatedVisitor: {
        id: visitor.id,
        name: visitor.name,
        status: 'approved'
      }
    };
  } catch (error) {
    console.error('Error in approveVisitor:', error);
    return { success: true, message: `Demo: Would approve visitor ${visitorId}` };
  }
};

const denyVisitor = async (visitorId, reason, userId, userRoles) => {
  try {
    const { getDb } = require('../config/firebase');
    const { sendNotification } = require('./notifications');
    const { logAuditEvent } = require('./audit');
    
    const db = getDb();
    
    if (!db) {
      // Demo mode - find visitor by name
      const mockVisitors = [
        { id: 'visitor_1', name: 'Vasu', phone: '9876543210', purpose: 'Meeting', status: 'pending', createdAt: new Date() },
        { id: 'visitor_2', name: 'Ramesh', phone: '9876543211', purpose: 'Delivery', status: 'approved', createdAt: new Date() },
        { id: 'visitor_3', name: 'John', phone: '9876543212', purpose: 'Visit', status: 'pending', createdAt: new Date() },
        { id: 'visitor_4', name: 'Priya', phone: '9876543213', purpose: 'Service', status: 'checked_in', createdAt: new Date() },
        { id: 'visitor_5', name: 'Amit', phone: '9876543214', purpose: 'Guest', status: 'denied', createdAt: new Date() }
      ];
      
      // Find visitor by name (case insensitive and flexible matching)
      const visitor = mockVisitors.find(v => 
        v.name.toLowerCase() === visitorId.toLowerCase() ||
        v.name.toLowerCase().includes(visitorId.toLowerCase()) ||
        visitorId.toLowerCase().includes(v.name.toLowerCase())
      );
      
      if (!visitor) {
        return { error: `Visitor "${visitorId}" not found. Available visitors: ${mockVisitors.map(v => v.name).join(', ')}` };
      }
      
      if (visitor.status !== 'pending') {
        return { error: `Visitor "${visitor.name}" is not in pending status. Current status: ${visitor.status}` };
      }
      
      return { success: true, message: `Demo: Would deny visitor "${visitor.name}" (ID: ${visitor.id}) with reason: ${reason}` };
    }
  
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
  } catch (error) {
    console.error('Error in denyVisitor:', error);
    return { success: true, message: `Demo: Would deny visitor ${visitorId} with reason: ${reason}` };
  }
};

const checkinVisitor = async (visitorId, userId, userRoles) => {
  try {
    const { getDb } = require('../config/firebase');
    const { sendNotification } = require('./notifications');
    const { logAuditEvent } = require('./audit');
    
    const db = getDb();
    
    if (!db) {
      // Demo mode - find visitor by name
      const mockVisitors = [
        { id: 'visitor_1', name: 'Vasu', phone: '9876543210', purpose: 'Meeting', status: 'pending', createdAt: new Date() },
        { id: 'visitor_2', name: 'Ramesh', phone: '9876543211', purpose: 'Delivery', status: 'approved', createdAt: new Date() },
        { id: 'visitor_3', name: 'John', phone: '9876543212', purpose: 'Visit', status: 'pending', createdAt: new Date() },
        { id: 'visitor_4', name: 'Priya', phone: '9876543213', purpose: 'Service', status: 'checked_in', createdAt: new Date() },
        { id: 'visitor_5', name: 'Amit', phone: '9876543214', purpose: 'Guest', status: 'denied', createdAt: new Date() }
      ];
      
      // Find visitor by name (case insensitive and flexible matching)
      const visitor = mockVisitors.find(v => 
        v.name.toLowerCase() === visitorId.toLowerCase() ||
        v.name.toLowerCase().includes(visitorId.toLowerCase()) ||
        visitorId.toLowerCase().includes(v.name.toLowerCase())
      );
      
      if (!visitor) {
        return { error: `Visitor "${visitorId}" not found. Available visitors: ${mockVisitors.map(v => v.name).join(', ')}` };
      }
      
      if (visitor.status !== 'approved') {
        return { error: `Visitor "${visitor.name}" must be approved before check-in. Current status: ${visitor.status}` };
      }
      
      return { success: true, message: `Demo: Would check in visitor "${visitor.name}" (ID: ${visitor.id})` };
    }

    // Real Firebase mode - search visitors by name
    console.log(`🔍 Looking for visitor: "${visitorId}" in Firebase database for check-in`);
    
    // Get all visitors and search by name
    const visitorsSnapshot = await db.collection('visitors').get();
    const allVisitors = [];
    
    visitorsSnapshot.forEach(doc => {
      const data = doc.data();
      allVisitors.push({
        id: doc.id,
        name: data.name,
        phone: data.phone,
        purpose: data.purpose,
        status: data.status,
        createdAt: data.createdAt
      });
    });
    
    console.log(`🔍 Available visitors in database:`, allVisitors.map(v => v.name));
    
    // Find visitor by name (case insensitive and flexible matching)
    const visitor = allVisitors.find(v => 
      v.name.toLowerCase() === visitorId.toLowerCase() ||
      v.name.toLowerCase().includes(visitorId.toLowerCase()) ||
      visitorId.toLowerCase().includes(v.name.toLowerCase())
    );
    
    console.log(`🔍 Found visitor:`, visitor);
    
    if (!visitor) {
      const availableNames = allVisitors.map(v => v.name).join(', ');
      console.log(`❌ Visitor "${visitorId}" not found. Available: ${availableNames}`);
      return { error: `Visitor "${visitorId}" not found. Available visitors: ${availableNames}` };
    }

    // Check if visitor is in approved status
    if (visitor.status !== 'approved') {
      console.log(`❌ Visitor "${visitor.name}" must be approved before check-in. Current status: ${visitor.status}`);
      return { error: `Visitor "${visitor.name}" must be approved before check-in. Current status: ${visitor.status}` };
    }

    // Check permissions (guard or admin only)
    if (!userRoles.includes('guard') && !userRoles.includes('admin')) {
      return { error: 'Only guards can check in visitors' };
    }

    // Update visitor status to checked in
    await db.collection('visitors').doc(visitor.id).update({
      status: 'checked_in',
      checkedInAt: new Date(),
      checkedInBy: userId,
      updatedAt: new Date()
    });

    console.log(`✅ Successfully checked in visitor "${visitor.name}" (ID: ${visitor.id})`);
    return { 
      success: true, 
      message: `Successfully checked in visitor "${visitor.name}"`,
      updatedVisitor: {
        id: visitor.id,
        name: visitor.name,
        status: 'checked_in'
      }
    };
  
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
  } catch (error) {
    console.error('Error in checkinVisitor:', error);
    return { success: true, message: `Demo: Would check in visitor ${visitorId}` };
  }
};

const checkoutVisitor = async (visitorId, userId, userRoles) => {
  try {
    const { getDb } = require('../config/firebase');
    const { sendNotification } = require('./notifications');
    const { logAuditEvent } = require('./audit');
    
    const db = getDb();
    
    if (!db) {
      return { success: true, message: `Demo: Would check out visitor ${visitorId}` };
    }

    // Real Firebase mode - search visitors by name
    console.log(`🔍 Looking for visitor: "${visitorId}" in Firebase database for check-out`);
    
    // Get all visitors and search by name
    const visitorsSnapshot = await db.collection('visitors').get();
    const allVisitors = [];
    
    visitorsSnapshot.forEach(doc => {
      const data = doc.data();
      allVisitors.push({
        id: doc.id,
        name: data.name,
        phone: data.phone,
        purpose: data.purpose,
        status: data.status,
        createdAt: data.createdAt
      });
    });
    
    console.log(`🔍 Available visitors in database:`, allVisitors.map(v => v.name));
    
    // Find visitor by name (case insensitive and flexible matching)
    const visitor = allVisitors.find(v => 
      v.name.toLowerCase() === visitorId.toLowerCase() ||
      v.name.toLowerCase().includes(visitorId.toLowerCase()) ||
      visitorId.toLowerCase().includes(v.name.toLowerCase())
    );
    
    console.log(`🔍 Found visitor:`, visitor);
    
    if (!visitor) {
      const availableNames = allVisitors.map(v => v.name).join(', ');
      console.log(`❌ Visitor "${visitorId}" not found. Available: ${availableNames}`);
      return { error: `Visitor "${visitorId}" not found. Available visitors: ${availableNames}` };
    }

    // Check if visitor is in checked_in status
    if (visitor.status !== 'checked_in') {
      console.log(`❌ Visitor "${visitor.name}" must be checked in before check-out. Current status: ${visitor.status}`);
      return { error: `Visitor "${visitor.name}" must be checked in before check-out. Current status: ${visitor.status}` };
    }

    // Check permissions (guard or admin only)
    if (!userRoles.includes('guard') && !userRoles.includes('admin')) {
      return { error: 'Only guards can check out visitors' };
    }

    // Update visitor status to checked out
    await db.collection('visitors').doc(visitor.id).update({
      status: 'checked_out',
      checkedOutAt: new Date(),
      checkedOutBy: userId,
      updatedAt: new Date()
    });

    console.log(`✅ Successfully checked out visitor "${visitor.name}" (ID: ${visitor.id})`);
    return { 
      success: true, 
      message: `Successfully checked out visitor "${visitor.name}"`,
      updatedVisitor: {
        id: visitor.id,
        name: visitor.name,
        status: 'checked_out'
      }
    };
  
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
  } catch (error) {
    console.error('Error in checkoutVisitor:', error);
    return { success: true, message: `Demo: Would check out visitor ${visitorId}` };
  }
};

const getVisitors = async (params, userId, userRoles) => {
  try {
    const { getDb } = require('../config/firebase');
    
    const db = getDb();
    
    if (!db) {
      // Demo mode - return mock visitors
      const mockVisitors = [
        { id: 'visitor_1', name: 'Vasu', phone: '9876543210', purpose: 'Meeting', status: 'pending', createdAt: new Date() },
        { id: 'visitor_2', name: 'Ramesh', phone: '9876543211', purpose: 'Delivery', status: 'approved', createdAt: new Date() },
        { id: 'visitor_3', name: 'John', phone: '9876543212', purpose: 'Visit', status: 'pending', createdAt: new Date() },
        { id: 'visitor_4', name: 'Priya', phone: '9876543213', purpose: 'Service', status: 'checked_in', createdAt: new Date() },
        { id: 'visitor_5', name: 'Amit', phone: '9876543214', purpose: 'Guest', status: 'denied', createdAt: new Date() }
      ];
      
      let filteredVisitors = mockVisitors;
      
      // Apply status filter if specified
      if (params.status) {
        filteredVisitors = mockVisitors.filter(v => v.status === params.status);
      }
      
      // Apply limit
      const limit = params.limit || 10;
      filteredVisitors = filteredVisitors.slice(0, limit);
      
      return { visitors: filteredVisitors };
    }

    // Real Firebase mode - get visitors from database
    console.log(`🔍 Getting visitors from Firebase database with status: ${params.status || 'all'}`);
    
    // Get all visitors first (to avoid index issues)
    const allVisitorsSnapshot = await db.collection('visitors').get();
    const allVisitors = [];
    
    allVisitorsSnapshot.forEach(doc => {
      const data = doc.data();
      allVisitors.push({
        id: doc.id,
        name: data.name,
        phone: data.phone,
        purpose: data.purpose,
        status: data.status,
        createdAt: data.createdAt
      });
    });
    
    let filteredVisitors = allVisitors;
    
    // Apply status filter if specified
    if (params.status) {
      filteredVisitors = allVisitors.filter(v => v.status === params.status);
    }
    
    // Apply limit
    const limit = params.limit || 10;
    filteredVisitors = filteredVisitors.slice(0, limit);
    
    console.log(`🔍 Found ${filteredVisitors.length} visitors in database`);
    return { visitors: filteredVisitors };
  } catch (error) {
    console.error('Error in getVisitors:', error);
    return { visitors: [] };
  }
};

const findVisitorByName = async (name, userId, userRoles) => {
  try {
    const { getDb } = require('../config/firebase');
    
    const db = getDb();
    
    if (!db) {
      // Demo mode - search in mock visitors
      const mockVisitors = [
        { id: 'visitor_1', name: 'Vasu', phone: '9876543210', purpose: 'Meeting', status: 'pending', createdAt: new Date() },
        { id: 'visitor_2', name: 'Ramesh', phone: '9876543211', purpose: 'Delivery', status: 'approved', createdAt: new Date() },
        { id: 'visitor_3', name: 'John', phone: '9876543212', purpose: 'Visit', status: 'pending', createdAt: new Date() },
        { id: 'visitor_4', name: 'Priya', phone: '9876543213', purpose: 'Service', status: 'checked_in', createdAt: new Date() },
        { id: 'visitor_5', name: 'Amit', phone: '9876543214', purpose: 'Guest', status: 'denied', createdAt: new Date() }
      ];
      
      const foundVisitors = mockVisitors.filter(v => 
        v.name.toLowerCase() === name.toLowerCase() ||
        v.name.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(v.name.toLowerCase())
      );
      
      if (foundVisitors.length > 0) {
        return { 
          success: true, 
          visitors: foundVisitors,
          message: `Found ${foundVisitors.length} visitor(s) matching "${name}"`
        };
      } else {
        return { 
          success: false, 
          message: `No visitors found matching "${name}". Available visitors: Vasu, Ramesh, John, Priya, Amit`
        };
      }
    }
    
    // Real Firebase implementation would go here
    return { success: false, message: 'Visitor search not implemented for Firebase mode' };
  } catch (error) {
    console.error('Error in findVisitorByName:', error);
    return { success: false, message: 'Error searching for visitor' };
  }
};

const getUserContext = async (userId, userRoles) => {
  try {
    const { getDb } = require('../config/firebase');
    const db = getDb();
    
    if (!db) {
      return `Demo mode: User ${userId} with roles ${userRoles.join(', ')}`;
    }
    
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return 'User profile not found';
    }
    
    const userData = userDoc.data();
    
    // Get recent visitors for context
    let visitorQuery = db.collection('visitors');
    
    if (userRoles.includes('resident') && !userRoles.includes('admin')) {
      // Avoid composite index by not mixing where + orderBy
      visitorQuery = visitorQuery.where('hostHouseholdId', '==', userData.householdId).limit(5);
    } else {
      visitorQuery = visitorQuery.orderBy('createdAt', 'desc').limit(5);
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
    return `Demo mode: User ${userId} with roles ${userRoles.join(', ')}`;
  }
};

module.exports = {
  processChatMessage,
  aiTools
};
