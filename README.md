# 🚀 Magical Auth Quick Start - React

Experience carrier-grade phone authentication in **2 minutes**. No SMS, no delays, no fraud - just instant verification through SIM cards.

## 💨 Start in 30 Seconds

```bash
# Clone and install
npm install

# Start the backend server
npm run server

# In a new terminal, start the React app
npm run dev
```

**That's it!** Open http://localhost:3000 and try it out 🎉

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
│   ├── App.jsx             # The entire app (both modes)
│   └── App.css            # Styling
├── server.ts              # Express backend server
├── package.json           # Dependencies
└── vite.config.js        # Vite configuration
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

### Backend Port
```bash
# Default is 3001
PORT=3001 npm run server
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
→ Make sure backend is running (`npm run server`)

## 🚀 What's Next?

Now that you've seen it work:

1. **Try both modes** - Toggle between High Level and Granular
2. **Check the console** - See all the API calls
3. **Look at the code** - It's all in `src/App.jsx` and `server.ts`
4. **Integrate into your app** - Copy the patterns you need

## 📚 Resources

- **[SDK Docs](https://docs.glideapi.com/)** - Full reference
- **[API Spec](../GLIDE_API_SPECIFICATION.md)** - Detailed API info  
- **[Nuxt Version](../magical-auth-quickstart-nuxt)** - Same thing in Nuxt/Vue

## 💬 Need Help?

- **Discord**: [Join our community](https://discord.gg/glide)
- **Email**: support@glideidentity.com

---

Built with ❤️ by Glide Identity | Making authentication magical ✨