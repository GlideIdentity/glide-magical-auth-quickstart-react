/**
 * =============================================================================
 * Magical Auth Quickstart Server (Node.js with @glideidentity/glide-be-node-magical-auth SDK)
 * =============================================================================
 * 
 * This server demonstrates how to use the @glideidentity/glide-be-node-magical-auth SDK
 * to integrate Magical Auth into your application.
 * 
 * Authentication: OAuth2 Client Credentials
 * =============================================================================
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { 
  MagicalAuthClient,
  MagicalAuthError,
  ErrorCode,
  UseCase,
  BINDING_COOKIE_MAX_AGE,
  getBindingCookieName,
  parseBindingCookie,
  getCompletionPageHtml,
  type PrepareRequest,
  type PrepareResult,
  type GetPhoneNumberRequest,
  type VerifyPhoneNumberRequest,
  type Logger,
} from '@glideidentity/glide-be-node-magical-auth';

// Load environment variables from root .env file
// When run via npm scripts, cwd is project root; when run directly, we're in server/node/
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Default T-Mobile US PLMN (used when client doesn't provide one)
const DEFAULT_PLMN = { mcc: '310', mnc: '260' };

// Console logger that respects the GLIDE_DEBUG env var for debug-level messages
const consoleLogger: Logger = {
  debug: (msg, meta) => { if (process.env.GLIDE_DEBUG === 'true') console.debug(`[SDK] ${msg}`, meta ?? ''); },
  info: (msg, meta) => console.info(`[SDK] ${msg}`, meta ?? ''),
  warn: (msg, meta) => console.warn(`[SDK] ${msg}`, meta ?? ''),
  error: (msg, meta) => console.error(`[SDK] ${msg}`, meta ?? ''),
};

// =============================================================================
// Initialize Magical Auth SDK
// =============================================================================

const magicalAuth = new MagicalAuthClient({
  clientId: process.env.GLIDE_CLIENT_ID!,
  clientSecret: process.env.GLIDE_CLIENT_SECRET!,
  baseUrl: process.env.GLIDE_API_BASE_URL || undefined,
  logger: consoleLogger,
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
// Helpers
// =============================================================================

/**
 * Shared error handler for SDK errors.
 * Extracts structured error fields from MagicalAuthError for the client.
 */
function handleSdkError(res: Response, error: unknown): void {
  if (error instanceof MagicalAuthError) {
    const httpStatus = error.status || 500;
    res.status(httpStatus).json({
      error: error.code,
      message: error.message,
      requestId: error.requestId,
      details: error.details,
      status: httpStatus,
    });
    return;
  }

  res.status(500).json({
    error: ErrorCode.INTERNAL_SERVER_ERROR,
    message: error instanceof Error ? error.message : 'An unexpected error occurred',
    status: 500,
  });
}

// =============================================================================
// Health Check Endpoint
// =============================================================================

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    sdk: '@glideidentity/glide-be-node-magical-auth',
    sdkInitialized: !!magicalAuth,
    env: {
      hasClientId: !!process.env.GLIDE_CLIENT_ID,
      hasClientSecret: !!process.env.GLIDE_CLIENT_SECRET,
    },
  });
});

// =============================================================================
// Magical Auth Endpoints
// =============================================================================

/**
 * Prepare endpoint - initiates the authentication flow
 */
app.post('/api/magical-auth/prepare', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate the request
    if (!req.body.use_case) {
      res.status(400).json({
        error: ErrorCode.VALIDATION_ERROR,
        message: 'use_case is required',
        status: 400,
      });
      return;
    }

    const prepareRequest = { ...req.body };
    
    // Apply default PLMN for GetPhoneNumber if not provided
    if (prepareRequest.use_case === UseCase.GET_PHONE_NUMBER && !prepareRequest.plmn) {
      prepareRequest.plmn = DEFAULT_PLMN;
      console.log('📶 PLMN not provided in request, defaulting to T-Mobile US (MCC: 310, MNC: 260)');
    }

    console.log('📱 Prepare request:', { use_case: prepareRequest.use_case });
    
    // Prepare the authentication request using the SDK
    const response: PrepareResult = await magicalAuth.prepare(prepareRequest as PrepareRequest);
    
    console.log('✅ Prepare success:', { 
      strategy: response.authentication_strategy,
      session_key: response.session?.session_key,
    });
    
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
    handleSdkError(res, error);
  }
});

