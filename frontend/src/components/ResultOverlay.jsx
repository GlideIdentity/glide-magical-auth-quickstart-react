import React, { useEffect, useState } from 'react';

const AUTO_DISMISS_MS = 12000;

function maskPhone(phone) {
  if (!phone || phone.length < 6) return phone || '';
  return phone.slice(0, 3) + ' *** *** ' + phone.slice(-4);
}

function simRiskConfig(riskLevel) {
  switch (riskLevel) {
    case 'RISK_LEVEL_HIGH':
      return { label: 'High Risk', color: '#dc2626', bg: 'rgba(220,38,38,0.1)', description: 'Recent SIM change detected' };
    case 'RISK_LEVEL_MEDIUM':
      return { label: 'Medium', color: '#d97706', bg: 'rgba(217,119,6,0.1)', description: 'SIM changed within 30 days' };
    case 'RISK_LEVEL_LOW':
      return { label: 'Low Risk', color: '#059669', bg: 'rgba(5,150,105,0.1)', description: 'No recent SIM change' };
    default:
      return { label: 'Unknown', color: '#6b7280', bg: 'rgba(107,114,128,0.08)', description: 'Could not determine risk' };
  }
}

function deviceRiskConfig(riskLevel) {
  switch (riskLevel) {
    case 'RISK_LEVEL_HIGH':
      return { label: 'High Risk', color: '#dc2626', bg: 'rgba(220,38,38,0.1)', description: 'Recent device change detected' };
    case 'RISK_LEVEL_MEDIUM':
      return { label: 'Medium', color: '#d97706', bg: 'rgba(217,119,6,0.1)', description: 'Device changed within 30 days' };
    case 'RISK_LEVEL_LOW':
      return { label: 'Low Risk', color: '#059669', bg: 'rgba(5,150,105,0.1)', description: 'No recent device change' };
    default:
      return { label: 'Unknown', color: '#6b7280', bg: 'rgba(107,114,128,0.08)', description: 'Could not determine risk' };
  }
}

