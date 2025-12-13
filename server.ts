import express, { Request, Response } from 'express';
import cors from 'cors';
import { 
  GlideClient, 
  MagicAuthError,
  MagicAuthErrorCode,
  MagicAuthPrepareRequest,
  UseCase
} from '@glideidentity/glide-sdk';
import type {
  GetPhoneNumberRequest,
  LogFormat,
  VerifyPhoneNumberRequest
} from '@glideidentity/glide-sdk';
// Import web SDK types for request body (they include use_case)
import type {
  GetPhoneNumberRequest as WebGetPhoneNumberRequest,
  VerifyPhoneNumberRequest as WebVerifyPhoneNumberRequest
} from '@glideidentity/web-client-sdk';

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Health check endpoint response type
// This is a custom endpoint, not an SDK type
interface HealthCheckResponse {
  status: string;
  glideInitialized: boolean;
  glideProperties: string[];
  env: {
    hasApiKey: boolean;
    apiBaseUrl: string;
  };
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Glide client with API key
const glide = new GlideClient({
  apiKey: process.env.GLIDE_API_KEY!,
  internal: {
    authBaseUrl: process.env.GLIDE_AUTH_BASE_URL || 'https://oidc.gateway-x.io',
    apiBaseUrl: process.env.GLIDE_API_BASE_URL || 'https://api.glideidentity.app'
  },
  // Developer environment - adds 'developer' header to requests
  ...(process.env.GLIDE_DEV_ENV && { devEnv: process.env.GLIDE_DEV_ENV }),
  logFormat: (process.env.GLIDE_LOG_FORMAT as LogFormat) || 'pretty',
});

// Phone Auth Request endpoint
// For error responses, we return a custom error format
app.post('/api/phone-auth/prepare', async (req: Request<{}, {}, MagicAuthPrepareRequest>, res: Response) => {
  try {
    const response = await glide.magicAuth.prepare(req.body);
    
    res.json(response);
  } catch (error) {
    if (error instanceof MagicAuthError) {
      // MagicAuthError already has the correct format - just pass it through
      res.status(error.status || 500).json(error);
      return;
    }
    
    // For unexpected errors, return a simple error response
    res.status(500).json({ 
      code: MagicAuthErrorCode.INTERNAL_SERVER_ERROR,
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      status: 500
    });
  }
});

// Phone Auth Process endpoint
app.post('/api/phone-auth/process', async (req: Request<{}, {}, WebGetPhoneNumberRequest | WebVerifyPhoneNumberRequest>, res: Response) => {
  try {
    const body = req.body;
    
    // Determine which SDK method to call based on use_case
    if (body.use_case === UseCase.GET_PHONE_NUMBER) {
      const requestParams: GetPhoneNumberRequest = {
        session: body.session,
        credential: body.credential
      };
      const result = await glide.magicAuth.getPhoneNumber(requestParams);
      res.json(result);
    } else if (body.use_case === UseCase.VERIFY_PHONE_NUMBER) {
      const requestParams: VerifyPhoneNumberRequest = {
        session: body.session,
        credential: body.credential
      };
      const result = await glide.magicAuth.verifyPhoneNumber(requestParams);
      res.json(result);
    } else {
      // This should never happen as the union types enforce valid use_case values
      throw new MagicAuthError({
        code: MagicAuthErrorCode.VALIDATION_ERROR,
        message: `Invalid use_case. Must be '${UseCase.GET_PHONE_NUMBER}' or '${UseCase.VERIFY_PHONE_NUMBER}'`,
        status: 400
      });
    }
  } catch (error) {
    if (error instanceof MagicAuthError) {
      res.status(error.status || 500).json(error);
      return;
    }
    
    // For unexpected errors, return a simple error response
    res.status(500).json({ 
      code: MagicAuthErrorCode.INTERNAL_SERVER_ERROR,
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      status: 500
    });
  }
});

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response<HealthCheckResponse>) => {
  res.json({ 
    status: 'ok',
    glideInitialized: !!glide,
    glideProperties: glide ? Object.keys(glide) : [],
    env: {
      hasApiKey: !!process.env.GLIDE_API_KEY,
      apiBaseUrl: process.env.GLIDE_API_BASE_URL || 'https://api.glideidentity.app'
    }
  });
});

/**
 * Status Proxy Endpoint for Desktop/QR Authentication Polling
 * 
 * PURPOSE:
 * This endpoint proxies status polling requests to the Magic Auth server.
 * It's used during desktop QR code authentication to check if the user
 * has completed authentication on their mobile device.
 * 
 * WHY USE A PROXY:
 * 1. CORS Avoidance: Browser security blocks direct cross-origin requests
 *    to Magic Auth servers. This proxy runs on the same origin as your app.
 * 2. Developer Debugging: Requests appear in your server logs, making it
 *    easier to debug authentication flows during development.
 * 3. Environment Flexibility: Easily switch between prod/staging/dev
 *    environments using GLIDE_API_BASE_URL env variable.
 * 
 * ALTERNATIVE - DIRECT CALLS:
 * You can skip this proxy by NOT configuring 'polling' in the SDK:
 * 
 *   // In your frontend SDK config, remove or comment out:
 *   // polling: '/api/phone-auth/status'
 *   
 * When 'polling' is not set, the SDK will:
 * 1. First try using the status_url from the prepare response
 * 2. Fall back to calling Magic Auth's public endpoint directly:
 *    https://api.glideidentity.app/public/status/{sessionId}
 * 
 * Note: Direct calls may have CORS issues in some environments.
 */
app.get('/api/phone-auth/status/:sessionId', async (req, res) => {
  try {
    const apiBaseUrl = process.env.GLIDE_API_BASE_URL || 'https://api.glideidentity.app';
    const statusUrl = `${apiBaseUrl}/public/status/${req.params.sessionId}`;
    console.log(`[Status Proxy] Fetching status for session: ${req.params.sessionId}`);
    console.log(`[Status Proxy] Using URL: ${statusUrl}`);
    const response = await fetch(
      statusUrl,
      { 
        headers: { 
          'Accept': 'application/json',
          ...(process.env.GLIDE_DEV_ENV && { 'developer': process.env.GLIDE_DEV_ENV })
        }
      }
    );
    
    if (!response.ok) {
      console.log(`[Status Proxy] Status check returned ${response.status}`);
      const errorText = await response.text();
      return res.status(response.status).send(errorText);
    }
    
    const data = await response.json();
    console.log(`[Status Proxy] Status response:`, data);
    res.json(data);
  } catch (error: any) {
    console.error('[Status Proxy] Error:', error);
    res.status(500).json({ 
      error: 'Status check failed', 
      message: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Using Glide API: ${process.env.GLIDE_API_BASE_URL || 'https://api.glideidentity.app'}`);
  if (!process.env.GLIDE_API_KEY) {
    console.warn('⚠️  Missing Glide API key. Please check your .env file.');
  }
}); 