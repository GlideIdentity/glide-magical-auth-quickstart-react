# Glide Phone Authentication Quick Start - React

## 🎯 Purpose

This quick start demonstrates **carrier-grade phone authentication** without SMS/OTP using Glide's Digital Credentials API. It shows how to:
- **Verify phone numbers** instantly through carrier networks
- **Retrieve phone numbers** securely from the device's SIM
- **Handle cross-device flows** (QR code scenarios) with proper timeouts
- **Implement silent retries** for better user experience

**Key Innovation**: Uses carrier verification instead of SMS - more secure, instant, and fraud-resistant.

## 📦 SDK Versions

This quickstart uses:
- **Backend**: `glide-sdk@5.0.0-beta.1` (Node.js) or equivalent Java/Go SDKs
- **Frontend**: `glide-web-client-sdk@^4.0.0-beta.2` (React)

## 🚀 Quick Start (5 minutes)

### Prerequisites
- **Node.js 16+** installed
- **Chrome/Edge 128+** with Digital Credentials API support
- **Glide API Key** from [Glide Dashboard](https://docs.glideapi.com/)

### Step 1: Clone & Install

```bash
git clone https://github.com/GlideIdentity/magical-auth-quickstart-react.git
cd magical-auth-quickstart-react
npm install
```

### Step 2: Configure Environment

```bash
cp env.example .env
```

Edit `.env` with your credentials:
```env
# REQUIRED - Get from Glide Dashboard
GLIDE_API_KEY=your_api_key_here
GLIDE_API_BASE_URL=https://api.glideidentity.app/magic-auth

# OPTIONAL - Debug logging
GLIDE_DEBUG=false              # Backend debug logs
VITE_GLIDE_DEBUG=false        # Frontend debug logs
```

### Step 3: Run the App

```bash
npm run dev
```

This starts:
- **Backend API**: http://localhost:3001
- **React App**: http://localhost:3000

### Step 4: Test It

1. Open http://localhost:3000
2. Click **"Get My Phone Number"** to retrieve your device's number
3. Or enter a number and click **"Verify Phone Number"** to verify ownership

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │────▶│                  │────▶│                 │
│   React App     │     │  Backend Server  │     │   Glide API     │
│                 │◀────│   (Your API)     │◀────│                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                                                  │
        │                                                  │
        └─────────────── Digital Credentials ──────────────┘
                         (Browser ↔ Carrier)
```

## 📱 What This Demonstrates

### 1. **Get Phone Number Flow**
```javascript
// Frontend calls backend
POST /api/phone-auth/prepare
{
  "use_case": "GetPhoneNumber",
  "plmn": { "mcc": "310", "mnc": "260" }  // T-Mobile USA
}

// Backend returns authentication request
{
  "authentication_strategy": "ts43",
  "session": { /* session data */ },
  "data": { /* credential request */ }
}

// Frontend invokes browser's Digital Credentials API
// User approves on device/carrier
// Frontend sends credential to backend

POST /api/phone-auth/process
{
  "response": { /* credential */ },
  "sessionInfo": { /* session */ }
}

// Backend returns verified phone number
{
  "phone_number": "+1234567890"
}
```

### 2. **Verify Phone Number Flow**
Same as above but with:
- `use_case: "VerifyPhoneNumber"`
- `phone_number: "+1234567890"` in prepare request
- Response includes `verified: true/false`

## 🔥 Key Features (New in Beta.2)

### Cross-Device Support (QR Code Flows)
- **Automatic detection** when QR code is shown
- **Extended timeout** from 30s → 120s for cross-device
- **Smart retry logic** for desktop/phone sync issues

### Silent Retry Pattern
- **Automatic retries** on network failures (invisible to user)
- **Manual retry button** on persistent errors
- **Session caching** to recover from interruptions

### Debug Mode
Set `VITE_GLIDE_DEBUG=true` to see:
- 🔍 Cross-device flow detection
- 🔄 Retry attempts
- ⏱️ Timing information
- 📊 Detailed error context

## 🛠️ Backend Options

### Option A: TypeScript (Default)
```bash
npm run dev  # Uses server.ts with glide-sdk
```

### Option B: Java (Spring Boot)
```bash
npm run dev:java  # Uses Spring Boot with glide-sdk-java
```

### Option C: Go
```bash
npm run dev:go  # Uses server.go with glide-go-sdk
```

All backends provide identical `/api/phone-auth/*` endpoints.

## 🧪 Testing Without Backend Setup

For quick testing, use the hosted demo server:

In `src/App.jsx`, change:
```javascript
// Comment out local endpoints
// const prepareRequest = '/api/phone-auth/prepare';
// const processResponse = '/api/phone-auth/process';

// Use demo endpoints
const prepareRequest = 'https://checkout-demo-server.glideidentity.dev/generate-get-request';
const processResponse = 'https://checkout-demo-server.glideidentity.dev/processCredential';
```

Then run:
```bash
npm run client  # Frontend only
```

## 📊 Understanding the Flow

### Phase 1: Prepare (Backend → Glide)
1. Frontend requests authentication
2. Backend calls Glide's `/prepare` endpoint
3. Glide returns credential request based on carrier

### Phase 2: Authenticate (Browser ↔ Carrier)
1. Frontend invokes Digital Credentials API
2. Browser communicates with carrier
3. User approves on device
4. Browser receives signed credential

### Phase 3: Process (Backend → Glide)
1. Frontend sends credential to backend
2. Backend validates with Glide
3. Glide returns verified phone data

## 🐛 Troubleshooting

### "Browser not supported"
- Use Chrome/Edge 128+
- Enable flag: `chrome://flags/#web-identity-digital-credentials`

### "USER_DENIED" after completing on phone
- This is a known browser behavior
- The SDK includes automatic retry logic
- Click "Retry Request" button if shown

### "CARRIER_NOT_ELIGIBLE"
- Carrier doesn't support Digital Credentials
- Currently supported: T-Mobile, Verizon (iOS)
- AT&T coming soon

### Debug Tips
1. Set `VITE_GLIDE_DEBUG=true` in `.env`
2. Check browser console for detailed logs
3. Look for "Cross-device flow detected" messages
4. Note request IDs for support

## 🚢 Production Checklist

Before deploying to production:

- [ ] Use environment variables for API keys
- [ ] Implement proper authentication on your backend
- [ ] Add rate limiting to prevent abuse
- [ ] Enable CORS only for your domains
- [ ] Disable debug logging (`GLIDE_DEBUG=false`)
- [ ] Handle all error codes gracefully
- [ ] Add monitoring and analytics
- [ ] Test on multiple devices/carriers
- [ ] Review security best practices

## 📚 API Reference

### Backend Endpoints

#### `POST /api/phone-auth/prepare`
Prepares authentication request
```typescript
Request: {
  use_case: "GetPhoneNumber" | "VerifyPhoneNumber",
  phone_number?: string,  // For VerifyPhoneNumber
  plmn?: { mcc: string, mnc: string }  // For GetPhoneNumber
}

Response: {
  authentication_strategy: "ts43" | "link",
  session: SessionInfo,
  data: CredentialRequest
}
```

#### `POST /api/phone-auth/process`
Processes credential from browser
```typescript
Request: {
  response: CredentialResponse,
  sessionInfo: SessionInfo,
  useCase: string
}

Response: {
  phone_number: string,
  verified?: boolean  // For VerifyPhoneNumber
}
```

### Frontend Hook

```javascript
import { usePhoneAuth } from 'glide-web-client-sdk/react';

const {
  getPhoneNumber,      // Function to get phone
  verifyPhoneNumber,   // Function to verify
  retryLastRequest,    // Manual retry (new)
  isLoading,          // Loading state
  error,              // Error object
  result,             // Success result
  currentStep,        // Current flow step
  isSupported         // Browser support
} = usePhoneAuth({
  endpoints: {
    prepare: '/api/phone-auth/prepare',
    process: '/api/phone-auth/process'
  },
  onCrossDeviceDetected: () => {
    console.log('QR code shown');
  },
  onRetryAttempt: (attempt, max) => {
    console.log(`Retry ${attempt}/${max}`);
  }
});
```

## 🔗 Resources

- **Glide Documentation**: [docs.glideapi.com](https://docs.glideapi.com/)
- **API Reference**: [api.glideidentity.app/docs](https://api.glideidentity.app/docs)
- **Support**: support@glideidentity.com
- **SDK Source**: [github.com/GlideIdentity](https://github.com/GlideIdentity)

## 📄 License

MIT - See LICENSE file

---

**For AI Agents**: This is a complete implementation of carrier-based phone authentication. The key files are:
- `server.ts` (or `.java`/`.go`) - Backend API implementation
- `src/App.jsx` - Frontend React component
- `.env` - Configuration (needs API key)

To implement in another project:
1. Copy the backend endpoint logic (`/api/phone-auth/*`)
2. Install SDKs: `glide-sdk` (backend) and `glide-web-client-sdk` (frontend)
3. Use the `usePhoneAuth` hook in React or `PhoneAuthClient` class in vanilla JS
4. Handle the three phases: Prepare → Authenticate → Process