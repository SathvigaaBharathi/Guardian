import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Alert } from '../types';

export function FamilyAlertView() {
  const [pairingCode, setPairingCode] = useState(() => {
    return sessionStorage.getItem('guardian_caregiver_pairing_code') || '';
  });
  const [inputCode, setInputCode] = useState('');
  const [alert, setAlert] = useState<Alert | null>(null);
  const [lastChecked, setLastChecked] = useState(Date.now());
  const wsRef = useRef<WebSocket | null>(null);
  const [checkInState, setCheckInState] = useState<'idle' | 'sending' | 'responded'>('idle');
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  const handleRequestCheckIn = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setCheckInState('sending');
      wsRef.current.send(JSON.stringify({
        type: 'CHECK_IN_REQUESTED'
      }));
      // Auto fallback to idle after 25s if no answer
      setTimeout(() => {
        setCheckInState(prev => prev === 'sending' ? 'idle' : prev);
      }, 25000);
    } else {
      window.alert('Connection is currently offline. Cannot request check-in.');
    }
  };

  const checkAlertState = useCallback(() => {
    const saved = localStorage.getItem('guardian_latest_alert');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Alert;
        // Verify room code match to avoid same-browser localStorage cross-contamination!
        if (!parsed.acknowledged && (!parsed.pairingCode || parsed.pairingCode === pairingCode)) {
          setAlert(parsed);
        } else {
          setAlert(null);
        }
      } catch (e) {
        setAlert(null);
      }
    } else {
      setAlert(null);
    }
    setLastChecked(Date.now());
  }, [pairingCode]);

  // Pull local state on mount
  useEffect(() => {
    checkAlertState();
  }, [checkAlertState]);

  // Code entry must be manual; URL polling is disabled.

  // Connect to local WebSocket for cross-device synchronization (scoped by room pairing code)
  useEffect(() => {
    if (!pairingCode) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws-sync`;

    let reconnectTimeout: any;

    function connect() {
      console.log('Connecting Caregiver view to sync WebSocket:', wsUrl, 'Room:', pairingCode);
      setWsStatus('connecting');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      let pingInterval: any;

      ws.onopen = () => {
        setWsStatus('connected');
        console.log('Caregiver WebSocket open. Joining room:', pairingCode);
        ws.send(JSON.stringify({
          type: 'JOIN_ROOM',
          payload: { pairingCode }
        }));

        // Start keepalive ping to prevent Render free-tier idle drops (kills idle after ~55s)
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PING' }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'ALERT_TRIGGERED') {
            const alertPayload = msg.payload;
            console.log('Sync Alert Received in Room:', alertPayload);
            localStorage.setItem('guardian_latest_alert', JSON.stringify(alertPayload));
            setAlert(alertPayload);
          } else if (msg.type === 'ALERT_ACKNOWLEDGED') {
            console.log('Sync Alert Acknowledged in Room by other client:', msg.payload);
            const saved = localStorage.getItem('guardian_latest_alert');
            if (saved) {
              try {
                const parsed = JSON.parse(saved) as Alert;
                if (parsed.id === msg.payload) {
                  localStorage.removeItem('guardian_latest_alert');
                  setAlert(null);
                }
              } catch (e) {}
            } else {
              setAlert(null);
            }
          } else if (msg.type === 'CHECK_IN_RESPONDED') {
            console.log('Sync Check-In Response Received: Safe');
            setCheckInState('responded');
            setTimeout(() => setCheckInState('idle'), 5000);
          }
        } catch (e) {
          console.error('Failed to parse sync message:', e);
        }
      };

      ws.onclose = () => {
        clearInterval(pingInterval);
        setWsStatus('disconnected');
        console.log('Caregiver view WebSocket disconnected. Retrying in 3s...');
        reconnectTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.warn('Caregiver view WebSocket error:', err);
      };
    }

    connect();

    return () => {
      if (wsRef.current) wsRef.current.close();
      clearTimeout(reconnectTimeout);
    };
  }, [pairingCode]);

  const handleMarkChecked = () => {
    if (alert) {
      // Mark as acknowledged locally
      const updatedAlert = { ...alert, acknowledged: true, acknowledgedAt: Date.now() };
      localStorage.setItem('guardian_latest_alert', JSON.stringify(updatedAlert));
      setAlert(null);
      
      // Broadcast to other clients in the same room (the PC dashboard)
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'ALERT_ACKNOWLEDGED',
            payload: alert.id,
          })
        );
      }
    }
  };

  const handleDisconnect = () => {
    if (confirm('Are you sure you want to unlink this caregiver device?')) {
      sessionStorage.removeItem('guardian_caregiver_pairing_code');
      setPairingCode('');
      setAlert(null);
      if (wsRef.current) wsRef.current.close();
    }
  };

  const handleLink = () => {
    const cleaned = inputCode.trim().toUpperCase();
    if (cleaned.length === 6) {
      sessionStorage.setItem('guardian_caregiver_pairing_code', cleaned);
      setPairingCode(cleaned);
    } else {
      window.alert('Please enter a valid 6-character code.');
    }
  };

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    // Show exact time including seconds
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Setup pairing screen if not paired
  if (!pairingCode) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6 text-center relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-[80px] -z-10 bg-teal-500/10" />
          
          <div className="flex flex-col items-center gap-2 pb-2">
            <span className="text-4xl">🛡️</span>
            <span className="text-xl font-bold tracking-tight text-slate-200">Guardian Link</span>
            <span className="text-xxs text-slate-500 font-medium uppercase tracking-wider">Pair Caregiver Device</span>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              Enter the 6-character **Pairing Code** shown at the top of the main Guardian Monitor dashboard to link this phone.
            </p>
            <input
              type="text"
              placeholder="ENTER CODE"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              className="w-full text-center tracking-widest text-lg font-mono font-bold bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl p-3 focus:outline-none text-teal-400"
            />
          </div>

          <button
            type="button"
            onClick={handleLink}
            className="w-full py-3.5 bg-teal-650 hover:bg-teal-600 active:scale-95 text-white rounded-xl text-sm font-bold tracking-wide transition-all select-none border border-teal-500/20"
          >
            Link with Monitor
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans relative">
      {/* Cold Start Connection Warning Banner */}
      {wsStatus !== 'connected' && (
        <div className="absolute top-0 left-0 right-0 bg-amber-950/40 border-b border-amber-900/30 px-6 py-2 flex items-center justify-between text-xs text-amber-300 animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span>⚡ Connecting sync server... Render takes 30-60s to wake up.</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 font-mono text-[9px] text-amber-550">
            <span>SOCKET_CONNECTING</span>
          </div>
        </div>
      )}

      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-8 text-center relative overflow-hidden">
        
        {/* Glow Effects */}
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-[80px] -z-10 transition-colors duration-1000 ${
          alert ? 'bg-rose-500/10' : 'bg-emerald-500/10'
        }`} />

        {/* Branding Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex flex-col text-left">
            <span className="text-lg font-bold tracking-tight text-slate-200">Guardian</span>
            <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Caregiver view</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[9px] bg-slate-950 px-2 py-0.5 rounded font-mono font-bold text-teal-400 border border-slate-800">
              Room: {pairingCode}
            </span>
            <button
              onClick={handleDisconnect}
              className="text-[9px] text-rose-400 hover:underline hover:text-rose-300"
            >
              Unpair Device
            </button>
          </div>
        </div>

        {/* Dynamic Status Icon & Content */}
        {!alert ? (
          <div className="space-y-6 py-4 flex flex-col items-center">
            {/* Safe Status */}
            <div className="w-32 h-32 rounded-full bg-emerald-950/30 border border-emerald-550/40 flex items-center justify-center pulse-ring-teal shadow-2xl">
              <span className="text-5xl">🏡</span>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-emerald-400">All is Well</h2>
              <p className="text-xs text-slate-450 leading-relaxed max-w-[240px] mx-auto">
                No routine anomalies or critical fall impacts have been detected.
              </p>
            </div>
            
            {/* Bidirectional Welfare Request Button */}
            <button
              type="button"
              onClick={handleRequestCheckIn}
              disabled={checkInState !== 'idle'}
              className={`w-full py-2.5 rounded-xl text-xxs font-bold tracking-wide transition-all border shadow-sm select-none ${
                checkInState === 'sending'
                  ? 'bg-amber-950/20 border-amber-900/50 text-amber-400 animate-pulse cursor-default'
                  : checkInState === 'responded'
                  ? 'bg-emerald-950/40 border-emerald-900/40 text-emerald-400 cursor-default'
                  : 'bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-300 hover:text-slate-100 active:scale-95'
              }`}
            >
              {checkInState === 'sending'
                ? '🔔 Requesting Welfare Check...'
                : checkInState === 'responded'
                ? '✓ Occupant Responded SAFE'
                : '🔔 Request Welfare Check'}
            </button>
          </div>
        ) : (
          <div className="space-y-6 py-4 flex flex-col items-center">
            {/* Danger Status */}
            <div className="w-32 h-32 rounded-full bg-rose-950/30 border border-rose-550/40 flex items-center justify-center pulse-ring-red shadow-2xl">
              <span className="text-5xl animate-bounce">⚠️</span>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <span className="bg-rose-950/60 text-rose-400 border border-rose-900/40 px-2.5 py-0.5 rounded-full text-xxs font-semibold uppercase tracking-wider">
                  {alert.severity} Alert
                </span>
                <span className="text-xs text-rose-450 font-bold font-mono block bg-rose-950/40 py-1.5 px-3 rounded-lg border border-rose-900/30">
                  🚨 TRIGGERED AT {formatTime(alert.timestamp)}
                </span>
              </div>
              <p className="text-base font-semibold text-slate-100 leading-relaxed px-2">
                "{alert.llmText}"
              </p>
            </div>
          </div>
        )}

        {/* Action Button */}
        {alert && (
          <button
            type="button"
            onClick={handleMarkChecked}
            className="w-full py-3.5 bg-rose-600 hover:bg-rose-550 active:translate-y-px text-white rounded-lg text-sm font-semibold tracking-wide shadow-lg shadow-rose-600/20 transition-all select-none"
          >
            Mark as Checked
          </button>
        )}

        {/* Footer info */}
        <div className="border-t border-slate-800/80 pt-4 space-y-2 text-[10px] text-slate-550">
          <p className="leading-snug">
            Connected via WiFi Sync Server · Auto-refreshing...
          </p>
          <p className="text-[9px] bg-slate-950/60 p-2.5 rounded border border-slate-850/60 leading-normal">
            ℹ️ Alerts are synced in real-time between your phone and your PC dashboard using WebSockets.
          </p>
        </div>

      </div>
    </div>
  );
}
