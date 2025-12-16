# 🚀 Magical Auth Quick Start - React

Experience carrier-grade phone authentication in **2 minutes**. No SMS, no delays, no fraud - just instant verification through SIM cards.

## 🚀 Quick Setup

### Prerequisites
- **Node.js 18+** (required for frontend and Node.js backend)
- Choose one backend option:
  - **Go 1.21+** for Go backend (default)
  - **Node.js 18+** for Node.js backend
  - **Java 17+ & Gradle** for Java backend

### Setup Steps

```bash
# 1. Clone the repository
git clone https://github.com/GlideIdentity/glide-magic-auth-quickstart-react.git
cd glide-magic-auth-quickstart-react

# 2. Install dependencies
npm install
# This automatically downloads Go dependencies if Go is installed

# 3. Copy environment variables
cp env.example .env

# 4. (Optional) Add your API key to .env
# Edit .env and add your GLIDE_API_KEY if you have one
# The demo key works out-of-the-box for testing

# 5. Start everything
npm run dev
```

**That's it!** Open http://localhost:3000 in your browser 🎉

> **Note:** The frontend runs on port 3000, backend API on port 3001
> 
> **Backend Options:**
> - `npm run dev` - Uses Go backend (default)
> - `npm run dev:node` - Uses Node.js backend
> - `npm run dev:java` - Uses Java backend

## 🎮 What You Can Do

### Two Modes to Play With

**⚡ High Level Mode** (Default)
- One-click authentication
- SDK handles everything
- Perfect for production apps

**🔧 Granular Mode**
- See each step happening
- Great for understanding the flow
- Debug-friendly with full logging

### Two Use Cases to Try

1. **📲 Get Phone Number** - Retrieves the phone number from your SIM card
2. **✓ Verify Phone Number** - Confirms you own a specific phone number

## 🏗️ What's Inside

```
magical-auth-quickstart-react/
├── src/
│   ├── App.jsx                    # React frontend app
│   ├── App.css                    # Frontend styling
│   ├── components/
│   │   └── SdkConfigPanel.jsx     # SDK configuration panel
│   └── main/java/                 # Java backend source
│       └── com/glideidentity/
│           ├── JavaServer.java    # Java entry point
│           ├── controller/        # API endpoints
│           └── service/           # Glide SDK integration
├── server.go              # Go backend implementation
├── server.ts              # Node.js backend implementation  
├── build.gradle           # Java build configuration
├── package.json           # NPM scripts and dependencies
├── vite.config.js         # Frontend build config
├── go.mod                 # Go dependencies
└── env.example            # Environment variables template
```

**Three Backend Options:**
- **Go** (`server.go`) - High-performance, compiled backend
- **Node.js** (`server.ts`) - JavaScript/TypeScript backend using `@glideidentity/glide-sdk`
- **Java** (`src/main/java/`) - Spring Boot backend using `glide-sdk-java`

## 🔧 Want Your Own API Key?

The quickstart works out-of-the-box with our demo server. To use your own credentials:

1. Get your API key from [Glide Dashboard](https://docs.glideidentity.com/)
2. Create `.env` file:
```env
GLIDE_API_KEY=your_api_key_here
```
3. Restart the server - it'll use your key automatically!

## 👀 See What's Happening

### Enable Debug Mode

1. Toggle "Debug Mode" at the bottom of the page
2. Open browser console (F12)
3. Watch the magic:

```javascript
[PhoneAuth] PrepareResponse received: {...}
[Granular] Step 2: About to invoke secure prompt
[PhoneAuth] Credential obtained from browser
[Granular] Step 3: Final response: {phone_number: "+1234567890"}
```

### Understanding the Flow

**Step 1: Prepare** → Your server talks to Glide
**Step 2: Browser Prompt** → Secure carrier verification  
**Step 3: Process** → Get the verified result

## 🎨 Quick Customizations

### Change Carrier (for Get Phone Number)
```javascript
// In src/App.jsx
plmn: { mcc: '310', mnc: '260' }  // T-Mobile (default)
plmn: { mcc: '310', mnc: '004' }  // Verizon
plmn: { mcc: '310', mnc: '410' }  // AT&T
```

### Customize Consent Text
```javascript
consent_data: {
  consent_text: 'Your custom message',
  policy_link: 'https://yoursite.com/privacy',
  policy_text: 'Your Policy'
}
```

### Available Scripts

This quickstart supports **three backend options** - choose the one that matches your stack:

```bash
# Quick start options
npm run dev              # React + Go backend (default)
npm run dev:node        # React + Node.js backend  
npm run dev:java        # React + Java backend

# Run components separately
npm run dev:react       # Frontend only (port 3000)
npm run dev:go         # Go backend only (port 3001)
npm run server:node    # Node.js backend only (port 3001)
npm run server:java    # Java backend only (port 3001)

# Build commands
npm run build          # Build frontend
npm run build:server   # Build Node.js server
npm run server:go:build    # Build Go server
npm run server:java:build  # Build Java server
npm run build:all      # Build everything
```

### Backend Port
```bash
# Default is 3001 for backend API, 3000 for frontend
PORT=3001 npm run dev:go
```

## 📱 Browser Requirements

Works on:
- **Chrome/Edge 128+** on Android ✅
- **Chrome/Edge Desktop** (with phone nearby) ✅
- **Safari** (coming soon) 🔜

## 🤔 Common Questions

**"Browser not supported"**
→ Use Chrome/Edge 128+ on Android or desktop

**"401 Unauthorized"**  
→ Check your API key in `.env`

**"PLMN required"**
→ Already handled! Default is T-Mobile USA

**"Cannot connect to server"**
→ Make sure backend is running on port 3001 (starts automatically with `npm run dev`)

**"Go/Java/Gradle not found"**
→ Choose a different backend:
  - No Go? Use `npm run dev:node`
  - No Java/Gradle? Use `npm run dev:node` or `npm run dev`
  - No special requirements? Use `npm run dev:node`

## 🚀 What's Next?

Now that you've seen it work:

1. **Try both modes** - Toggle between High Level and Granular
2. **Check the console** - See all the API calls
3. **Look at the code** - Frontend in `src/App.jsx`, backend in `server.go`/`server.ts`/`JavaServer.java`
4. **Integrate into your app** - Copy the patterns you need

## 📚 Resources

- **[SDK Documentation](https://docs.glideidentity.com/)** - Complete API reference and integration guides

## 💬 Need Help?

- **Email**: support@glideidentity.com

---

## 🌟 Why React?

- **Modern React** - Hooks and functional components
- **Three backend options** - Choose Go, Node.js, or Java
- **React hook** - Uses `usePhoneAuth` from `@glideidentity/web-client-sdk/react`
- **TypeScript support** - Type-safe development

---

Built with ❤️ by Glide Identity | Making authentication magical ✨