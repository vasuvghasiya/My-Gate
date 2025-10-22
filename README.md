# MyGate Community App

A comprehensive community management application with AI-powered visitor management, real-time notifications, and role-based access control.

## Architecture Overview

### Core Components
- **Frontend**: React with TypeScript, Firebase Auth, Material-UI
- **Backend**: Node.js with Express, Firebase Admin SDK, OpenAI API
- **Database**: Firestore with security rules
- **Notifications**: Firebase Cloud Messaging (FCM)
- **AI**: OpenAI GPT-4o mini with tool calling

### User Roles & Permissions

| Role | Permissions |
|------|-------------|
| **Resident** | Create visitors for own household, approve/deny visitors, view own visitor history |
| **Guard** | Check-in/check-out approved visitors, view all visitors at gate |
| **Admin/Committee** | Full access to all visitors, manage users and households, view analytics |

### AI Tools Available
- `approve_visitor(visitorId: string)` - Approve a pending visitor
- `deny_visitor(visitorId: string, reason?: string)` - Deny a visitor with optional reason
- `checkin_visitor(visitorId: string)` - Check-in an approved visitor (guard only)
- `checkout_visitor(visitorId: string)` - Check-out a visitor (guard only)

## Quick Start

### Prerequisites
- Node.js 18+
- Firebase project with Auth, Firestore, and FCM enabled
- OpenAI API key

### Setup
```bash
# Clone and install dependencies
git clone <repo-url>
cd mygate-community-app
npm run setup

# Configure environment variables
cp server/.env.example server/.env
# Edit server/.env with your Firebase and OpenAI credentials

cp client/.env.example client/.env
# Edit client/.env with your Firebase config

# Start development servers
npm run dev
```

### Environment Variables

**Server (.env):**
```
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your_service_account_email
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key
PORT=3001
NODE_ENV=development

```

**Client (.env):**
```
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_API_BASE_URL=http://localhost:3001

```

## API Endpoints

### Authentication
- `POST /auth/verify` - Verify Firebase ID token

### Visitor Management
- `POST /api/visitors` - Create visitor (resident)
- `PUT /api/visitors/:id/approve` - Approve visitor (resident/admin)
- `PUT /api/visitors/:id/deny` - Deny visitor (resident/admin)
- `PUT /api/visitors/:id/checkin` - Check-in visitor (guard)
- `PUT /api/visitors/:id/checkout` - Check-out visitor (guard)
- `GET /api/visitors` - List visitors (role-based filtering)

### AI Chat
- `POST /api/chat` - Chat with AI copilot

### Notifications
- `POST /api/notify` - Send push notification

## Security

### Firestore Security Rules
- Residents can only manage visitors for their household
- Guards can only transition approved visitors to checked-in/out
- Admins have full access to all data
- All operations require valid authentication

### Server-side Validation
- Every API call validates Firebase ID token
- Role-based authorization on all endpoints
- State machine validation for visitor transitions
- AI tool calls are validated before execution

## Cost Estimation

### OpenAI API
- GPT-4o mini: ~$0.00015 per 1K input tokens, $0.0006 per 1K output tokens
- Estimated monthly cost for 1000 conversations: $5-10

### Firebase
- Firestore: Free tier covers most small-medium communities
- FCM: Free for unlimited messages
- Auth: Free for unlimited users

## Demo Flow
1. Login as resident → Create visitor "Ramesh"
2. Chat: "approve Ramesh" → AI tool call → Visitor approved
3. Push notification sent → Guard receives notification
4. Guard checks in visitor → Status updated
5. Audit events logged throughout process
