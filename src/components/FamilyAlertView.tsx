import React, { useState, useEffect, useRef } from 'react';
import { Alert } from '../types';

export function FamilyAlertView() {
  const [alert, setAlert] = useState<Alert | null>(null);
  const [lastChecked, setLastChecked] = useState(Date.now());
  const wsRef = useRef<WebSocket | null>(null);

  const checkAlertState = () => {
    const saved = localStorage.getItem('guardian_latest_alert');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Alert;
        // Only show if not acknowledged yet
        if (!parsed.acknowledged) {
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
  };

  // Pull local state on mount
  useEffect(() => {
    checkAlertState();
  }, []);

  // Connect to local WebSocket for cross-device synchronization
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws-sync`;

    let reconnectTimeout: any;

    function connect() {
      console.log('Connecting Caregiver view to sync WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'ALERT_TRIGGERED') {
            const alertPayload = msg.payload;
            console.log('Sync Alert Received:', alertPayload);
            localStorage.setItem('guardian_latest_alert', JSON.stringify(alertPayload));
            setAlert(alertPayload);
          } else if (msg.type === 'ALERT_ACKNOWLEDGED') {
            console.log('Sync Alert Acknowledged by other client:', msg.payload);
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
          }
        } catch (e) {
          console.error('Failed to parse sync message:', e);
        }
      };

      ws.onclose = () => {
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
  }, []);

  const handleMarkChecked = () => {
    if (alert) {
      // Mark as acknowledged locally
      const updatedAlert = { ...alert, acknowledged: true, acknowledgedAt: Date.now() };
      localStorage.setItem('guardian_latest_alert', JSON.stringify(updatedAlert));
      setAlert(null);
      
      // Broadcast to other clients (the PC dashboard)
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

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-8 text-center relative overflow-hidden">
        
        {/* Glow Effects */}
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-[80px] -z-10 transition-colors duration-1000 ${
          alert ? 'bg-rose-500/10' : 'bg-emerald-500/10'
        }`} />

        {/* Branding Header */}
        <div className="flex flex-col items-center gap-1.5 pb-2">
          <span className="text-xl font-bold tracking-tight text-slate-200">Guardian</span>
          <span className="text-xxs text-slate-500 font-medium uppercase tracking-wider">Caregiver Mobile View</span>
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
