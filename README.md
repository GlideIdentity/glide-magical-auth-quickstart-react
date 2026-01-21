# 🚀 Magical Auth Quick Start - React

Experience carrier-grade phone authentication in **2 minutes**. No SMS, no delays, no fraud - just instant verification through SIM cards.

## 🚀 Quick Setup

### Prerequisites
- **Node.js 18+** (required for frontend and Node.js backend)
- Choose one backend option:
  - **Node.js 18+** for Node.js backend (default)
  - **Java 17+ & Gradle** for Java backend

### Setup Steps

```bash
# 1. Clone the repository
git clone https://github.com/GlideIdentity/glide-magic-auth-quickstart-react.git
cd glide-magic-auth-quickstart-react

# 2. Install dependencies
npm install

# 3. Copy environment variables
cp env.example .env

# 4. Add your OAuth2 credentials to .env
# Edit .env and add your GLIDE_CLIENT_ID and GLIDE_CLIENT_SECRET

# 5. Start everything
npm run dev
```

**That's it!** Open http://localhost:3000 in your browser 🎉

> **Note:** The frontend runs on port 3000, backend API on port 3001
> 
> **Backend Options:**
> - `npm run dev` - Uses Node.js backend (default)
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

## 🏗️ Project Structure

```
magical-auth-quickstart-react/
├── frontend/                          # React frontend
│   ├── src/
│   │   ├── App.jsx                    # Main React app
│   │   ├── App.css                    # Styling
│   │   ├── main.jsx                   # Entry point
│   │   ├── components/
│   │   │   └── SdkConfigPanel.jsx     # SDK config panel
│   │   └── assets/
│   │       └── Glide-Logomark.svg
│   ├── index.html
│   └── vite.config.js
│
├── server/                            # Backend servers
│   ├── node/                          # Node.js backend (default)
│   │   ├── index.ts                   # Express server
│   │   └── session-store.ts           # Session management
│   │
│   └── java/                          # Java/Spring Boot backend
│       ├── src/main/java/com/glideidentity/
│       │   ├── JavaServer.java        # Entry point
│       │   ├── controller/            # API endpoints
│       │   └── service/               # Business logic
│       ├── build.gradle
│       ├── gradlew
│       └── gradle/
│
├── package.json                       # NPM scripts & dependencies
├── tsconfig.json                      # TypeScript config
├── env.example                        # Environment template
└── README.md
```

**Two Backend Options - Same API:**
| Backend | Location | Language |
|---------|----------|----------|
| **Node.js** | `server/node/` | TypeScript + Express |
| **Java** | `server/java/` | Spring Boot |

> **Note:** Go backend support coming soon.

## 🔧 Configuration

Create a `.env` file with your OAuth2 credentials:

```env
GLIDE_CLIENT_ID=your_client_id_here
GLIDE_CLIENT_SECRET=your_client_secret_here

# Optional: Enable debug logging
GLIDE_DEBUG=true
```

Get your credentials from [Glide Dashboard](https://docs.glideidentity.com/)

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


### Available Scripts

This quickstart supports **two backend options** - choose the one that matches your stack:

```bash
# Quick start options
npm run dev              # React + Node.js backend (default)
npm run dev:node         # React + Node.js backend  
npm run dev:java         # React + Java backend

# Run components separately
npm run dev:react        # Frontend only (port 3000)
npm run server:node      # Node.js backend only (port 3001)
npm run server:java      # Java backend only (port 3001)

# Build commands
npm run build            # Build frontend
npm run build:server     # Build Node.js server
npm run server:java:build   # Build Java server
```

### Backend Port
```bash
# Default is 3001 for backend API, 3000 for frontend
PORT=3001 npm run dev
```



## 🚀 What's Next?

Now that you've seen it work:

1. **Try both modes** - Toggle between High Level and Granular
2. **Check the console** - See all the API calls
3. **Look at the code** - Frontend in `frontend/src/`, backend in `server/`
4. **Integrate into your app** - Copy the patterns you need

## 📚 Resources

- **[SDK Documentation](https://docs.glideidentity.com/)** - Complete API reference and integration guides

## 💬 Need Help?

- **Email**: support@glideidentity.com

---

## 🌟 Why React?

- **Modern React** - Hooks and functional components
- **Two backend options** - Choose Node.js or Java
- **React hook** - Uses `usePhoneAuth` from `@glideidentity/web-client-sdk/react`
- **TypeScript support** - Type-safe development

---

Built with ❤️ by Glide Identity | Making authentication magical ✨
