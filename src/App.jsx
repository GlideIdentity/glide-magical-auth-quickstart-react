import React, { useState, useEffect, useRef } from 'react';
import { PhoneAuthClient, UseCase } from '@glideidentity/web-client-sdk/react';
import glideLogo from './assets/Glide-Logomark.svg';
import './App.css';

function App() {
  // State management
  const [flowMode, setFlowMode] = useState('highlevel'); // 'highlevel' | 'granular'
  const [selectedFlow, setSelectedFlow] = useState('verify');
  const [phoneInput, setPhoneInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [debugMode, setDebugMode] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);
  
  // Granular flow state
  const [currentStep, setCurrentStep] = useState(0);
  const [stepOneResp, setStepOneResp] = useState(null);
  const [stepTwoResp, setStepTwoResp] = useState(null);
  const [stepThreeResp, setStepThreeResp] = useState(null);
  const [stepOneError, setStepOneError] = useState(null);
  const [stepTwoError, setStepTwoError] = useState(null);
  const [stepThreeError, setStepThreeError] = useState(null);
  
  // Extended response handlers for retry functionality
  const [extendedResponse, setExtendedResponse] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  
  // PhoneAuthClient instance
  const authClientRef = useRef(null);
  
  // Initialize client on mount
  useEffect(() => {
    authClientRef.current = new PhoneAuthClient({
      endpoints: {
        prepare: '/api/phone-auth/prepare',
        process: '/api/phone-auth/process',
        /* Polling Endpoint Configuration
           Uncomment the line below to enable polling through your backend server.
           If not provided, the SDK will call the Glide Magic Auth server directly.
           Useful for development and production when you want to proxy requests. */
        // polling: '/api/phone-auth/status',
      },
      debug: true, // Enable SDK debug logging to console for development purposes
      /* Mobile DevTools Console
         Uncomment the code below to enable an on-screen console for mobile testing.
         This provides visibility into logs and errors on mobile devices where 
         traditional browser DevTools are not easily accessible. */
      // devtools: {
      //   showMobileConsole: true
      // },
    });
  }, []);
  
  // Debug logging helper
  const addDebugLog = (type, message, data) => {
    if (debugMode) {
      setDebugLogs(prev => [...prev, {
        timestamp: new Date().toLocaleTimeString(),
        type,
        message,
        data
      }]);
    }
  };
  
  // Flow selection handler
  const selectFlow = (flow) => {
    setSelectedFlow(flow);
    setPhoneInput('');
    setError(null);
    setResult(null);
    resetGranularFlow();
    addDebugLog('info', `Flow type changed to: ${flow}`);
  };
  
  // Reset entire application state
  const resetApp = () => {
    // Clean up extended response if exists
    if (extendedResponse && extendedResponse.cancel) {
      extendedResponse.cancel();
    }
    if (extendedResponse && extendedResponse.stop_polling) {
      extendedResponse.stop_polling();
    }
    setFlowMode('highlevel');
    setSelectedFlow('verify');
    setPhoneInput('');
    setLoading(false);
    setError(null);
    setResult(null);
    setDebugLogs([]);
    setExtendedResponse(null);
    setIsPolling(false);
    // Reset granular flow state
    setCurrentStep(0);
    setStepOneResp(null);
    setStepTwoResp(null);
    setStepThreeResp(null);
    setStepOneError(null);
    setStepTwoError(null);
    setStepThreeError(null);
    console.log('[App] Application reset to initial state');
  };
  
  // High-level authentication - Uses SDK's actual high-level API
  const startAuthentication = async () => {
    const authClient = authClientRef.current;
    if (!authClient) {
      setError({ code: 'NO_CLIENT', message: 'Authentication client not initialized' });
      return;
    }
    
    if (selectedFlow === 'verify' && !phoneInput) {
      setError({ code: 'MISSING_PHONE', message: 'Please enter a phone number to verify' });
      return;
    }
    
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      addDebugLog('info', 'Starting high-level authentication', { 
        flow: selectedFlow,
        phone: selectedFlow === 'verify' ? phoneInput : undefined 
      });
      
      let result;
      
      if (selectedFlow === 'get') {
        // High-level API for getting phone number
        console.log('[HighLevel] Calling getPhoneNumberComplete()');
        result = await authClient.getPhoneNumberComplete({
          plmn: { mcc: '310', mnc: '260' }, // T-Mobile USA for GetPhoneNumber
          consent_data: {
            consent_text: 'I agree to verify my phone number',
            policy_link: 'https://example.com/privacy',
            policy_text: 'Privacy Policy'
          }
        });
      } else {
        // High-level API for verifying phone number
        console.log('[HighLevel] Calling verifyPhoneNumberComplete()');
        result = await authClient.verifyPhoneNumberComplete(phoneInput, {
          consent_data: {
            consent_text: 'I agree to verify my phone number',
            policy_link: 'https://example.com/privacy',
            policy_text: 'Privacy Policy'
          }
        });
      }
      
      console.log('[HighLevel] Authentication result:', result);
      setResult(result);
      addDebugLog('success', 'High-level authentication successful', result);
    } catch (err) {
      setError({ 
        code: err.code || 'UNKNOWN_ERROR',
        message: err.message || 'An unexpected error occurred'
      });
      addDebugLog('error', 'High-level authentication failed', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Granular flow functions
  const startGranularFlow = () => {
    setCurrentStep(1);
    resetGranularFlow();
  };
  
  const executeStepOne = async () => {
    const authClient = authClientRef.current;
    if (!authClient) {
      setStepOneError('Authentication client not initialized');
      return;
    }
    
    setLoading(true);
    setStepOneError(null);
    setCurrentStep(1);
    
    try {
      addDebugLog('info', 'Step 1: Preparing authentication');
      
      const options = {
        use_case: selectedFlow === 'get' ? UseCase.GET_PHONE_NUMBER : UseCase.VERIFY_PHONE_NUMBER,
        phone_number: selectedFlow === 'verify' ? phoneInput : undefined,
        plmn: selectedFlow === 'get' ? { mcc: '310', mnc: '260' } : undefined, // T-Mobile USA for GetPhoneNumber
        consent_data: {
          consent_text: 'I agree to verify my phone number',
          policy_link: 'https://example.com/privacy',
          policy_text: 'Privacy Policy'
        }
      };
      
      console.log('[Granular] Step 1: Preparing with options:', options);
      const response = await authClient.preparePhoneRequest(options);
      console.log('[Granular] Step 1: Prepare response:', response);
      setStepOneResp(response);
      setCurrentStep(2);
      addDebugLog('success', 'Step 1 completed', response);
    } catch (err) {
      console.error('[Granular] Step 1: Error during prepare:', err);
      setStepOneError(err.message || 'Failed to prepare authentication');
      addDebugLog('error', 'Step 1 failed', err);
    } finally {
      setLoading(false);
    }
  };
  
  const executeStepTwo = async (isRetry = false) => {
    const authClient = authClientRef.current;
    if (!authClient || !stepOneResp) return;
    
    setLoading(true);
    setStepTwoError(null);
    setCurrentStep(2);
    
    try {
      addDebugLog('info', `Step 2: Invoking secure browser prompt ${isRetry ? '(retry)' : ''}`);
      console.log('[Granular] Step 2: About to invoke secure prompt with:', stepOneResp);
      
      // Use extended mode for better control
      const invokeResult = await authClient.invokeSecurePrompt(stepOneResp, {
        executionMode: 'extended',
        preventDefaultUI: false,
        autoTrigger: !isRetry // Don't auto-trigger on retry
      });
      
      console.log('[Granular] Step 2: Extended invoke result:', invokeResult);
      
      let credential;
      if (invokeResult.strategy === 'link' || invokeResult.strategy === 'desktop') {
        // Store extended response for potential retry
        setExtendedResponse(invokeResult);
        setIsPolling(true);
        
        // For Link strategy, trigger if it's a retry
        if (isRetry && invokeResult.trigger) {
          console.log('[Granular] Step 2: Triggering retry for Link strategy');
          invokeResult.trigger();
        }
        
        // Wait for credential - SDK handles timeout
        const authCredential = await invokeResult.credential;
        // Link and Desktop return AuthCredential object, extract the credential string
        credential = authCredential.credential || authCredential;
        setIsPolling(false);
      } else if (invokeResult.strategy === 'ts43') {
        // TS43 also returns extended format with a credential promise
        console.log('[Granular] Step 2: TS43 extended result:', invokeResult);
        const authCredential = await invokeResult.credential;
        console.log('[Granular] Step 2: TS43 authCredential received:', authCredential);
        // TS43 returns AuthCredential object, extract the credential string
        credential = authCredential.credential || authCredential;
        console.log('[Granular] Step 2: TS43 credential to send:', credential);
      } else {
        // Fallback for any other strategy
        credential = invokeResult.credential ? await invokeResult.credential : invokeResult;
      }
      
      console.log('[Granular] Step 2: Received credential:', credential);
      setStepTwoResp(credential);
      setCurrentStep(3);
      addDebugLog('success', 'Step 2 completed', credential);
      // Clean up extended response
      if (extendedResponse) {
        setExtendedResponse(null);
      }
    } catch (err) {
      console.error('[Granular] Step 2: Error during secure prompt:', err);
      setStepTwoError(err.message || 'Browser verification failed');
      addDebugLog('error', 'Step 2 failed', err);
      setIsPolling(false);
    } finally {
      setLoading(false);
    }
  };
  
  const executeStepThree = async () => {
    const authClient = authClientRef.current;
    if (!authClient || !stepOneResp || !stepTwoResp) return;
    
    setLoading(true);
    setStepThreeError(null);
    setCurrentStep(3);
    
    try {
      addDebugLog('info', 'Step 3: Processing verification');
      console.log('[Granular] Step 3: Processing with credential:', stepTwoResp);
      console.log('[Granular] Step 3: Using session:', stepOneResp.session);
      
      const response = selectedFlow === 'get'
        ? await authClient.getPhoneNumber(stepTwoResp, stepOneResp.session)
        : await authClient.verifyPhoneNumber(stepTwoResp, stepOneResp.session);
      
      console.log('[Granular] Step 3: Final response:', response);
      setStepThreeResp(response);
      setCurrentStep(0);
      addDebugLog('success', 'Step 3 completed', response);
    } catch (err) {
      console.error('[Granular] Step 3: Error during processing:', err);
      setStepThreeError(err.message || 'Verification processing failed');
      addDebugLog('error', 'Step 3 failed', err);
    } finally {
      setLoading(false);
    }
  };
  
  const resetGranularFlow = () => {
    setCurrentStep(0);
    setStepOneResp(null);
    setStepTwoResp(null);
    setStepThreeResp(null);
    setStepOneError(null);
    setStepTwoError(null);
    setStepThreeError(null);
    // Clean up extended response if exists
    if (extendedResponse && extendedResponse.cancel) {
      extendedResponse.cancel();
    }
    setExtendedResponse(null);
    setIsPolling(false);
    addDebugLog('info', 'Granular flow reset');
  };
  
  return (
    <div>
      {/* Header */}
      <header className="header">
        <div className="header-brand" onClick={resetApp} style={{ cursor: 'pointer' }} title="Click to reset">
          <img src={glideLogo} alt="Glide Identity" className="header-logo" />
          <span className="header-company">Glide Identity</span>
        </div>
        <h1>Magical Auth Quick Start</h1>
        <p>Test carrier-grade phone verification in minutes. No SMS, no delays, no fraud.</p>
      </header>
      
      <div className="container">
        {/* Flow Mode Toggle */}
        <section className="section mode-toggle-section">
          <div className="mode-toggle">
            <div className={`toggle-slider ${flowMode === 'granular' ? 'right' : 'left'}`} />
            <button 
              className={`mode-btn ${flowMode === 'highlevel' ? 'active' : ''}`}
              onClick={() => setFlowMode('highlevel')}
            >
              High Level
            </button>
            <button 
              className={`mode-btn ${flowMode === 'granular' ? 'active' : ''}`}
              onClick={() => setFlowMode('granular')}
            >
              Granular
            </button>
          </div>
          <p className="mode-description">
            {flowMode === 'highlevel' 
              ? 'Simple one-click authentication flow' 
              : 'Step-by-step control over each authentication phase' 
            }
          </p>
        </section>
        
        {/* Flow Type Section */}
        <section className="section">
          <div className="section-header">
            <div className="section-icon">
              {/* Toggle Switch Icon */}
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
                {/* <!-- Left option - selected state --> */}
                <rect x="2" y="4" width="9" height="13" rx="1.5" stroke="black" strokeWidth="2" fill="none"/>
                <rect x="4.5" y="7" width="4" height="4" rx="0.5" fill="black"/>
                <path d="M5.5 9 L6.5 10 L7.5 8.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                
                {/* <!-- Right option - unselected state --> */}
                <rect x="13" y="4" width="9" height="13" rx="1.5" stroke="black" strokeWidth="1.5" fill="none" opacity="0.4"/>
                <rect x="15.5" y="7" width="4" height="4" rx="0.5" stroke="black" strokeWidth="1.5" fill="none" opacity="0.4"/>
              </svg>
            </div>
            <div className="section-title">
              <h2>Flow Type</h2>
              <p>Choose what you want to do with the phone verification</p>
            </div>
          </div>
          
          <div className="card-grid two-columns">
            <div 
              className={`card ${selectedFlow === 'verify' ? 'selected' : ''}`}
              onClick={() => selectFlow('verify')}
            >
              <div className="card-icon">
                {/* Checkmark Icon */}
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3>Verify Phone Number</h3>
              <p>Verify if phone matches SIM card through carrier network</p>
            </div>
            
            <div 
              className={`card ${selectedFlow === 'get' ? 'selected' : ''}`}
              onClick={() => selectFlow('get')}
            >
              <div className="card-icon">
                {/* Phone Icon */}
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none">
                  <rect x="7" y="4" width="10" height="16" rx="2" stroke="currentColor" strokeWidth="2"/>
                  <line x1="10" y1="17" x2="14" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h3>Get Phone Number</h3>
              <p>Retrieve phone number from SIM card with carrier verification</p>
            </div>
          </div>
        </section>
        
        {/* Phone Input Section (only for verify flow) */}
        {selectedFlow === 'verify' && (
          <section className="section">
            <div className="section-header">
              <div className="section-icon">
                {/* Phone Call Icon */}
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
                  <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="section-title">
                <h2>Phone Number to Verify</h2>
                <p>Enter the number you want to verify against the SIM card</p>
              </div>
            </div>
            
            <div className="input-group">
              <input 
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="+1 555 123 4567"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    flowMode === 'highlevel' ? startAuthentication(false) : startGranularFlow();
                  }
                }}
              />
            </div>
          </section>
        )}
        
        {/* High-Level Flow */}
        {flowMode === 'highlevel' && (
          <section className="section">
            <div className="section-header">
              <div className="section-icon">
                {/* Lightning Icon */}
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="section-title">
                <h2>Start Authentication</h2>
                <p>Click below to initiate the authentication flow</p>
              </div>
            </div>
            
            {/* Main action button */}
            <button 
              onClick={() => {
                console.log('[App] Starting high-level authentication');
                startAuthentication();
              }}
              disabled={loading || (selectedFlow === 'verify' && !phoneInput)}
              className={`action-button ${loading ? 'loading' : ''}`}
            >
              {!loading ? (
                <span>
                  {selectedFlow === 'verify' ? 'Verify Phone Number' : 'Get Phone Number'}
                </span>
              ) : (
                <span>Processing...</span>
              )}
            </button>
            
            {/* Error Display */}
            {error && (
              <div className="error-message">
                <div style={{ flex: 1 }}>
                  <strong>{error.code || 'Error'}</strong>
                  <p>{error.message}</p>
                  <button 
                    onClick={resetApp}
                    className="reset-button"
                  >
                    Start Over
                  </button>
                </div>
              </div>
            )}
            
            {/* Result Display */}
            {result && (
              <div className="result-success">
                <h3>Authentication Successful!</h3>
                <div className="result-details">
                  <p><strong>Phone Number:</strong> {result.phone_number}</p>
                  <p><strong>Verified:</strong> {selectedFlow === 'verify' && result.verified !== undefined ? (result.verified ? 'Yes' : 'No') : 'Yes'}</p>
                  {result.aud && <p><strong>Audience:</strong> {result.aud}</p>}
                </div>
              </div>
            )}
          </section>
        )}
        
        {/* Granular Flow */}
        {flowMode === 'granular' && (
          <section className="section">
            <div className="section-header">
              <div className="section-icon">
                {/* Settings Icon */}
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
                  <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="section-title">
                <h2>Granular Authentication Steps</h2>
                <p>Control each step of the authentication process</p>
              </div>
            </div>
            
            {/* Step 1: Prepare */}
            <div className={`step-card ${currentStep === 1 ? 'active' : ''} ${stepOneResp ? 'completed' : ''} ${stepOneError ? 'error' : ''}`}>
              <div className="step-header">
                <span className="step-number">1</span>
                <h4>Prepare Authentication</h4>
              </div>
              <p>Initialize the authentication session with the server</p>
              
              <button 
                onClick={executeStepOne}
                disabled={stepOneResp !== null || loading || (selectedFlow === 'verify' && !phoneInput)}
                className="step-button"
              >
                {stepOneResp ? 'Completed' : 'Execute Step'}
              </button>
              
              {stepOneResp && (
                <div className="step-success">
                  Session prepared. Strategy: {stepOneResp.authentication_strategy}
                </div>
              )}
              {stepOneError && (
                <div className="step-error">
                  {stepOneError}
                </div>
              )}
            </div>
            
            {/* Step 2: Browser Verification */}
            <div className={`step-card ${currentStep === 2 ? 'active' : ''} ${stepTwoResp ? 'completed' : ''} ${stepTwoError ? 'error' : ''} ${!stepOneResp ? 'disabled' : ''}`}>
              <div className="step-header">
                <span className="step-number">2</span>
                <h4>Browser Verification</h4>
              </div>
              <p>Invoke secure browser prompt for carrier verification</p>
              
              {isPolling ? (
                <div className="button-group">
                  <button 
                    onClick={() => {
                      if (extendedResponse && extendedResponse.trigger) {
                        console.log('[Granular] Retrying Link trigger');
                        extendedResponse.trigger();
                      }
                    }}
                    className="step-button"
                  >
                    Retry Open
                  </button>
                  <button 
                    onClick={() => {
                      if (extendedResponse && extendedResponse.stop_polling) {
                        extendedResponse.stop_polling();
                      }
                      setExtendedResponse(null);
                      setIsPolling(false);
                      setLoading(false);  // Important: reset loading state
                      setStepTwoError('Cancelled by user - you can retry');
                      console.log('[Granular] Step 2 cancelled, ready to retry');
                    }}
                    className="reset-button"
                    style={{ padding: '10px 20px' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => executeStepTwo(false)}
                  disabled={!stepOneResp || (stepTwoResp !== null && !stepTwoError) || loading}
                  className="step-button"
                >
                  {stepTwoResp ? 'Completed' : 'Execute Step'}
                </button>
              )}
              
              {stepTwoResp && (
                <div className="step-success">
                  Credential obtained from browser
                </div>
              )}
              {stepTwoError && (
                <div className="step-error">
                  <div>{stepTwoError}</div>
                  {(extendedResponse || stepTwoError.includes('Cancelled')) && (
                    <button 
                      onClick={() => executeStepTwo(true)}
                      className="step-button"
                      style={{ marginTop: '10px', padding: '8px 16px', fontSize: '14px' }}
                    >
                      Retry Step
                    </button>
                  )}
                </div>
              )}
            </div>
            
            {/* Step 3: Process Result */}
            <div className={`step-card ${currentStep === 3 ? 'active' : ''} ${stepThreeResp ? 'completed' : ''} ${stepThreeError ? 'error' : ''} ${!stepTwoResp ? 'disabled' : ''}`}>
              <div className="step-header">
                <span className="step-number">3</span>
                <h4>Process Verification</h4>
              </div>
              <p>Send credential to server for final verification</p>
              
              <button 
                onClick={executeStepThree}
                disabled={!stepTwoResp || stepThreeResp !== null || loading}
                className="step-button"
              >
                {stepThreeResp ? 'Completed' : 'Execute Step'}
              </button>
              
              {stepThreeResp && (
                <div className="step-success">
                  Verification complete! Phone: {stepThreeResp.phone_number}
                  {stepThreeResp.verified !== undefined && (
                    <span> - Verified: {stepThreeResp.verified ? 'Yes' : 'No'}</span>
                  )}
                </div>
              )}
              {stepThreeError && (
                <div className="step-error">
                  {stepThreeError}
                </div>
              )}
            </div>
            
            {/* Reset Button */}
            {(stepThreeResp || stepOneError || stepTwoError || stepThreeError) && (
              <button 
                onClick={resetGranularFlow}
                className="reset-button"
              >
                Reset Flow
              </button>
            )}
            
            {/* Final Result Display for Granular */}
            {stepThreeResp && (
              <div className="result-success">
                <h3>Authentication Successful!</h3>
                <div className="result-details">
                  <p><strong>Phone Number:</strong> {stepThreeResp.phone_number}</p>
                  <p><strong>Verified:</strong> {stepThreeResp.verified !== undefined ? (stepThreeResp.verified ? 'Yes' : 'No') : 'Yes'}</p>
                  {stepThreeResp.aud && <p><strong>Audience:</strong> {stepThreeResp.aud}</p>}
                </div>
              </div>
            )}
          </section>
        )}
        
        {/* Debug Mode Toggle */}
        <section className="section debug-section">
          <label className="debug-toggle">
            <input 
              type="checkbox" 
              checked={debugMode}
              onChange={(e) => setDebugMode(e.target.checked)}
            />
            <span>Debug Mode</span>
          </label>
        </section>
        
        {/* Debug Console */}
        {debugMode && debugLogs.length > 0 && (
          <section className="section">
            <div className="section-header">
              <div className="section-icon">
                {/* Search Icon */}
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
                  <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                  <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="section-title">
                <h2>Debug Console</h2>
                <p>Detailed flow information</p>
              </div>
            </div>
            
            <div className="debug-console">
              {debugLogs.map((log, index) => (
                <div key={index} className="debug-entry">
                  <span className="debug-time">{log.timestamp}</span>
                  <span className={`debug-type ${log.type}`}>{log.type}</span>
                  <div className="debug-message">{log.message}</div>
                  {log.data && (
                    <pre className="debug-data">{JSON.stringify(log.data, null, 2)}</pre>
                  )}
                </div>
              ))}
            </div>
            
            <button 
              onClick={() => setDebugLogs([])}
              className="clear-logs-button"
            >
              Clear Logs
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

export default App;