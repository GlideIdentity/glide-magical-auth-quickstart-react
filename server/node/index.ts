/**
 * =============================================================================
 * Magical Auth Quickstart Server (Node.js with Glide SDK)
 * =============================================================================
 * 
 * This server demonstrates how to use the official @glideidentity/glide-be-sdk-node
 * package to integrate Magical Auth into your application.
 * 
 * Authentication: OAuth2 Client Credentials
 * =============================================================================
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { 
  GlideClient, 
  LogLevel, 
  UseCase, 
  ErrorCode,
  MagicalAuthError,
  BINDING_COOKIE_MAX_AGE,
  getBindingCookieName,
  parseBindingCookie,
  getCompletionPageHtml,
  type PrepareRequest,
  type PrepareResult,
  type GetPhoneNumberRequest,
  type VerifyPhoneNumberRequest,
} from '@glideidentity/glide-be-sdk-node';
import { storeStatusUrl, getStatusUrl, extractStatusUrl } from './session-store';

// Load environment variables from root .env file
// When run via npm scripts, cwd is project root; when run directly, we're in server/node/
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Default T-Mobile US PLMN (used when client doesn't provide one)
const DEFAULT_PLMN = { mcc: '310', mnc: '260' };

// =============================================================================
// Initialize Glide SDK
// =============================================================================

const glide = new GlideClient({
  clientId: process.env.GLIDE_CLIENT_ID,
  clientSecret: process.env.GLIDE_CLIENT_SECRET,
  logLevel: process.env.GLIDE_DEBUG === 'true' ? LogLevel.DEBUG : LogLevel.INFO,
});

// =============================================================================
// Express App Setup
// =============================================================================

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
// Device binding requires credentials: 'include' for HttpOnly cookie passthrough.
// CORS_ORIGIN must match the frontend origin exactly (credentials mode rejects '*').
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());


// =============================================================================
// Health Check Endpoint
// =============================================================================

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    glideInitialized: !!glide,
    glideProperties: ['magicalAuth'],
    env: {
      hasClientId: !!process.env.GLIDE_CLIENT_ID,
      hasClientSecret: !!process.env.GLIDE_CLIENT_SECRET,
    }
  });
});

// =============================================================================
// Phone Auth Endpoints
// =============================================================================

/**
 * Prepare endpoint - initiates the authentication flow
 */
app.post('/api/phone-auth/prepare', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate the request
    if (!req.body.use_case) {
      res.status(400).json({
        error: ErrorCode.MISSING_REQUIRED_FIELD,
        message: 'use_case is required',
        status: 400
      });
      return;
    }

    const prepareRequest = { ...req.body };
    
    // Apply default PLMN for GetPhoneNumber if not provided
    const isGetPhoneNumber = prepareRequest.use_case === UseCase.GET_PHONE_NUMBER || prepareRequest.use_case === 'GetPhoneNumber';
    if (isGetPhoneNumber && !prepareRequest.plmn) {
      prepareRequest.plmn = DEFAULT_PLMN;
      console.log('📶 PLMN not provided in request, defaulting to T-Mobile US (MCC: 310, MNC: 260)');
    }

    console.log('📱 Prepare request:', { use_case: prepareRequest.use_case });
    
    // Prepare the authentication request using the SDK
    const response = await glide.magicalAuth.prepare(prepareRequest as PrepareRequest) as PrepareResult;
    
    console.log('✅ Prepare success:', { 
      strategy: response.authentication_strategy,
      session_key: response.session?.session_key 
    });
    
    // Store status_url for the polling proxy endpoint
    const statusUrl = extractStatusUrl(response);
    if (statusUrl && response.session?.session_key) {
      storeStatusUrl(response.session.session_key, statusUrl);
    }

    // Device binding: set HttpOnly cookie with fe_code for link strategy.
    // Uses Express res.cookie() (framework-native) to avoid raw header injection vectors.
    const sessionKey = response.session?.session_key;
    if (response.feCode && sessionKey) {
      const isSecure = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
      const cookieName = getBindingCookieName(sessionKey);
      res.cookie(cookieName, response.feCode.toLowerCase(), {
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecure,
        path: '/',
        maxAge: BINDING_COOKIE_MAX_AGE * 1000, // Express uses milliseconds
      });
      console.log('🔒 Device binding cookie set for link strategy');
    }

    // Strip feCode from the response — it must NEVER be sent to the client in the body
    const { feCode: _stripped, ...clientResponse } = response;
    res.json(clientResponse);
  } catch (error) {
    console.error('❌ Prepare error:', error);
    
    if (error instanceof MagicalAuthError) {
      res.status(error.status || 500).json({
        error: error.code,
        message: error.message,
        requestId: error.requestId,
        details: error.details,
        status: error.status
      });
      return;
    }

    res.status(500).json({
      error: ErrorCode.INTERNAL_SERVER_ERROR,
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      status: 500,
    });
  }
});

