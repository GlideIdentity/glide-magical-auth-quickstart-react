import express, { Request, Response } from 'express';
import cors from 'cors';
import { GlideClient, AuthV2PrepDto, MagicAuthError } from 'glide-sdk';

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Type definitions

interface PhoneAuthProcessRequest {
  response: any; // The credential response object from the client
  sessionInfo: any;  // Required: Full SessionInfo object from prepare response
  phoneNumber?: string;
  options?: any;  // Optional options for session metadata
}

interface AuthProcessResponse {
  phone_number?: string;
  phoneNumber?: string;
  verified?: boolean;
  [key: string]: any;
}

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
    apiBaseUrl: process.env.GLIDE_API_BASE_URL || 'https://api.glideidentity.app',
    authBaseUrl: process.env.GLIDE_AUTH_BASE_URL || 'https://oidc.gateway-x.io'
  },
});

// Phone Auth Request endpoint
app.post('/api/phone-auth/prepare', async (req: Request<{}, {}, AuthV2PrepDto>, res: Response) => {
  try {
    console.log('/api/phone-auth/prepare', req.body);
    const { use_case, phone_number, plmn, consent_data, client_info } = req.body;

    // Pre-process the request parameters
    const prepareParams: any = {
      use_case
    };

    // Always include phone_number if provided
    if (phone_number) {
      console.log('Including phone number:', phone_number);
      prepareParams.phone_number = phone_number;
    }

    // Include PLMN if provided with both mcc and mnc
    if (plmn && plmn.mcc && plmn.mnc) {
      console.log('Including PLMN:', plmn);
      prepareParams.plmn = plmn;
    }

    // For GetPhoneNumber use case, if neither phone_number nor PLMN was provided, use default T-Mobile PLMN
    if (use_case === 'GetPhoneNumber' && !phone_number && (!plmn || !plmn.mcc || !plmn.mnc)) {
      console.log('No phone_number or PLMN provided for GetPhoneNumber, using default T-Mobile PLMN');
      prepareParams.plmn = {
        mcc: '310',
        mnc: '260'  // T-Mobile USA
      };
    }

    // Add consent data if provided
    if (consent_data) {
      prepareParams.consent_data = {
        consent_text: consent_data.consent_text,
        policy_link: consent_data.policy_link,
        policy_text: consent_data.policy_text
      };
    }

    // Add client_info if provided (for browser/platform detection)
    if (client_info) {
      console.log('Including client_info:', client_info);
      prepareParams.client_info = client_info;
    }

    console.log('Calling glide.magicAuth.prepare with:', prepareParams);
    const response = await glide.magicAuth.prepare(prepareParams);
    console.log('Response from SDK:', response);
    
    // The Node SDK now returns the response in the correct format
    if (response.authentication_strategy && response.data && response.session) {
      console.log('Forwarding response from SDK:', response);
      res.json(response);
    } else {
      throw new Error('Unexpected response format from Glide SDK');
    }
  } catch (error) {
    console.log('Caught error:', error);
    
    if (error instanceof MagicAuthError) {
      // You now have access to all error details
      console.log('MagicAuthError details:', {
        code: error.code,
        message: error.message,
        status: error.status,
        requestId: error.requestId,
        traceId: error.traceId,
        spanId: error.spanId,
        details: error.details
      });
      
      // Return the structured error to frontend with proper status
      const httpStatus = error.status || 500;
      res.status(httpStatus).json({
        error: error.code,
        message: error.message,
        requestId: error.requestId,
        timestamp: error.timestamp,
        traceId: error.traceId,
        spanId: error.spanId,
        details: error.details,
        status: error.status // Include status in response for client to use
      });
      return;
    }
    
    // Handle other errors
    console.error('Phone auth request error:', (error as Error).message);
    res.status(500).json({ 
      error: 'UNEXPECTED_ERROR',
      message: (error as Error).message,
      details: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
    });
  }
});

// Phone Auth Process endpoint
app.post('/api/phone-auth/process', async (req: Request<{}, {}, PhoneAuthProcessRequest>, res: Response) => {
  try {
    console.log('/api/phone-auth/process', req.body);
    const { response, sessionInfo, phoneNumber } = req.body;
    
    // Use the required SessionInfo
    const sessionToUse = sessionInfo;
    
    // Determine which method to call based on whether phoneNumber is provided
    let result: any;
    
    if (phoneNumber) {
      // Use verifyPhoneNumber when a phone number is provided
      const verifyParams = {
        sessionInfo: sessionInfo,
        credential: response,
        ...(req.body.options && { options: req.body.options })
      };
      console.log('Calling glide.magicAuth.verifyPhoneNumber with sessionInfo:', verifyParams.sessionInfo);
      result = await glide.magicAuth.verifyPhoneNumber(verifyParams);
      console.log('VerifyPhoneNumber Response:', result);
    } else {
      // Use getPhoneNumber when no phone number is provided
      const getParams = {
        sessionInfo: sessionInfo,
        credential: response,
        ...(req.body.options && { options: req.body.options })
      };
      console.log('Calling glide.magicAuth.getPhoneNumber with sessionInfo:', getParams.sessionInfo);
      result = await glide.magicAuth.getPhoneNumber(getParams);
      console.log('GetPhoneNumber Response:', result);
    }

    // Return the result as-is from the SDK
    res.json(result);
  } catch (error) {
    console.log('Caught error:', error);
    
    if (error instanceof MagicAuthError) {
      // You now have access to all error details
      console.log('MagicAuthError details:', {
        code: error.code,
        message: error.message,
        status: error.status,
        requestId: error.requestId,
        traceId: error.traceId,
        spanId: error.spanId,
        details: error.details
      });
      
      // Return the structured error to frontend with proper status
      const httpStatus = error.status || 500;
      res.status(httpStatus).json({
        error: error.code,
        message: error.message,
        requestId: error.requestId,
        timestamp: error.timestamp,
        traceId: error.traceId,
        spanId: error.spanId,
        details: error.details,
        status: error.status // Include status in response for client to use
      });
      return;
    }
    
    // Handle other errors
    console.error('Phone auth process error:', (error as Error).message);
    res.status(500).json({ 
      error: 'UNEXPECTED_ERROR',
      message: (error as Error).message,
      details: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Using Glide API: ${process.env.GLIDE_API_BASE_URL || 'https://api.glideidentity.app'}`);
  if (!process.env.GLIDE_API_KEY) {
    console.warn('⚠️  Missing Glide API key. Please check your .env file.');
  }
}); 