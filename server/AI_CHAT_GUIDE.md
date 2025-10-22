# AI Chat System Guide

## Overview

The MyGate AI Chat System provides an intelligent assistant that can help residents, guards, and admins manage visitors through natural language commands. The system uses OpenAI's GPT models with function calling to execute specific actions based on user requests.

## Features

### 🤖 Natural Language Processing
- Understand natural language commands like "approve Ramesh", "deny with note...", "check in Mr Verma"
- Context-aware responses based on user roles and permissions
- Intelligent conversation flow with follow-up questions

### 🔧 Tool/Function Calling
The AI can execute the following actions:

#### `approve_visitor(visitorId: string)`
- **Purpose**: Approve a pending visitor
- **Roles**: `resident`, `admin`
- **Validation**: Checks if visitor exists, is in pending status, and user has permission

#### `deny_visitor(visitorId: string, reason?: string)`
- **Purpose**: Deny a pending visitor with optional reason
- **Roles**: `resident`, `admin`
- **Validation**: Checks if visitor exists, is in pending status, and user has permission

#### `checkin_visitor(visitorId: string)`
- **Purpose**: Check in an approved visitor
- **Roles**: `guard`, `admin` (guard-only action)
- **Validation**: Checks if visitor exists, is approved, and user is a guard

#### `checkout_visitor(visitorId: string)`
- **Purpose**: Check out a visitor
- **Roles**: `guard`, `admin` (guard-only action)
- **Validation**: Checks if visitor exists, is checked in, and user is a guard

#### `get_visitors(params)`
- **Purpose**: Get list of visitors with optional filtering
- **Roles**: All roles (with appropriate filtering)
- **Parameters**: `status`, `limit`

## Setup

### 1. Environment Configuration

Add your OpenAI API key to the `.env` file:

```bash
OPENAI_API_KEY=your_actual_openai_api_key_here
```

### 2. Test the System

Run the test script to verify everything is working:

```bash
npm run test-ai
```

## Usage

### API Endpoints

#### POST `/api/chat`
Send a chat message to the AI assistant.

**Request:**
```json
{
  "message": "approve visitor Ramesh"
}
```

**Response:**
```json
{
  "message": "I've approved visitor Ramesh successfully!",
  "toolCalls": [
    {
      "id": "call_123",
      "type": "function",
      "function": {
        "name": "approve_visitor",
        "arguments": "{\"visitorId\": \"visitor_456\"}"
      }
    }
  ],
  "toolResults": [
    {
      "tool_call_id": "call_123",
      "result": "{\"success\": true, \"message\": \"Visitor Ramesh approved successfully\"}"
    }
  ],
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

### Example Commands

#### For Residents:
- "Approve visitor John"
- "Deny visitor Mike with reason 'Not expected'"
- "Show me pending visitors"
- "What visitors do I have today?"

#### For Guards:
- "Check in Mr Verma"
- "Check out visitor ID 123"
- "Show me all approved visitors"
- "List visitors waiting for check-in"

#### For Admins:
- "Approve all pending visitors"
- "Show me visitor statistics"
- "Check in visitor from apartment 101"

## Security & Validation

### Role-Based Access Control
- **Residents**: Can approve/deny visitors for their household only
- **Guards**: Can check in/out visitors, view all visitors
- **Admins**: Can perform all actions on all visitors

### State Validation
The system validates visitor states before allowing transitions:
- `pending` → `approved` or `denied`
- `approved` → `checked_in`
- `checked_in` → `checked_out`

### Audit Logging
All actions are logged with:
- User ID and roles
- Timestamp
- Action performed
- Visitor ID affected
- Result of the action

## Error Handling

The system provides graceful error handling for:
- Invalid API keys
- Network issues
- Permission errors
- Invalid visitor states
- Missing visitors

## Integration with Frontend

### Chat UI Components
The system is designed to work with chat UI components that can:
- Display AI responses
- Show tool call progress
- Display tool results
- Handle errors gracefully

### Real-time Updates
Consider implementing real-time updates using:
- WebSocket connections
- Server-sent events
- Polling for status updates

## Troubleshooting

### Common Issues

1. **API Key Error**
   - Ensure your OpenAI API key is valid
   - Check that you have sufficient credits
   - Verify the key has the correct permissions

2. **Permission Errors**
   - Check user roles in the database
   - Verify visitor ownership for residents
   - Ensure guards have the correct permissions

3. **Visitor Not Found**
   - Verify visitor IDs exist in the database
   - Check visitor status before attempting actions
   - Ensure proper data relationships

### Testing

Use the test script to verify functionality:
```bash
npm run test-ai
```

This will test various scenarios including:
- Basic chat functionality
- Tool calling
- Role-based permissions
- Error handling

## Future Enhancements

Potential improvements:
- Voice input/output
- Multi-language support
- Advanced analytics
- Integration with calendar systems
- Automated visitor notifications
- Image recognition for visitor verification