/**
 * Invoke endpoint - reports that an authentication flow was started.
 * This call can be made asynchronously without blocking the flow.
 */
app.post('/api/phone-auth/invoke', async (req: Request, res: Response): Promise<void> => {
  const { session_id } = req.body;
  
  if (!session_id) {
    console.warn('⚠️ [Invoke] No session_id provided');
    res.json({ success: false, reason: 'missing_session_id' });
    return;
  }

  // Log a truncated session ID for debugging
  const sessionIdPreview = session_id.length > 8 ? session_id.substring(0, 8) + '...' : session_id;
  console.log(`📊 [Invoke] Reporting invocation for session: ${sessionIdPreview}`);

  try {
    const result = await glide.magicalAuth.reportInvocation({ session_id });
    console.log('✅ [Invoke] Report response:', result);
    res.json({ success: result.success });
  } catch (error: any) {
    // Log the error but NEVER fail the response with an error status code
    console.error('❌ [Invoke] Failed to report invocation:', error.message || error);
    res.json({ success: false, error: error.message || 'unknown_error' });
  }
});

/**
 * Process endpoint - processes the credential from the browser
 */
app.post('/api/phone-auth/process', async (req: Request, res: Response): Promise<void> => {
  try {
    const { use_case, session, credential } = req.body;
    
    console.log('🔐 Process request:', { use_case });

    // Validate required fields
    if (!use_case || !session || !credential) {
      res.status(400).json({
        error: ErrorCode.MISSING_REQUIRED_FIELD,
        message: 'use_case, session, and credential are required',
        status: 400
      });
      return;
    }

    // Read the device binding code from the HttpOnly cookie set during prepare.
    // This extends device binding verification to the process step (link protocol only).
    const sessionKey = session?.session_key;
    const feCode = sessionKey ? parseBindingCookie(req.headers.cookie, sessionKey) : undefined;
    if (feCode) {
      console.log('🔒 Device binding cookie found for process step');
    }

    let result;

    if (use_case === UseCase.GET_PHONE_NUMBER || use_case === 'GetPhoneNumber') {
      result = await glide.magicalAuth.getPhoneNumber({
        session,
        credential,
        ...(feCode && { fe_code: feCode }),
      } as GetPhoneNumberRequest);
      
      console.log('✅ GetPhoneNumber success:', { 
        phone_number: result.phone_number?.substring(0, 6) + '****' 
      });
    } else if (use_case === UseCase.VERIFY_PHONE_NUMBER || use_case === 'VerifyPhoneNumber') {
      result = await glide.magicalAuth.verifyPhoneNumber({
        session,
        credential,
        ...(feCode && { fe_code: feCode }),
      } as VerifyPhoneNumberRequest);
      
      console.log('✅ VerifyPhoneNumber success:', { 
        verified: result.verified,
        has_sim_swap: !!result.sim_swap,
        has_device_swap: !!result.device_swap,
      });
    } else {
      res.status(400).json({
        error: ErrorCode.INVALID_USE_CASE,
        message: `Invalid use_case. Must be 'GetPhoneNumber' or 'VerifyPhoneNumber', got: ${use_case}`,
        status: 400
      });
      return;
    }

    // The device binding cookie auto-expires (5 min Max-Age), so explicit clearing
    // is optional. Developers can clear it here for immediate cleanup if desired.

    res.json(result);
  } catch (error) {
    console.error('❌ Process error:', error);
    
    if (error instanceof MagicalAuthError) {
      res.status(error.status || 500).json({
        error: error.code,
        message: error.message,
        requestId: error.requestId,
        details: error.details,
        status: error.status
      });
      return;
    }

    res.status(500).json({
      error: ErrorCode.INTERNAL_SERVER_ERROR,
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      status: 500,
    });
  }
});

/**
 * Status endpoint - proxies status checks using the stored status_url
 * 
 * WHY USE A PROXY?
 * 1. Uses the exact status_url from the prepare response (stored server-side)
 * 2. Avoids CORS issues in browser environments
 * 3. Provides server-side logging for debugging
 */
