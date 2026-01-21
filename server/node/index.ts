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
  type PrepareRequest,
  type GetPhoneNumberRequest,
  type VerifyPhoneNumberRequest,
} from '@glideidentity/glide-be-sdk-node';
import { storeStatusUrl, getStatusUrl, extractStatusUrl } from './session-store';

// Load environment variables from root .env file
// When run via npm scripts, cwd is project root; when run directly, we're in server/node/
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

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
app.use(cors());
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

    console.log('📱 Prepare request:', { use_case: req.body.use_case });
    
    // Prepare the authentication request using the SDK
    const response = await glide.magicalAuth.prepare(req.body as PrepareRequest);
    
    console.log('✅ Prepare success:', { 
      strategy: response.authentication_strategy,
      session_key: response.session?.session_key 
    });
    
    // Store status_url for the polling proxy endpoint
    const statusUrl = extractStatusUrl(response);
    if (statusUrl && response.session?.session_key) {
      storeStatusUrl(response.session.session_key, statusUrl);
    }
    
    res.json(response);
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

    let result;

    if (use_case === UseCase.GET_PHONE_NUMBER || use_case === 'GetPhoneNumber') {
      // Get the phone number using the SDK
      result = await glide.magicalAuth.getPhoneNumber({
        session,
        credential
      } as GetPhoneNumberRequest);
      
      console.log('✅ GetPhoneNumber success:', { 
        phone_number: result.phone_number?.substring(0, 6) + '****' 
      });
    } else if (use_case === UseCase.VERIFY_PHONE_NUMBER || use_case === 'VerifyPhoneNumber') {
      // Verify the phone number using the SDK
      result = await glide.magicalAuth.verifyPhoneNumber({
        session,
        credential
      } as VerifyPhoneNumberRequest);
      
      console.log('✅ VerifyPhoneNumber success:', { 
        verified: result.verified 
      });
    } else {
      res.status(400).json({
        error: ErrorCode.INVALID_USE_CASE,
        message: `Invalid use_case. Must be 'GetPhoneNumber' or 'VerifyPhoneNumber', got: ${use_case}`,
        status: 400
      });
      return;
    }

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
  console.log('  GET  /api/phone-auth/status/:sessionId\n');
});
