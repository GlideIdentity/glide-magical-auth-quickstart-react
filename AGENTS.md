# Agent Instructions

This is a quickstart for Glide Identity's Magical Auth — carrier-grade phone authentication using SIM cards. It has a React frontend (Vite) and three interchangeable backend options (Node.js, Go, Java) that all expose the same API.

## Architecture

```
Frontend (React + Vite, port 3000)
  └── usePhoneAuth hook from @glideidentity/glide-fe-sdk-web/react
  └── Makes API calls to backend via /api/* endpoints
  └── In dev: Vite proxy forwards /api/* to localhost:3001
  └── In production: VITE_API_URL env var points to backend URL

Backend (Express / Go / Spring Boot, port 3001)
  └── Uses Glide BE SDK (Node: @glideidentity/glide-be-sdk-node, Java: glide-be-sdk-java)
  └── OAuth2 client credentials authentication to Glide API
  └── Endpoints: /api/phone-auth/prepare, /process, /invoke, /complete, /status/:id
  └── GET /glide-complete — device binding completion redirect page
```

## File Map

```
frontend/
  src/App.jsx              — Main React app (flow UI, SDK hook usage)
  src/components/           — UI components
  vite.config.js           — Dev server config, proxy rules
  index.html               — SPA entry point

server/
  node/index.ts            — Node.js Express server (primary)
  node/session-store.ts    — In-memory session URL storage
  go/main.go               — Go backend (same API)
  java/src/.../controller/  — Java Spring Boot controllers
  java/src/.../service/     — Java service layer
  java/build.gradle        — Java dependencies (uses Glide SDK 5.1.0)

deployments/
  render.yaml              — Render.com blueprint (all backends)
  vercel.json              — Vercel config (Node.js/Go only)
  README.md                — Step-by-step deployment guide

env.example                — Environment variable template
```

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create .env from template
cp env.example .env

# 3. Add your Glide OAuth2 credentials to .env
#    GLIDE_CLIENT_ID=<your_client_id>
#    GLIDE_CLIENT_SECRET=<your_client_secret>

# 4. Start (pick one backend)
npm run dev:node    # Node.js backend + React frontend
npm run dev:java    # Java backend + React frontend
npm run dev:go      # Go backend + React frontend (default)
```

Frontend runs on http://localhost:3000, backend API on http://localhost:3001.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GLIDE_CLIENT_ID` | Yes | OAuth2 client ID from Glide |
| `GLIDE_CLIENT_SECRET` | Yes | OAuth2 client secret from Glide |
| `GLIDE_API_BASE_URL` | No | Glide API base URL. Default: `https://api.glideidentity.app`. Staging: `https://api-stg.glideidentity.app` |
| `GLIDE_DEBUG` | No | Set `true` for verbose SDK logging |
| `VITE_API_URL` | No | Backend URL for deployed environments (empty = use Vite proxy) |
| `PORT` | No | Backend port (default: 3001) |

## API Endpoints

All backends implement the same API:

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/phone-auth/prepare` | Start auth session, set device binding cookie |
| POST | `/api/phone-auth/invoke` | Report invocation for metrics |
| POST | `/api/phone-auth/process` | Process credential (verify or get phone number) |
| GET | `/api/phone-auth/status/:id` | Poll session status (desktop/QR flow) |
| GET | `/glide-complete` | Device binding completion redirect page |
| POST | `/api/phone-auth/complete` | Complete device-bound session |

## Device Binding (Link Protocol)

For the Link/App Clip authentication strategy (iOS), the SDK implements device binding to prevent phishing:

1. **Prepare**: Backend generates `fe_code`, computes `fe_hash = SHA256(fe_code)`, sends `fe_hash` to Glide, sets `fe_code` as HttpOnly cookie `_glide_bind_{session_prefix}`
2. **Carrier auth**: User authenticates via App Clip, Glide redirects to `/glide-complete#agg_code=xxx&session_key=yyy`
3. **Completion page**: Reads `agg_code` from URL fragment, writes localStorage signal for the original tab, POSTs to `/api/phone-auth/complete`
4. **Complete**: Backend reads `fe_code` from cookie + `agg_code` from body, forwards to Glide for dual-code validation

The completion page is served by the backend using the SDK's `getCompletionPageHtml()` helper.

## Deployment

See `deployments/README.md` for step-by-step guides:
- **Render.com** — all backends, free tier (750 hrs/month)
- **Vercel** — Node.js/Go, generous free tier
- **ngrok** — local tunnel, all backends

**When is deployment needed?**
- **TS43** (Android): Works from localhost — no deployment required. The `aud` field validates the web origin.
- **Desktop** (QR): Works from localhost — uses polling.
- **Link** (iOS App Clips): **Requires a public HTTPS URL.** The `_glide_bind_*` HttpOnly cookie is domain-scoped, and the completion redirect page must be on the same domain that set the cookie.

## Common Tasks

### Add a new backend endpoint

1. Add the route in `server/node/index.ts` (Node) or `server/java/.../controller/PhoneAuthController.java` (Java)
2. Add the corresponding Vite proxy rule in `frontend/vite.config.js` if the path prefix differs from `/api`

### Change the frontend UI

Edit `frontend/src/App.jsx`. The SDK hook `usePhoneAuth` handles all auth logic — UI is just state management around it.

### Switch backend language

Change the npm script: `npm run dev:node`, `npm run dev:java`, or `npm run dev:go`. All backends expose identical API endpoints.

## Do NOT

- Do not hardcode API keys or secrets — always use environment variables
- Do not modify the Glide SDK packages directly — they are npm/Maven dependencies
- Do not expose `feCode` in API response bodies — it must only travel via HttpOnly cookie
- Do not remove the `@JsonIgnore` annotation on `PrepareResponse.feCode` in the Java backend
- Do not change the `/glide-complete` path — it must match what's registered as `completion_redirect_url` in Glide