app.get('/api/phone-auth/status/:sessionId', async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req.params;

  if (!sessionId) {
    res.status(400).json({
      error: 'INVALID_REQUEST',
      message: 'Session ID is required',
      status: 400
    });
    return;
  }

  // Get the stored status URL from prepare response
  const statusUrl = getStatusUrl(sessionId);
  
  if (!statusUrl) {
    console.warn(`[Status Proxy] No stored status URL for session: ${sessionId.substring(0, 8)}...`);
    res.status(404).json({
      error: 'SESSION_NOT_FOUND',
      message: 'Session not found. It may have expired or prepare was not called.',
      status: 404
    });
    return;
  }

  console.log(`[Status Proxy] Polling session: ${sessionId.substring(0, 8)}...`);

  try {
    const response = await fetch(statusUrl, {
      headers: { 'Accept': 'application/json' }
    });
    const data = await response.json();

    console.log('[Status Proxy] Status check returned', response.status);

    if (!response.ok) {
      res.status(response.status).json(data);
      return;
    }

    res.json(data);
  } catch (error) {
    console.error('[Status Proxy] Error fetching status:', error);
    res.status(500).json({
      error: 'STATUS_CHECK_FAILED',
      message: 'Failed to check status',
      status: 500
    });
  }
});

// =============================================================================
// Device Binding: Completion Redirect Page
// =============================================================================

/**
 * Completion redirect page — served after carrier authentication.
 * 
 * The aggregator redirects to this URL with agg_code and session_key in the
 * URL fragment. This page extracts them, writes a localStorage signal for the
 * original tab, and POSTs to /api/phone-auth/complete (the browser auto-attaches
 * the _glide_bind HttpOnly cookie).
 */
app.get('/glide-complete', (_req: Request, res: Response) => {
  try {
    const html = getCompletionPageHtml('/api/phone-auth/complete');
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.send(html);
  } catch (error) {
    console.error('❌ Failed to generate completion page:', error);
    res.status(500).send('Internal server error');
  }
});

/**
 * Complete endpoint — called by the completion redirect page.
 * 
 * Reads fe_code from the _glide_bind HttpOnly cookie (auto-attached by the browser),
 * agg_code and session_key from the POST body, and forwards all three to the
 * aggregator's /complete endpoint. Returns 204 on success.
 */
app.post('/api/phone-auth/complete', async (req: Request, res: Response): Promise<void> => {
  const { session_key, agg_code } = req.body;

  if (!session_key || !agg_code) {
    res.status(400).json({
      error: ErrorCode.MISSING_REQUIRED_FIELD,
      message: 'session_key and agg_code are required',
      status: 400
    });
    return;
  }

  // Read fe_code from the session-scoped HttpOnly cookie (set during prepare)
  const rawCookies = req.headers.cookie;
  const feCode = parseBindingCookie(rawCookies, session_key);

  if (!feCode) {
    console.error('❌ Complete: device binding cookie missing or invalid');
    res.status(403).json({
      error: 'MISSING_BINDING_COOKIE',
      message: 'Device binding cookie is missing. The prepare and complete must happen in the same browser.',
      status: 403
    });
    return;
  }

  try {
    console.log('🔐 Complete request for session:', session_key.substring(0, 8) + '...');

    await glide.magicalAuth.complete({
      session_key,
      fe_code: feCode,
      agg_code,
    });

    console.log('✅ Complete succeeded');

    // The device binding cookie is intentionally not cleared here — it is needed
    // by the process step (/verify-phone-number or /get-phone-number) for continued
    // device binding validation. The cookie auto-expires after 5 minutes.
    res.status(204).send();
  } catch (error) {
    console.error('❌ Complete error:', error);

    if (error instanceof MagicalAuthError) {
      res.status(error.status || 500).json({
        error: error.code,
        message: error.message,
        status: error.status
      });
      return;
    }

    res.status(500).json({
      error: ErrorCode.INTERNAL_SERVER_ERROR,
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      status: 500,
    });
  }
});

// =============================================================================
// Start Server
// =============================================================================

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  
  if (process.env.GLIDE_CLIENT_ID && process.env.GLIDE_CLIENT_SECRET) {
    console.log('✅ OAuth2 credentials configured');
  } else {
    console.log('⚠️  Missing OAuth2 credentials. Set GLIDE_CLIENT_ID and GLIDE_CLIENT_SECRET');
  }
  
  console.log('\nAvailable endpoints:');
  console.log('  GET  /api/health');
  console.log('  POST /api/phone-auth/prepare');
  console.log('  POST /api/phone-auth/invoke');
  console.log('  POST /api/phone-auth/process');
  console.log('  GET  /api/phone-auth/status/:sessionId');
  console.log('  GET  /glide-complete                    (device binding redirect page)');
  console.log('  POST /api/phone-auth/complete           (device binding completion)\n');
});