/**
 * Invoke endpoint - reports that an authentication flow was started.
 * This call can be made asynchronously without blocking the flow.
 * Used for Authentication Success Rate (ASR) tracking.
 */
app.post('/api/magical-auth/report-invocation', async (req: Request, res: Response): Promise<void> => {
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
    // The new SDK takes sessionId as a string parameter (not an object)
    const result = await magicalAuth.reportInvocation(session_id);
    console.log('✅ [Invoke] Report response:', result);
    res.json({ success: !!result });
  } catch (error: unknown) {
    // Log the error but NEVER fail the response with an error status code
    const msg = error instanceof Error ? error.message : 'unknown_error';
    console.error('❌ [Invoke] Failed to report invocation:', msg);
    res.json({ success: false, error: msg });
  }
});

/**
 * Process endpoint - processes the credential from the browser.
 * Dispatches to either getPhoneNumber or verifyPhoneNumber based on use_case.
 */
app.post('/api/magical-auth/process', async (req: Request, res: Response): Promise<void> => {
  try {
    const { use_case, session, credential } = req.body;
    
    console.log('🔐 Process request:', { use_case });

    // Validate required fields
    if (!use_case || !session || !credential) {
      res.status(400).json({
        error: ErrorCode.VALIDATION_ERROR,
        message: 'use_case, session, and credential are required',
        status: 400,
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

    if (use_case === UseCase.GET_PHONE_NUMBER) {
      result = await magicalAuth.getPhoneNumber({
        session,
        credential,
        ...(feCode && { fe_code: feCode }),
      } as GetPhoneNumberRequest);
      
      console.log('✅ GetPhoneNumber success:', { 
        phone_number: result.phone_number?.substring(0, 6) + '****',
      });
    } else if (use_case === UseCase.VERIFY_PHONE_NUMBER) {
      result = await magicalAuth.verifyPhoneNumber({
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
        error: ErrorCode.VALIDATION_ERROR,
        message: `Invalid use_case. Must be '${UseCase.GET_PHONE_NUMBER}' or '${UseCase.VERIFY_PHONE_NUMBER}', got: ${use_case}`,
        status: 400,
      });
      return;
    }

    // The device binding cookie auto-expires (5 min Max-Age), so explicit clearing
    // is optional. Developers can clear it here for immediate cleanup if desired.

    res.json(result);
  } catch (error) {
    console.error('❌ Process error:', error);
    handleSdkError(res, error);
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
 * original tab, and POSTs to /api/magical-auth/complete (the browser auto-attaches
 * the _glide_bind HttpOnly cookie).
 */
app.get('/glide-complete', (_req: Request, res: Response) => {
  try {
    const html = getCompletionPageHtml('/api/magical-auth/complete');
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
app.post('/api/magical-auth/complete', async (req: Request, res: Response): Promise<void> => {
  const { session_key, agg_code } = req.body;

  if (!session_key || !agg_code) {
    res.status(400).json({
      error: ErrorCode.VALIDATION_ERROR,
      message: 'session_key and agg_code are required',
      status: 400,
    });
    return;
  }

  // Read fe_code from the session-scoped HttpOnly cookie (set during prepare)
  const rawCookies = req.headers.cookie;
  const feCode = parseBindingCookie(rawCookies, session_key);

  if (!feCode) {
    console.error('❌ Complete: device binding cookie missing or invalid');
    res.status(403).json({
      error: ErrorCode.MISSING_BINDING_COOKIE,
      message: 'Device binding cookie is missing. The prepare and complete must happen in the same browser.',
      status: 403,
    });
    return;
  }

  try {
    console.log('🔐 Complete request for session:', session_key.substring(0, 8) + '...');

    await magicalAuth.complete({
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
    handleSdkError(res, error);
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

  console.log(`📦 SDK: @glideidentity/glide-be-node-magical-auth (MagicalAuthClient)`);
  
  console.log('\nAvailable endpoints:');
  console.log('  GET  /api/health');
  console.log('  POST /api/magical-auth/prepare');
  console.log('  POST /api/magical-auth/report-invocation');
  console.log('  POST /api/magical-auth/process');
  console.log('  GET  /glide-complete                        (device binding redirect page)');
  console.log('  POST /api/magical-auth/complete             (device binding completion)\n');
});
