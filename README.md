# 🚀 Magical Auth Quick Start - React

Experience carrier-grade phone authentication in **2 minutes**. No SMS, no delays, no fraud - just instant verification through SIM cards.

## 🚀 Quick Setup

### Prerequisites
- **Node.js 18+** (required)
- **Go 1.21+** (recommended) or use Node.js backend as fallback

### Setup Steps

```bash
# 1. Clone the repository
git clone https://github.com/YourOrg/magical-auth-quickstart-react.git
cd magical-auth-quickstart-react

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

**That's it!** Your browser will open automatically at http://localhost:5173 🎉

> **Note:** `npm run dev` starts the Go backend (port 3000) and React frontend (port 5173)
> 
> **No Go?** No problem! Use `npm run dev:node` for the Node.js backend instead

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
│   ├── App.jsx           # The entire React app (both modes)
│   └── App.css          # Styling
├── server.go            # Go backend server with Glide SDK
├── package.json         # Dependencies and scripts
├── vite.config.js      # Vite configuration
├── env.example         # Example environment variables
├── go.mod              # Go dependencies (auto-managed)
└── go.sum              # Go dependency lock file
```

## 🔧 Want Your Own API Key?

The quickstart works out-of-the-box with our demo server. To use your own credentials:

1. Get your API key from [Glide Dashboard](https://docs.glideapi.com/)
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

```bash
# Quick start (recommended)
npm run dev              # Starts React + Go backend

# Alternative backends
npm run dev:node        # React + Node.js backend
npm run dev:java        # React + Java backend (requires Gradle)

# Run separately (for development)
npm run dev:react       # Frontend only (port 5173)
npm run dev:go         # Go backend only (port 3000)
npm run server:node    # Node.js backend only (port 3000)

# Build for production
npm run build:all      # Build everything
```

### Backend Port
```bash
# Default is 3000 for backend, 5173 for frontend
PORT=3000 npm run dev:go
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
→ Make sure backend is running (should start automatically with `npm run dev`)

**"Go not found"**
→ The Go backend is optional. You can use `npm run dev:node` for Node.js backend instead

**"Module download failed"**
→ Run `go mod download` in the project directory (this is done automatically by npm scripts)

## 🚀 What's Next?

Now that you've seen it work:

1. **Try both modes** - Toggle between High Level and Granular
2. **Check the console** - See all the API calls
3. **Look at the code** - It's all in `src/App.jsx` and `server.go`
4. **Integrate into your app** - Copy the patterns you need

## 📚 Resources

- **[SDK Documentation](https://docs.glideapi.com/)** - Full SDK reference and API docs
- **[Go SDK](https://github.com/GlideIdentity/glide-be-sdk-go)** - Official Go SDK used in this quickstart
- **[Node.js SDK](https://www.npmjs.com/package/@glideidentity/sdk-node)** - Node.js SDK alternative
- **[Nuxt Version](../magical-auth-quickstart-nuxt)** - Same quickstart in Nuxt/Vue
- **[Vanilla JS Version](../magical-auth-quickstart-vanilla)** - Same quickstart in pure JavaScript

## 💬 Need Help?

- **Discord**: [Join our community](https://discord.gg/glide)
- **Email**: support@glideidentity.com

---

Built with ❤️ by Glide Identity | Making authentication magical ✨