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
git clone https://github.com/GlideIdentity/glide-magical-auth-quickstart-react.git
cd glide-magical-auth-quickstart-react

# 2. Install dependencies
npm install
# This automatically downloads Go dependencies if Go is installed

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
│   ├── node/                          # Node.js backend
│   │   ├── index.ts                   # Express server
│   │   └── session-store.ts           # Session management
│   │
│   ├── go/                            # Go backend
│   │   ├── main.go                    # HTTP server
│   │   ├── session_store.go           # Session management
│   │   ├── go.mod
│   │   └── go.sum
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

**Three Backend Options - Same API:**
| Backend | Location | Language |
|---------|----------|----------|
| **Go** | `server/go/` | High-performance compiled |
| **Node.js** | `server/node/` | TypeScript + Express |
| **Java** | `server/java/` | Spring Boot |

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

This quickstart supports **three backend options** - choose the one that matches your stack:

```bash
# Quick start options
npm run dev              # React + Go backend (default)
npm run dev:node        # React + Node.js backend  
npm run dev:java        # React + Java backend

# Run components separately
npm run dev:react       # Frontend only (port 3000)
npm run server:go       # Go backend only (port 3001)
npm run server:node     # Node.js backend only (port 3001)
npm run server:java     # Java backend only (port 3001)

# Build commands
npm run build           # Build frontend
npm run build:server    # Build Node.js server
npm run server:go:build # Build Go server
npm run server:java:build  # Build Java server
npm run build:all       # Build everything
```

### Backend Port
```bash
# Default is 3001 for backend API, 3000 for frontend
PORT=3001 npm run dev:go
```



## 📱 Test on Mobile

### What works from localhost

| Strategy | Platform | Localhost | Public URL Required |
|----------|----------|-----------|---------------------|
| **TS43** | Android (Digital Credentials API) | Yes | No — `aud` validation works on any origin |
| **Desktop** | QR code scan | Yes | No — uses polling |
| **Link** | iOS (App Clips) | No | **Yes** — device binding cookie requires same domain as redirect |

**TS43 and Desktop flows work from `http://localhost:3000`** — no deployment needed.

**Link flow requires a public HTTPS URL** because the completion redirect page (`/glide-complete`) must be on the same domain that set the `_glide_bind_*` HttpOnly cookie. The aggregator redirects the browser to your registered `completion_redirect_url` after carrier auth, and the cookie is only sent if the domain matches.

### Deploy for Link Protocol Testing

| Platform | Backends | Setup Time | Free Tier |
|----------|----------|------------|-----------|
| **Render.com** | Node.js, Go, Java | ~5 min | 750 hrs/month |
| **Vercel** | Node.js, Go | ~3 min | Generous |
| **ngrok** | All (local tunnel) | ~1 min | Free (URL changes) |

### Fastest: ngrok

```bash
# 1. Start locally
npm run dev:node

# 2. In another terminal
ngrok http 3000

# 3. Open the ngrok HTTPS URL on your iOS device
```

### Production-like: Render or Vercel

See **[deployments/README.md](deployments/README.md)** for step-by-step deployment guides.

### Configuration

The following settings are managed through the Glide developer portal alongside your OAuth2 credentials:

- **`completion_redirect_url`** — Your deployed URL + `/glide-complete` (e.g., `https://your-app.com/glide-complete`). Required for the Link protocol's device binding flow.
- **`allowed_origins`** (optional) — An array of web origins for TS43 `aud` (audience) validation (e.g., `["https://your-app.com"]`). If not set, `aud` validation is skipped and credentials are accepted from any origin.

## 🚀 What's Next?

Now that you've seen it work:

1. **Try both modes** - Toggle between High Level and Granular
2. **Test on mobile** - Deploy and try Link (iOS) or TS43 (Android) flows
3. **Check the console** - See all the API calls
4. **Look at the code** - Frontend in `frontend/src/`, backend in `server/`
5. **Integrate into your app** - Copy the patterns you need

## 📚 Resources

- **[SDK Documentation](https://docs.glideidentity.com/)** - Complete API reference and integration guides

## 💬 Need Help?

- **Email**: support@glideidentity.com

---

## 🌟 Why React?

- **Modern React** - Hooks and functional components
- **Three backend options** - Choose Go, Node.js, or Java
- **React hook** - Uses `usePhoneAuth` from `@glideidentity/glide-fe-sdk-web/react`
- **TypeScript support** - Type-safe development

---

Built with ❤️ by Glide Identity | Making authentication magical ✨
