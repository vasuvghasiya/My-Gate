# MyGate Community App - Setup Guide

## Prerequisites

- Node.js 18+ installed
- Firebase project with the following services enabled:
  - Authentication (Email/Password)
  - Firestore Database
  - Cloud Messaging (FCM)
- OpenAI API key
- Git installed

## Step 1: Firebase Setup

### 1.1 Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name: `mygate-community`
4. Enable Google Analytics (optional)
5. Create project

### 1.2 Enable Authentication
1. In Firebase Console, go to "Authentication" → "Sign-in method"
2. Enable "Email/Password" provider
3. Save changes

### 1.3 Create Firestore Database
1. Go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (we'll add security rules later)
4. Select a location close to your users
5. Create database

### 1.4 Enable Cloud Messaging
1. Go to "Project Settings" → "Cloud Messaging"
2. Note down the "Sender ID" and "Server Key"

### 1.5 Generate Service Account
1. Go to "Project Settings" → "Service Accounts"
2. Click "Generate new private key"
3. Download the JSON file
4. Keep this file secure - it contains your service account credentials

### 1.6 Get Web App Config
1. Go to "Project Settings" → "General"
2. Scroll down to "Your apps"
3. Click the web icon (`</>`) to add a web app
4. Register app with name: `MyGate Web App`
5. Copy the Firebase configuration object

## Step 2: OpenAI Setup

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create an account or sign in
3. Go to "API Keys" section
4. Create a new API key
5. Copy the key (starts with `sk-`)

## Step 3: Project Setup

### 3.1 Clone and Install
```bash
# Clone the repository
git clone <your-repo-url>
cd mygate-community-app

# Install root dependencies
npm install

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install

# Go back to root
cd ..
```

### 3.2 Environment Configuration

#### Server Environment (.env)
Create `server/.env` file:
```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40your-project.iam.gserviceaccount.com
OPENAI_API_KEY=sk-your-openai-api-key
PORT=3001
NODE_ENV=development
```

#### Client Environment (.env)
Create `client/.env` file:
```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_VAPID_KEY=your-vapid-key
VITE_API_BASE_URL=http://localhost:3001
```

### 3.3 Deploy Firestore Security Rules
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login to Firebase: `firebase login`
3. Initialize Firebase in project root: `firebase init firestore`
4. Deploy rules: `firebase deploy --only firestore:rules`

## Step 4: Database Seeding

### 4.1 Seed Initial Data
```bash
cd server
npm run seed
```

This will create:
- 2 sample households
- 3 users with different roles (resident, guard, admin)
- Sample visitors
- Audit events
- Sample amenities

### 4.2 Verify Setup
Check that the following collections exist in Firestore:
- `users`
- `households`
- `visitors`
- `audit_events`
- `amenities`

## Step 5: Start the Application

### 5.1 Development Mode
```bash
# From project root
npm run dev
```

This starts both server (port 3001) and client (port 3000).

### 5.2 Production Build
```bash
# Build client
cd client
npm run build

# Start server
cd ../server
npm start
```

## Step 6: Testing the Application

### 6.1 Access the Application
- Open browser to `http://localhost:3000`
- You should see the login page

### 6.2 Test Accounts
Use these pre-created accounts:
- **Resident**: `resident@example.com` / `password123`
- **Guard**: `guard@example.com` / `password123`
- **Admin**: `admin@example.com` / `password123`

### 6.3 Test Workflow
1. Login as resident
2. Create a visitor
3. Login as admin and approve the visitor
4. Login as guard and check in the visitor
5. Use AI chat to manage visitors

## Step 7: API Testing

### 7.1 Import Postman Collection
1. Open Postman
2. Import the `MyGate_API.postman_collection.json` file
3. Set the `firebase_token` variable with a valid Firebase ID token

### 7.2 Test API Endpoints
1. Start with `/auth/verify` to test authentication
2. Test visitor management endpoints
3. Test AI chat functionality
4. Test notification endpoints

## Step 8: Push Notifications Setup

### 8.1 Configure FCM
1. In Firebase Console, go to "Cloud Messaging"
2. Generate a new server key if needed
3. Update server environment with the key

### 8.2 Test Notifications
1. Login to the web app
2. Allow notification permissions
3. Create a visitor to trigger notifications
4. Check browser console for FCM messages

## Troubleshooting

### Common Issues

#### 1. Firebase Authentication Errors
- Verify Firebase project ID is correct
- Check that Authentication is enabled
- Ensure service account has proper permissions

#### 2. Firestore Permission Errors
- Verify security rules are deployed
- Check that users have proper custom claims
- Ensure database is in production mode

#### 3. OpenAI API Errors
- Verify API key is correct
- Check OpenAI account has sufficient credits
- Ensure API key has proper permissions

#### 4. CORS Errors
- Check that client URL is allowed in server CORS settings
- Verify environment variables are correct

#### 5. Build Errors
- Ensure Node.js version is 18+
- Clear node_modules and reinstall
- Check for TypeScript errors

### Debug Mode
Enable debug logging by setting:
```env
NODE_ENV=development
DEBUG=mygate:*
```

## Security Considerations

### Production Deployment
1. Use environment variables for all secrets
2. Enable Firestore security rules
3. Use HTTPS in production
4. Implement rate limiting
5. Set up monitoring and logging
6. Regular security updates

### Firebase Security
1. Restrict service account permissions
2. Use Firebase App Check
3. Implement proper security rules
4. Monitor authentication logs

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review Firebase and OpenAI documentation
3. Check application logs
4. Verify environment configuration

## Next Steps

### Plus Features (Extra Credit)
1. **Amenity Bookings**: Implement QR code generation
2. **PWA Guard Kiosk**: Add offline support
3. **Multi-step AI Tools**: Enhance chat functionality
4. **Analytics Dashboard**: Add SLA monitoring
5. **Internationalization**: Add multi-language support
6. **Accessibility**: Improve screen reader support

### Production Deployment
1. Set up CI/CD pipeline
2. Configure monitoring and alerting
3. Implement backup strategies
4. Set up staging environment
5. Performance optimization
6. Security hardening
