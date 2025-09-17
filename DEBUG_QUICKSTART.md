# 🔍 Debug Logging in Quickstart

This quickstart now includes **industry-grade debug logging** following best practices from Stripe, AWS, and Twilio SDKs.

## How to Enable Debug Logging

### Configuration via Environment Variables (.env file)

The recommended approach is to use environment variables for consistent configuration:

1. **Copy the example environment file:**
```bash
cp env.example .env
```

2. **Edit `.env` to enable debug logging:**
```bash
# Backend Debug Configuration
GLIDE_DEBUG=true              # Enable debug for Go server
GLIDE_LOG_LEVEL=debug         # Or set specific level: error, warn, info, debug

# Frontend Debug Configuration (Vite requires VITE_ prefix)
VITE_GLIDE_DEBUG=true         # Enable debug for React app
VITE_GLIDE_LOG_LEVEL=debug    # Or set specific level
```

3. **Start the application:**
```bash
# Backend will read from .env automatically (via godotenv)
go run server.go

# Frontend will read REACT_APP_* vars at build time
npm start
```

### Alternative Methods

#### Backend Only
```bash
# Override via command line
GLIDE_DEBUG=true go run server.go
```

#### Frontend Only (Development)
```bash
# Add to URL in development mode
http://localhost:3000?debug=true
```

## What You'll See When Debug is Enabled

### Frontend Console Logs
```
[PhoneAuth] 2024-01-15T10:30:00.123Z [INFO] SDK initialized
[PhoneAuth] 2024-01-15T10:30:01.456Z [DEBUG] Preparing request 
  { method: "POST", url: "/api/phone-auth/prepare", phoneNumber: "+12345****" }
[PhoneAuth] 2024-01-15T10:30:01.789Z [INFO] Response received 
  { statusCode: 200, elapsed: "333ms" }
[PhoneAuth] 2024-01-15T10:30:02.123Z [DEBUG] Authentication strategy: TS43
[PhoneAuth] 2024-01-15T10:30:05.456Z [INFO] Verification successful
```

### Backend Server Logs
```
🔍 Debug logging enabled for Glide SDK
📊 You will see detailed logs for:
  - API request/response details
  - Performance metrics
  - Retry attempts
  - Error context
  
[Glide] 2024-01-15T10:30:01.456Z [INFO] Glide SDK initialized version=1.0.0 baseURL=https://api.glideidentity.app
[Glide] 2024-01-15T10:30:01.789Z [DEBUG] Preparing authentication request method=POST path=/api/magic-auth/prepare
[Glide] 2024-01-15T10:30:01.890Z [INFO] Sending HTTP request method=POST path=/api/magic-auth/prepare
[Glide] 2024-01-15T10:30:02.123Z [DEBUG] HTTP response received statusCode=200 elapsed=233ms
[Glide] 2024-01-15T10:30:02.124Z [INFO] Request completed successfully statusCode=200 elapsed=234ms
```

## Security Features

All sensitive data is **automatically redacted** in logs:

| Data Type | Actual Value | What's Logged |
|-----------|--------------|---------------|
| API Key | `sk_live_abc123def456` | `sk_l****[REDACTED]` |
| Phone Number | `+12125551234` | `+12125****` |
| Token | `eyJhbGc...` | `eyJh****[JWT]` |
| Session | `sess_abc123xyz` | `sess****[REDACTED]` |

## Debugging Common Issues

### 1. Authentication Failures
Enable debug to see:
- Exact error codes and messages
- Request/response payloads
- Retry attempts
- Network timing

### 2. Performance Issues
Debug logs show:
- API latency for each request
- Time spent in each phase
- Retry delays
- Rate limiting information

### 3. Integration Problems
Debug reveals:
- Configuration issues
- Missing parameters
- Browser compatibility
- Network errors

## Production Considerations

⚠️ **Important**: Debug logging should be **disabled in production** by default:

```javascript
// Production config
const isProduction = process.env.NODE_ENV === 'production';
const debugEnabled = !isProduction && (
  localStorage.getItem('GLIDE_DEBUG') === 'true' ||
  window.location.search.includes('debug=true')
);
```

## Tips for Effective Debugging

1. **Start with Debug ON** during development
2. **Check both frontend and backend logs** for the complete picture
3. **Use browser DevTools Network tab** alongside debug logs
4. **Save logs** when reporting issues to support
5. **Disable debug** before deploying to production

## Example Debug Session

1. Enable debug in both frontend and backend
2. Perform an authentication:
   ```javascript
   // You'll see in console:
   // - Request preparation
   // - Network calls with timing
   // - Strategy selection
   // - Success/failure with context
   ```
3. If there's an error, the logs will show:
   - Exact error code
   - Request that caused it
   - Retry attempts
   - Suggested fixes

## Need Help?

When contacting support:
1. Enable debug logging
2. Reproduce the issue
3. Copy the debug logs
4. Include them in your support request

This will help us resolve your issue much faster! 🚀
