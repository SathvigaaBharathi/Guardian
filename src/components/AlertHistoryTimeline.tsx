import React, { useState, useEffect } from 'react';
import { Alert } from '../types';

interface AlertHistoryItem {
  id: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  score: number;
  acknowledged: boolean;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
  description: string;
}

interface AlertHistoryTimelineProps {
  alerts: Alert[];
}

export function AlertHistoryTimeline({ alerts }: AlertHistoryTimelineProps) {
  const [history, setHistory] = useState<AlertHistoryItem[]>([]);

  // Sync state.alerts with localStorage history
  useEffect(() => {
    const savedRaw = localStorage.getItem('guardian_alert_history');
    let savedList: AlertHistoryItem[] = [];
    if (savedRaw) {
      try {
        savedList = JSON.parse(savedRaw);
      } catch (e) {
        savedList = [];
      }
    }

    // Merge new active alerts into the history
    let modified = false;
    alerts.forEach(activeAlert => {
      const exists = savedList.some(h => h.id === activeAlert.id);
      if (!exists) {
        savedList.unshift({
          id: activeAlert.id,
          timestamp: activeAlert.timestamp,
          severity: activeAlert.severity,
          type: activeAlert.anomaly.anomalyType,
          score: activeAlert.anomaly.score,
          acknowledged: activeAlert.acknowledged,
          acknowledgedAt: activeAlert.acknowledgedAt,
          acknowledgedBy: activeAlert.acknowledged ? 'Local Monitor' : undefined,
          description: activeAlert.llmText
        });
        modified = true;
      } else {
        // Update acknowledgment if it changed in active state
        const idx = savedList.findIndex(h => h.id === activeAlert.id);
        if (idx !== -1 && activeAlert.acknowledged && !savedList[idx].acknowledged) {
          savedList[idx].acknowledged = true;
          savedList[idx].acknowledgedAt = activeAlert.acknowledgedAt || Date.now();
          savedList[idx].acknowledgedBy = 'Local Monitor';
          modified = true;
        }
      }
    });

    if (modified || savedList.length !== history.length) {
      localStorage.setItem('guardian_alert_history', JSON.stringify(savedList));
      setHistory(savedList);
    }
  }, [alerts]);

  // Handle remote acknowledgments coming from WebSockets (triggered via external components)
  useEffect(() => {
    const handleStorageChange = () => {
      const savedRaw = localStorage.getItem('guardian_alert_history');
      if (savedRaw) {
        try {
          setHistory(JSON.parse(savedRaw));
        } catch (e) {}
      }
    };
    window.addEventListener('storage', handleStorageChange);
    // Poll local changes occasionally in case storage listener doesn't catch same-window updates
    const pollInterval = setInterval(handleStorageChange, 2000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(pollInterval);
    };
  }, []);

  const handleClearHistory = () => {
    if (confirm('Clear entire alert and medical record history?')) {
      localStorage.removeItem('guardian_alert_history');
      setHistory([]);
    }
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6 shadow-xl space-y-4">
      {/* Title Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="space-y-0.5">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            📋 Medical Record & Safety Incident Ledger
          </h3>
          <p className="text-xxs text-slate-500">
            A permanent chronological record of household routine anomalies and critical alerts.
          </p>
        </div>
        {history.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold hover:underline"
          >
            Clear Ledger
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <p className="text-xxs text-slate-550 italic text-center py-6">
          No incident alerts logged in this session ledger yet.
        </p>
      ) : (
        <div className="relative border-l border-slate-800 ml-3.5 pl-6 space-y-6 pt-2 pb-2">
          {history.map((item) => {
            const isCritical = item.severity === 'critical';
            const badgeColor = isCritical
              ? 'bg-rose-500 ring-rose-500/20'
              : item.severity === 'high'
              ? 'bg-orange-500 ring-orange-500/20'
              : 'bg-amber-500 ring-amber-500/20';

            return (
              <div key={item.id} className="relative group">
                {/* Timeline Dot Indicator */}
                <span className={`absolute -left-[31px] top-1.5 flex h-3 w-3 items-center justify-center rounded-full ring-4 ${badgeColor} ${
                  !item.acknowledged ? 'animate-pulse' : ''
                }`} />

                {/* Content Block */}
                <div className="bg-slate-950/40 hover:bg-slate-950/80 border border-slate-850 hover:border-slate-800 rounded-xl p-4 transition-all space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xxs font-mono">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        isCritical
                          ? 'bg-rose-950/50 text-rose-400 border border-rose-900/30'
                          : 'bg-slate-900 text-slate-400 border border-slate-800'
                      }`}>
                        {item.severity}
                      </span>
                      <span className="text-slate-400 font-bold capitalize">
                        {item.type.replace('_', ' ')}
                      </span>
                      <span className="text-slate-600">|</span>
                      <span className="text-slate-550">Score: {item.score.toFixed(2)}</span>
                    </div>
                    <span className="text-slate-500">{formatDate(item.timestamp)}</span>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed font-medium">
                    {item.description}
                  </p>

                  {/* Acknowledgment Badge */}
                  <div className="border-t border-slate-900 pt-2 flex items-center justify-between text-[10px] font-mono">
                    {item.acknowledged ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        ✓ Acknowledged at {formatDate(item.acknowledgedAt || item.timestamp)}
                      </span>
                    ) : (
                      <span className="text-amber-500 flex items-center gap-1 animate-pulse">
                        ⏳ Pending Acknowledgment
                      </span>
                    )}

                    {item.acknowledged && item.acknowledgedBy && (
                      <span className="text-slate-600">
                        Method: {item.acknowledgedBy}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
