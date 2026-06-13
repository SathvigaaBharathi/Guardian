import React, { useState, useEffect } from 'react';
import { Alert, AlertSeverity } from '../types';

interface AlertPanelProps {
  alerts: Alert[];
  acknowledgeAlert: (id: string) => void;
}

export function AlertPanel({ alerts, acknowledgeAlert }: AlertPanelProps) {
  const [showPastAlerts, setShowPastAlerts] = useState(false);

  const activeAlerts = alerts.filter(a => !a.acknowledged);
  const acknowledgedAlerts = alerts.filter(a => a.acknowledged);

  // Trigger vibration on critical alerts
  useEffect(() => {
    const criticalUnack = activeAlerts.some(a => a.severity === 'critical');
    if (criticalUnack && 'vibrate' in navigator) {
      try {
        navigator.vibrate([200, 100, 200]);
      } catch (e) {
        console.warn('Vibration API not supported or blocked:', e);
      }
    }
  }, [activeAlerts]);

  const getBorderColor = (sev: AlertSeverity) => {
    switch (sev) {
      case 'critical': return 'border-l-rose-500';
      case 'high': return 'border-l-orange-500';
      case 'medium': return 'border-l-amber-500';
      default: return 'border-l-slate-450';
    }
  };

  const getBadgeColor = (sev: AlertSeverity) => {
    switch (sev) {
      case 'critical': return 'bg-rose-950/60 text-rose-400 border-rose-900/40';
      case 'high': return 'bg-orange-950/60 text-orange-400 border-orange-900/40';
      case 'medium': return 'bg-amber-950/60 text-amber-400 border-amber-900/40';
      default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="space-y-4">
      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-rose-400 flex items-center gap-1.5 px-1">
            ⚠️ Active Safety Alerts ({activeAlerts.length})
          </h3>
          <div className="space-y-3">
            {activeAlerts.map(alert => (
              <div
                key={alert.id}
                className={`bg-slate-900 border border-slate-800 border-l-4 ${getBorderColor(
                  alert.severity
                )} rounded-xl p-5 shadow-2xl flex flex-col md:flex-row justify-between gap-4 transition-all`}
              >
                <div className="space-y-3 flex-1">
                  {/* Top Bar */}
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xxs font-semibold uppercase tracking-wider border ${getBadgeColor(
                      alert.severity
                    )}`}>
                      {alert.severity}
                    </span>
                    <span className="text-xs text-slate-350 font-bold bg-slate-950 px-2.5 py-1 rounded border border-slate-850">
                      🚨 TRIGGERED AT {formatTime(alert.timestamp)}
                    </span>
                  </div>

                  {/* LLM Text */}
                  <p className="text-base md:text-lg font-medium text-slate-100 leading-relaxed">
                    {alert.llmText}
                  </p>

                  {/* Metadata row */}
                  <div className="text-xxs text-slate-400 flex flex-wrap gap-x-4 gap-y-1 font-mono pt-1">
                    <span>
                      <strong className="text-slate-500">Anomaly Type:</strong>{' '}
                      <span className="text-slate-300">{alert.anomaly.anomalyType.replace('_', ' ')}</span>
                    </span>
                    <span>
                      <strong className="text-slate-500">KL Score:</strong>{' '}
                      <span className="text-slate-300">{alert.anomaly.score.toFixed(2)}</span>
                    </span>
                    {alert.anomaly.missingEvents.length > 0 && (
                      <span>
                        <strong className="text-slate-500">Missing Expected:</strong>{' '}
                        <span className="text-slate-300">{alert.anomaly.missingEvents.join(', ')}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Button */}
                <div className="flex items-start justify-end">
                  <button
                    type="button"
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="bg-slate-950 border border-slate-850 text-slate-350 hover:bg-slate-850 hover:text-slate-100 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all select-none active:translate-y-px"
                  >
                    Acknowledge Alert
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acknowledged Alerts Archive */}
      {acknowledgedAlerts.length > 0 && (
        <div className="border border-slate-800 rounded-xl bg-slate-950/40 p-4">
          <button
            type="button"
            onClick={() => setShowPastAlerts(!showPastAlerts)}
            className="w-full flex justify-between items-center text-xs font-semibold text-slate-400 focus:outline-none"
          >
            <span>🗄️ Acknowledged Alerts Log ({acknowledgedAlerts.length})</span>
            <span>{showPastAlerts ? '▲ Hide' : '▼ View'}</span>
          </button>
          
          {showPastAlerts && (
            <div className="mt-3 space-y-2.5 border-t border-slate-900 pt-3 max-h-60 overflow-y-auto pr-1">
              {acknowledgedAlerts.map(alert => (
                <div
                  key={alert.id}
                  className="bg-slate-900/50 border border-slate-850/60 rounded-lg p-3 flex justify-between items-center gap-3 text-xxs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-300 font-medium truncate capitalize">
                        {alert.anomaly.anomalyType.replace('_', ' ')}
                      </span>
                      <span className="text-slate-600 font-mono">
                        {formatTime(alert.timestamp)}
                      </span>
                    </div>
                    <p className="text-slate-450 italic leading-snug line-clamp-1">
                      "{alert.llmText}"
                    </p>
                  </div>
                  <span className="text-slate-600 shrink-0 font-mono">
                    Acked at {alert.acknowledgedAt ? formatTime(alert.acknowledgedAt) : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
