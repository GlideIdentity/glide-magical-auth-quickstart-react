# Deployment Guide

Deploy the quickstart to a public HTTPS URL to test the **Link protocol** (iOS App Clips) authentication flow.

**Note:** TS43 (Android) and Desktop (QR) flows work from `localhost` — deployment is only required for the Link flow because device binding uses an HttpOnly cookie that is domain-scoped, and the completion redirect page must be on the same domain.

## Option 1: Render.com (Recommended — All Backends)

Render supports Node.js, Go, and Java backends with a free tier (750 hours/month).

### Steps

1. **Push your repo to GitHub** (with `.env` excluded via `.gitignore`)

2. **Copy the Render blueprint to your repo root:**
   ```bash
   cp deployments/render.yaml render.yaml
   git add render.yaml && git commit -m "Add Render blueprint" && git push
   ```

3. **Go to [Render Dashboard](https://dashboard.render.com)**
   - Click **New > Blueprint**
   - Connect your GitHub repo
   - Render reads `render.yaml` and creates both services

4. **Set environment variables** in the Render dashboard:
   - `GLIDE_CLIENT_ID` — your OAuth2 client ID
   - `GLIDE_CLIENT_SECRET` — your OAuth2 client secret

5. **Note your deployed URLs:**
   - Frontend: `https://quickstart-frontend.onrender.com`
   - Backend: `https://quickstart-api.onrender.com`

6. **Configure in the Glide developer portal** (for device binding):
   - Set `completion_redirect_url` to `https://quickstart-frontend.onrender.com/glide-complete`
   - Set `allowed_origins` to `https://quickstart-frontend.onrender.com` (for TS43 `aud` validation)

### Switching backends on Render

By default, the blueprint uses Node.js. To use Go or Java:
- **Go**: Edit `render.yaml` — uncomment the Go `buildCommand`/`startCommand` lines
- **Java**: Requires a Dockerfile (see comments in `render.yaml`)

### Free tier notes

- Services spin down after 15 minutes of inactivity
- First request after idle takes ~30 seconds (cold start)
- 750 free hours/month across all services

---

## Option 2: Vercel (Node.js / Go Only)

Vercel provides zero-config deployment for Node.js with a generous free tier.

### Steps

1. **Copy the Vercel config to your repo root:**
   ```bash
   cp deployments/vercel.json vercel.json
   git add vercel.json && git commit -m "Add Vercel config" && git push
   ```

2. **Install Vercel CLI and deploy:**
   ```bash
   npm i -g vercel
   vercel --prod
   ```
   Or connect your GitHub repo at [vercel.com/new](https://vercel.com/new).

3. **Set environment variables** in the Vercel dashboard:
   - `GLIDE_CLIENT_ID`
   - `GLIDE_CLIENT_SECRET`
   - `GLIDE_DEBUG` = `true`

4. **Note your deployed URL** (e.g., `https://my-quickstart.vercel.app`)

5. **Configure in the Glide developer portal:**
   - Set `completion_redirect_url` to `https://my-quickstart.vercel.app/glide-complete`
   - Set `allowed_origins` to `https://my-quickstart.vercel.app`

### Limitations

- No Java backend support (Vercel doesn't run JVM)
- Serverless functions have a 10-second timeout on the free tier

---

## Option 3: ngrok (Local Tunnel — All Backends)

The fastest way to get a public URL. Runs your local server and exposes it via HTTPS tunnel.

### Steps

1. **Install ngrok:**
   ```bash
   # macOS
   brew install ngrok

   # Or download from https://ngrok.com/download
   ```

2. **Start your quickstart locally:**
   ```bash
   npm run dev:node   # or dev:java, dev:go
   ```

3. **In a new terminal, start the tunnel:**
   ```bash
   ngrok http 3000
   ```

4. **Copy the HTTPS URL** from ngrok output (e.g., `https://abc123.ngrok-free.app`)

5. **Configure in the Glide developer portal:**
   - Set `completion_redirect_url` to `https://abc123.ngrok-free.app/glide-complete`

6. **Open the ngrok URL on your phone** and test

### Notes

- **URL changes** every time you restart ngrok (free tier). You'll need to re-register the `completion_redirect_url` each time.
- **Paid plans** ($8/month) give you a stable URL — worth it for regular development.
- ngrok adds a warning page on first visit (free tier) — click "Visit Site" to proceed.

---

## Device Binding: Completion Redirect URL

The Link protocol (iOS App Clips) requires a `completion_redirect_url` configured in the Glide developer portal. This URL is where the aggregator redirects after carrier authentication, delivering the `agg_code` needed to complete device-bound sessions.

**What it looks like:** `https://your-deployed-url.com/glide-complete`

**How it works:**
1. User taps the App Clip (iOS) for carrier authentication
2. Carrier verifies the user's SIM
3. Glide redirects to your `completion_redirect_url` with `agg_code` in the URL fragment
4. Your completion page reads `agg_code`, writes a localStorage signal, and POSTs to `/api/phone-auth/complete`
5. Your backend reads `fe_code` from the HttpOnly cookie and forwards both codes to Glide
6. Glide validates both codes — session is complete

**Configuration:** Set `completion_redirect_url` in the Glide developer portal alongside your OAuth2 credentials.

## TS43: Audience (aud) Validation

The TS43 flow (Android Digital Credentials API) includes an `aud` (audience) field in the credential that reflects the web origin where authentication was invoked. By default, if no `allowed_origins` are configured, `aud` validation is skipped and the credential is accepted from any origin.

If you want to restrict which origins can use your credentials, configure `allowed_origins` as an array in the Glide developer portal (e.g., `["https://your-app.com", "http://localhost:3000"]`). When set, the aggregator rejects credentials whose `aud` doesn't match any entry in the array.
