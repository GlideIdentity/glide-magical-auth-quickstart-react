import React, { useState, useEffect, useRef } from 'react';
import { PhoneAuthClient, UseCase } from '@glideidentity/web-client-sdk';
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
  
  // PhoneAuthClient instance
  const authClientRef = useRef(null);
  
  // Initialize client on mount
  useEffect(() => {
    authClientRef.current = new PhoneAuthClient({
      endpoints: {
        prepare: '/api/phone-auth/prepare',
        process: '/api/phone-auth/process',
        polling: '/api/phone-auth/status'
      },
      debug: true, // Enable SDK debug logging to console
      timeout: 30000,
      pollingInterval: 2000, // Poll every 2 seconds
      maxPollingAttempts: 60, // Try for 2 minutes max
    });
    console.log('[App] SDK initialized with polling proxy endpoint');
    addDebugLog('info', 'PhoneAuthClient initialized with polling proxy', { 
      endpoints: '/api/phone-auth/*',
      polling: '/api/phone-auth/status/{{session_id}}'
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
  
  // High-level authentication
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
      addDebugLog('info', 'Starting authentication', { 
        flow: selectedFlow,
        phone: selectedFlow === 'verify' ? phoneInput : undefined 
      });
      
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
      
      const response = selectedFlow === 'get' 
        ? await authClient.getPhoneNumberComplete(options)
        : await authClient.verifyPhoneNumberComplete(phoneInput, options);
      
      setResult(response);
      addDebugLog('success', 'Authentication successful', response);
    } catch (err) {
      setError({ 
        code: err.code || 'UNKNOWN_ERROR',
        message: err.message || 'An unexpected error occurred'
      });
      addDebugLog('error', 'Authentication failed', err);
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
  
  const executeStepTwo = async () => {
    const authClient = authClientRef.current;
    if (!authClient || !stepOneResp) return;
    
    setLoading(true);
    setStepTwoError(null);
    setCurrentStep(2);
    
    try {
      addDebugLog('info', 'Step 2: Invoking secure browser prompt');
      console.log('[Granular] Step 2: About to invoke secure prompt with:', stepOneResp);
      
      const credential = await authClient.invokeSecurePrompt(stepOneResp);
      console.log('[Granular] Step 2: Received credential:', credential);
      setStepTwoResp(credential);
      setCurrentStep(3);
      addDebugLog('success', 'Step 2 completed', credential);
    } catch (err) {
      console.error('[Granular] Step 2: Error during secure prompt:', err);
      setStepTwoError(err.message || 'Browser verification failed');
      addDebugLog('error', 'Step 2 failed', err);
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
    addDebugLog('info', 'Granular flow reset');
  };
  
  return (
    <div>
      {/* Header */}
      <header className="header">
        <div className="header-brand">
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
            <button 
              className={`mode-btn ${flowMode === 'highlevel' ? 'active' : ''}`}
              onClick={() => setFlowMode('highlevel')}
            >
              <span className="mode-icon">⚡</span>
              High Level
            </button>
            <button 
              className={`mode-btn ${flowMode === 'granular' ? 'active' : ''}`}
              onClick={() => setFlowMode('granular')}
            >
              <span className="mode-icon">🔧</span>
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
            <div className="section-icon">📱</div>
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
              <div className="card-icon">✓</div>
              <h3>Verify Phone Number</h3>
              <p>Verify if phone matches SIM card through carrier network</p>
            </div>
            
            <div 
              className={`card ${selectedFlow === 'get' ? 'selected' : ''}`}
              onClick={() => selectFlow('get')}
            >
              <div className="card-icon">📲</div>
              <h3>Get Phone Number</h3>
              <p>Retrieve phone number from SIM card with carrier verification</p>
            </div>
          </div>
        </section>
        
        {/* Phone Input Section (only for verify flow) */}
        {selectedFlow === 'verify' && (
          <section className="section">
            <div className="section-header">
              <div className="section-icon">📞</div>
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
                    flowMode === 'highlevel' ? startAuthentication() : startGranularFlow();
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
              <div className="section-icon">🚀</div>
              <div className="section-title">
                <h2>Start Authentication</h2>
                <p>Click below to initiate the authentication flow</p>
              </div>
            </div>
            
            <button 
              onClick={startAuthentication}
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
                <span className="error-icon">⚠️</span>
                <div>
                  <strong>{error.code || 'Error'}</strong>
                  <p>{error.message}</p>
                </div>
              </div>
            )}
            
            {/* Result Display */}
            {result && (
              <div className="result-success">
                <h3>✅ Authentication Successful!</h3>
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
              <div className="section-icon">🔧</div>
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
                {stepOneResp ? '✓ Completed' : 'Execute Step'}
              </button>
              
              {stepOneResp && (
                <div className="step-success">
                  ✓ Session prepared. Strategy: {stepOneResp.authentication_strategy}
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
              
              <button 
                onClick={executeStepTwo}
                disabled={!stepOneResp || stepTwoResp !== null || loading}
                className="step-button"
              >
                {stepTwoResp ? '✓ Completed' : 'Execute Step'}
              </button>
              
              {stepTwoResp && (
                <div className="step-success">
                  ✓ Credential obtained from browser
                </div>
              )}
              {stepTwoError && (
                <div className="step-error">
                  {stepTwoError}
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
                {stepThreeResp ? '✓ Completed' : 'Execute Step'}
              </button>
              
              {stepThreeResp && (
                <div className="step-success">
                  ✓ Verification complete! Phone: {stepThreeResp.phone_number}
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
                <h3>✅ Authentication Successful!</h3>
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
              <div className="section-icon">🔍</div>
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