export default function ResultOverlay({ result, onDismiss }) {
  const [phase, setPhase] = useState(0); // 0=hidden, 1=backdrop, 2=card, 3=content
  const [countdown, setCountdown] = useState(Math.ceil(AUTO_DISMISS_MS / 1000));

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 10);
    const t2 = setTimeout(() => setPhase(2), 80);
    const t3 = setTimeout(() => setPhase(3), 350);
    const dismiss = setTimeout(() => handleDismiss(), AUTO_DISMISS_MS);
    const tick = setInterval(() => setCountdown(s => s > 0 ? s - 1 : 0), 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(dismiss); clearInterval(tick); };
  }, []);

  const handleDismiss = () => {
    setPhase(0);
    setTimeout(() => onDismiss?.(), 350);
  };

  const isVerified = result.verified !== false;
  const simSwap = result.sim_swap;
  const deviceSwap = result.device_swap;
  const simRisk = simSwap?.risk_level ? simRiskConfig(simSwap.risk_level) : null;
  const deviceRisk = deviceSwap?.risk_level ? deviceRiskConfig(deviceSwap.risk_level) : null;
  const hasSignals = simSwap || deviceSwap;

  return (
    <div className={`ro-backdrop ${phase >= 1 ? 'ro-in' : ''} ${phase === 0 ? 'ro-out' : ''}`} onClick={handleDismiss}>
      <div className={`ro-card ${phase >= 2 ? 'ro-card-in' : ''}`} onClick={e => e.stopPropagation()}>

        {/* Celebration glow behind the icon */}
        <div className={`ro-glow ${isVerified ? 'ro-glow-success' : 'ro-glow-fail'} ${phase >= 3 ? 'ro-glow-in' : ''}`} />

        {/* Animated icon */}
        <div className={`ro-icon-wrap ${phase >= 3 ? 'ro-reveal' : ''}`}>
          {isVerified ? (
            <svg className="ro-check-svg" viewBox="0 0 52 52">
              <circle className="ro-check-ring" cx="26" cy="26" r="25" fill="none" />
              <path className="ro-check-tick" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
            </svg>
          ) : (
            <svg className="ro-x-svg" viewBox="0 0 52 52">
              <circle className="ro-x-ring" cx="26" cy="26" r="25" fill="none" />
              <path className="ro-x-lines" fill="none" d="M16 16l20 20M36 16l-20 20" />
            </svg>
          )}
        </div>

        {/* Title + phone — staggered */}
        <h3 className={`ro-title ${phase >= 3 ? 'ro-reveal ro-d1' : ''}`}>
          {result.verified !== undefined
            ? (isVerified ? 'Phone Verified' : 'Verification Failed')
            : 'Phone Number Retrieved'}
        </h3>
        <p className={`ro-phone ${phase >= 3 ? 'ro-reveal ro-d2' : ''}`}>
          {maskPhone(result.phone_number)}
        </p>

        {/* Anti-fraud signals */}
        {hasSignals && (
          <div className={`ro-signals ${phase >= 3 ? 'ro-reveal ro-d3' : ''}`}>
            <div className="ro-signals-label">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Anti-Fraud Signals
            </div>

            {/* SIM Swap */}
            {simSwap && (
              <div className="ro-signal-row">
                <div className="ro-sim-icon">
                  <svg viewBox="0 0 40 40" width="40" height="40" fill="none">
                    <rect x="6" y="2" width="28" height="36" rx="3" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M6 12h10l4-4h8" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    <rect x="13" y="18" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                    <line x1="20" y1="18" x2="20" y2="30" stroke="currentColor" strokeWidth="1" opacity="0.5" />
                    <line x1="13" y1="24" x2="27" y2="24" stroke="currentColor" strokeWidth="1" opacity="0.5" />
                  </svg>
                </div>
                <div className="ro-signal-body">
                  <div className="ro-signal-name">SIM Swap Check</div>
                  {simSwap.checked ? (
                    <>
                      {simRisk && (
                        <span className="ro-badge" style={{ background: simRisk.bg, color: simRisk.color, borderColor: simRisk.color }}>
                          {simRisk.label}
                        </span>
                      )}
                      <div className="ro-signal-desc">{simRisk?.description}</div>
                      {simSwap.age_band && <div className="ro-signal-sub">Last change: {simSwap.age_band}</div>}
                      {simSwap.carrier_name && <div className="ro-signal-sub">Carrier: {simSwap.carrier_name}</div>}
                    </>
                  ) : (
                    <>
                      <span className="ro-badge ro-badge-na">Unavailable</span>
                      {simSwap.reason && <div className="ro-signal-sub">Reason: {simSwap.reason}</div>}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Device Swap */}
            {deviceSwap && (
              <div className="ro-signal-row">
                <div className="ro-sim-icon">
                  <svg viewBox="0 0 40 40" width="40" height="40" fill="none">
                    <rect x="10" y="2" width="20" height="36" rx="3" stroke="currentColor" strokeWidth="1.5" />
                    <line x1="16" y1="6" x2="24" y2="6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    <circle cx="20" cy="33" r="2" stroke="currentColor" strokeWidth="1.2" />
                    <rect x="13" y="10" width="14" height="18" rx="1" stroke="currentColor" strokeWidth="1" opacity="0.5" />
                  </svg>
                </div>
                <div className="ro-signal-body">
                  <div className="ro-signal-name">Device Swap Check</div>
                  {deviceSwap.checked ? (
                    <>
                      {deviceRisk && (
                        <span className="ro-badge" style={{ background: deviceRisk.bg, color: deviceRisk.color, borderColor: deviceRisk.color }}>
                          {deviceRisk.label}
                        </span>
                      )}
                      <div className="ro-signal-desc">{deviceRisk?.description}</div>
                      {deviceSwap.age_band && <div className="ro-signal-sub">Last change: {deviceSwap.age_band}</div>}
                      {deviceSwap.carrier_name && <div className="ro-signal-sub">Carrier: {deviceSwap.carrier_name}</div>}
                    </>
                  ) : (
                    <>
                      <span className="ro-badge ro-badge-na">Unavailable</span>
                      {deviceSwap.reason && <div className="ro-signal-sub">Reason: {deviceSwap.reason}</div>}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {result.aud && (
          <div className={`ro-aud ${phase >= 3 ? 'ro-reveal ro-d4' : ''}`}>
            <span>aud</span> {result.aud}
          </div>
        )}

        <button className={`ro-btn ${phase >= 3 ? 'ro-reveal ro-d5' : ''}`} onClick={handleDismiss}>
          Dismiss <span className="ro-countdown">({countdown}s)</span>
        </button>
      </div>
    </div>
  );
}
