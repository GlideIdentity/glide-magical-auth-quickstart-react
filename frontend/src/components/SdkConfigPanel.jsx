import React from 'react';

/**
 * SDK Configuration Panel Component
 * 
 * Separates the SDK configuration UI from the main authentication flow,
 * making the main App.jsx easier to understand and focus on the core SDK usage.
 */
const SdkConfigPanel = ({ 
  isOpen, 
  onClose, 
  config, 
  onConfigChange, 
  onApply, 
  onReset 
}) => {
  const handleChange = (key, value) => {
    onConfigChange(key, value);
  };

  return (
    <>
      {/* Overlay */}
      <div 
        className={`config-overlay ${isOpen ? 'open' : ''}`} 
        onClick={onClose} 
      />
      
      {/* Panel */}
      <aside className={`config-panel ${isOpen ? 'open' : ''}`}>
        <div className="config-header">
          <h2>SDK Configuration</h2>
          <button onClick={onClose}>✕</button>
        </div>
        
        <div className="config-body">
          {/* Core Options */}
          <div className="config-section">
            <h3>Core Options</h3>
            
            <div className="config-field">
              <label>Polling Interval (ms)</label>
              <p className="config-hint">How often to check authentication status. Lower = faster updates, higher = less network traffic.</p>
              <input 
                type="number" 
                value={config.pollingInterval}
                onChange={(e) => handleChange('pollingInterval', parseInt(e.target.value) || 2000)}
              />
            </div>
            
            <div className="config-field">
              <label>Max Polling Attempts</label>
              <p className="config-hint">Maximum retries before timeout. With 2s interval: 30 attempts = 1 minute timeout.</p>
              <input 
                type="number" 
                value={config.maxPollingAttempts}
                onChange={(e) => handleChange('maxPollingAttempts', parseInt(e.target.value) || 30)}
              />
            </div>
          </div>
          
          {/* Modal Options */}
          <div className="config-section">
            <h3>Modal Options</h3>
            
            <div className="config-section-note">
              These options affect the QR code modal displayed during desktop authentication via the <code>invokeSecurePrompt</code> method (Granular mode Step 2).
            </div>
            
            <div className="config-field">
              <label>Modal Theme</label>
              <p className="config-hint">Color theme for the QR code modal. 'Auto' uses system preference.</p>
              <select 
                value={config.modalTheme}
                onChange={(e) => handleChange('modalTheme', e.target.value)}
              >
                <option value="auto">Auto (System Preference)</option>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>
            
            <div className="config-field">
              <label>View Mode</label>
              <p className="config-hint">Layout style for the QR code modal</p>
              <select 
                value={config.viewMode}
                onChange={(e) => handleChange('viewMode', e.target.value)}
              >
                <option value="toggle">Toggle (iOS/Android switch)</option>
                <option value="dual">Dual (Both QR codes side by side)</option>
                <option value="pre-step">Pre-step (Choose OS first)</option>
              </select>
            </div>
            
            <div className="config-field">
              <label>Title</label>
              <p className="config-hint">Custom title text for the modal header</p>
              <input 
                type="text" 
                value={config.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="Scan to Verify"
              />
            </div>
            
            <div className="config-field">
              <label>Description</label>
              <p className="config-hint">Optional subtitle text below the title</p>
              <input 
                type="text" 
                value={config.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Use your phone camera"
              />
            </div>
            
            {/* Toggle fields */}
            <div className="config-field toggle">
              <div className="toggle-label-group">
                <label>Show Close Button</label>
                <p className="toggle-hint">Display the X button to close the modal</p>
              </div>
              <label className="config-toggle-switch">
                <input 
                  type="checkbox" 
                  checked={config.showCloseButton}
                  onChange={(e) => handleChange('showCloseButton', e.target.checked)}
                />
                <span className="config-toggle-track"></span>
              </label>
            </div>
            
            <div className="config-field toggle">
              <div className="toggle-label-group">
                <label>Close on Backdrop Click</label>
                <p className="toggle-hint">Allow closing by clicking outside the modal</p>
              </div>
              <label className="config-toggle-switch">
                <input 
                  type="checkbox" 
                  checked={config.closeOnBackdrop}
                  onChange={(e) => handleChange('closeOnBackdrop', e.target.checked)}
                />
                <span className="config-toggle-track"></span>
              </label>
            </div>
            
            <div className="config-field toggle">
              <div className="toggle-label-group">
                <label>Close on Escape Key</label>
                <p className="toggle-hint">Allow closing by pressing the Escape key</p>
              </div>
              <label className="config-toggle-switch">
                <input 
                  type="checkbox" 
                  checked={config.closeOnEscape}
                  onChange={(e) => handleChange('closeOnEscape', e.target.checked)}
                />
                <span className="config-toggle-track"></span>
              </label>
            </div>
            
            {/* Developer Note */}
            <div className="config-developer-note">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
              </svg>
              <p>
                <strong>Developer Note:</strong> You can build your own custom UI by using <code>preventDefaultUI: true</code> in the invoke options. This gives you full control over the QR code display and authentication flow.
              </p>
            </div>
          </div>
          
        </div>
        
        <div className="config-footer">
          <button onClick={onReset} className="btn-secondary">Reset</button>
          <button onClick={onApply} className="btn-primary">Apply</button>
        </div>
      </aside>
    </>
  );
};

export default SdkConfigPanel;

