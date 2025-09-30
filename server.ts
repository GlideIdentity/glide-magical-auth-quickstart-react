import express, { Request, Response } from 'express';
import cors from 'cors';
import { 
  GlideClient, 
  MagicAuthError,
  MagicAuthErrorCode,
  MagicAuthPrepareRequest,
  GetPhoneNumberRequest,
  GetPhoneNumberResponse,
  VerifyPhoneNumberRequest,
  VerifyPhoneNumberResponse,
  UseCaseType,
  UseCase
} from 'glide-sdk';

// Define SessionInfo interface matching what frontend sends
// This matches the API specification
interface SessionInfo {
  session_key: string;
  nonce: string;
  enc_key: string;
}

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Type definition for phone auth process request from frontend
// This represents the HTTP request body structure, not an SDK type
interface PhoneAuthProcessRequest {
  // Required fields (snake_case as per API spec)
  credential: string;  // Credential string from frontend
  session: SessionInfo;  // Session from prepare response
  
  // Optional fields
  phone_number?: string; // For verify use case
  use_case?: UseCaseType;
}

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
});

// Phone Auth Request endpoint
// For error responses, we return a custom error format
app.post('/api/phone-auth/prepare', async (req: Request<{}, {}, MagicAuthPrepareRequest>, res: Response) => {
  try {
    console.log('/api/phone-auth/prepare', req.body);
    const { use_case, phone_number, plmn, consent_data, client_info } = req.body;

    // Pre-process the request parameters
    const prepareParams: MagicAuthPrepareRequest = {
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
    if (use_case === UseCase.GET_PHONE_NUMBER && !phone_number && (!plmn || !plmn.mcc || !plmn.mnc)) {
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
        code: error.code,
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
    
    // Handle other errors - use 422 for business logic errors, 500 for true server errors
    console.error('Phone auth request error:', (error as Error).message);
    // Check if it's a network/system error that should be 500
    const isServerError = error instanceof Error && (
      error.message.toLowerCase().includes('network') || 
      error.message.toLowerCase().includes('timeout') ||
      error.message.toLowerCase().includes('econnrefused') ||
      error.message.toLowerCase().includes('enotfound') ||
      error.name === 'TypeError' || // Often indicates system-level issues
      error.name === 'ReferenceError' // Programming errors
    );
    const statusCode = isServerError ? 500 : 422;
    
    res.status(statusCode).json({ 
      code: isServerError ? MagicAuthErrorCode.INTERNAL_SERVER_ERROR : MagicAuthErrorCode.UNPROCESSABLE_ENTITY,
      message: (error as Error).message,
      status: statusCode,
      timestamp: new Date().toISOString(),
      details: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
    });
  }
});

// Phone Auth Process endpoint
app.post('/api/phone-auth/process', async (req: Request<{}, {}, PhoneAuthProcessRequest>, res: Response) => {
  try {
    console.log('/api/phone-auth/process - Full request body:', JSON.stringify(req.body, null, 2));
    console.log('Request headers:', req.headers);
    
    // Extract fields from request (API spec uses snake_case)
    const { credential, session, phone_number } = req.body;
    
    console.log('Extracted fields:', {
      hasCredential: !!credential,
      credentialLength: credential?.length,
      hasSession: !!session,
      sessionKeys: session ? Object.keys(session) : [],
      hasPhoneNumber: !!phone_number
    });
    
    // Validate required fields
    if (!credential) {
      res.status(400).json({
        code: MagicAuthErrorCode.MISSING_PARAMETERS,
        message: 'Missing required field: credential',
        status: 400,
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    if (!session) {
      res.status(400).json({
        code: MagicAuthErrorCode.MISSING_PARAMETERS,
        message: 'Missing required field: session',
        status: 400,
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // Determine which method to call based on whether phoneNumber is provided
    let result: GetPhoneNumberResponse | VerifyPhoneNumberResponse;
    
    if (phone_number) {
      // Use verifyPhoneNumber when a phone number is provided  
      // Rebuild credential structure for Node SDK
      const verifyParams: VerifyPhoneNumberRequest = {
        sessionInfo: session,
        credential: {
          vp_token: { glide: credential }  // SDK expects this format
        }
      };
      console.log('Calling glide.magicAuth.verifyPhoneNumber with session:', verifyParams.sessionInfo);
      result = await glide.magicAuth.verifyPhoneNumber(verifyParams);
      console.log('VerifyPhoneNumber Response:', result);
    } else {
      // Use getPhoneNumber when no phone number is provided
      // Rebuild credential structure for Node SDK
      const getParams: GetPhoneNumberRequest = {
        sessionInfo: session,
        credential: {
          vp_token: { glide: credential }  // SDK expects this format
        }
      };
      console.log('Calling glide.magicAuth.getPhoneNumber with session:', getParams.sessionInfo);
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
        code: error.code,
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
    
    // Handle other errors - use 422 for business logic errors, 500 for true server errors
    console.error('Phone auth process error:', (error as Error).message);
    // Check if it's a network/system error that should be 500
    const isServerError = error instanceof Error && (
      error.message.toLowerCase().includes('network') || 
      error.message.toLowerCase().includes('timeout') ||
      error.message.toLowerCase().includes('econnrefused') ||
      error.message.toLowerCase().includes('enotfound') ||
      error.name === 'TypeError' || // Often indicates system-level issues
      error.name === 'ReferenceError' // Programming errors
    );
    const statusCode = isServerError ? 500 : 422;
    
    res.status(statusCode).json({ 
      code: isServerError ? MagicAuthErrorCode.INTERNAL_SERVER_ERROR : MagicAuthErrorCode.UNPROCESSABLE_ENTITY,
      message: (error as Error).message,
      status: statusCode,
      timestamp: new Date().toISOString(),
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