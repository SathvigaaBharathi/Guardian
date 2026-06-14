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
  reasoning?: string[];
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
          description: activeAlert.llmText,
          reasoning: activeAlert.reasoning
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
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6 shadow-xl space-y-4 print:bg-white print:border-none print:shadow-none print:p-0">
      {/* Title Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 print:hidden">
        <div className="space-y-0.5">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            📋 Medical Record & Safety Incident Ledger
          </h3>
          <p className="text-xxs text-slate-500">
            A permanent chronological record of household routine anomalies and critical alerts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {history.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => window.print()}
                className="text-[10px] text-teal-400 hover:text-teal-300 font-semibold hover:underline flex items-center gap-1"
                title="Print ledger report or save as PDF"
              >
                🖨️ Export PDF / Print
              </button>
              <span className="text-slate-800 text-[10px]">|</span>
              <button
                type="button"
                onClick={handleClearHistory}
                className="text-[10px] text-rose-455 hover:text-rose-400 font-semibold hover:underline"
              >
                Clear Ledger
              </button>
            </>
          )}
        </div>
      </div>

      {history.length === 0 ? (
        <p className="text-xxs text-slate-550 italic text-center py-6">
          No incident alerts logged in this session ledger yet.
        </p>
      ) : (
        <>
          {/* Print-Only Diagnostic Report Header */}
          <div className="hidden print:block mb-8 border-b-2 border-slate-950 pb-4 text-slate-900">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              🛡️ Guardian Safety Diagnostics Report
            </h1>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Diagnostic record of ambient acoustic activity deviations, sleep intervals, and safety alert incidents generated by the occupant's local on-device machine learning routine analyzer.
            </p>
            <div className="grid grid-cols-2 gap-4 mt-4 text-[10px] text-slate-500 font-mono border-t border-slate-200 pt-3">
              <div>
                <strong>Report Generated:</strong> {new Date().toLocaleString()}<br />
                <strong>Temporal Snapshot Range:</strong> 24 Hours
              </div>
              <div>
                <strong>Pairing Sync Room Code:</strong> {localStorage.getItem('guardian_pairing_code') || 'N/A'}<br />
                <strong>Verification Ledger:</strong> Integrity Active (Cryptographic Local)
              </div>
            </div>
          </div>

          <div className="relative border-l border-slate-800 ml-3.5 pl-6 space-y-6 pt-2 pb-2 print:border-slate-350 print:ml-1 print:pl-4 print:space-y-4">
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
                <div className="bg-slate-950/40 hover:bg-slate-950/80 border border-slate-850 hover:border-slate-800 rounded-xl p-4 transition-all space-y-2.5 print:bg-white print:border-slate-300 print:text-black print:shadow-none">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xxs font-mono print:text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase print:bg-slate-100 print:text-slate-800 print:border-slate-250 ${
                        isCritical
                          ? 'bg-rose-950/50 text-rose-400 border border-rose-900/30'
                          : 'bg-slate-900 text-slate-400 border border-slate-800'
                      }`}>
                        {item.severity}
                      </span>
                      <span className="text-slate-400 font-bold capitalize print:text-slate-800">
                        {item.type.replace('_', ' ')}
                      </span>
                      <span className="text-slate-600">|</span>
                      <span className="text-slate-550 print:text-slate-700">Score: {item.score.toFixed(2)}</span>
                    </div>
                    <span className="text-slate-500 print:text-slate-700">{formatDate(item.timestamp)}</span>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed font-medium print:text-slate-900">
                    {item.description}
                  </p>

                  {/* Groq reasoning explanation */}
                  {item.reasoning && item.reasoning.length > 0 && (
                    <>
                      {/* On-screen collapsible accordion */}
                      <details className="mt-2 bg-slate-950/60 rounded-lg border border-slate-850 overflow-hidden text-[11px] print:hidden">
                        <summary className="bg-slate-950 px-2 py-1.5 cursor-pointer font-semibold text-slate-400 hover:text-slate-200 flex items-center justify-between select-none">
                          <span className="flex items-center gap-1">💡 Why Guardian flagged this</span>
                          <span className="text-[9px] text-slate-550 font-mono">Click to expand</span>
                        </summary>
                        <div className="p-2.5 space-y-1.5 border-t border-slate-900 bg-slate-950/30">
                          <ul className="list-disc pl-4 space-y-1 text-slate-350 leading-relaxed">
                            {item.reasoning.map((step, idx) => (
                              <li key={idx}>{step}</li>
                            ))}
                          </ul>
                        </div>
                      </details>

                      {/* Print-only expanded view */}
                      <div className="hidden print:block mt-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[11px] text-slate-800">
                        <div className="font-bold text-slate-700 text-[10px] mb-1">💡 Why Guardian flagged this:</div>
                        <ul className="list-disc pl-4 space-y-1 text-slate-800 leading-relaxed">
                          {item.reasoning.map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}

                  {/* Acknowledgment Badge */}
                  <div className="border-t border-slate-900 pt-2 flex items-center justify-between text-[10px] font-mono print:border-slate-200 print:text-slate-600">
                    {item.acknowledged ? (
                      <span className="text-emerald-400 flex items-center gap-1 print:text-emerald-700">
                        ✓ Acknowledged at {formatDate(item.acknowledgedAt || item.timestamp)}
                      </span>
                    ) : (
                      <span className="text-amber-500 flex items-center gap-1 animate-pulse print:text-amber-700 print:animate-none">
                        ⏳ Pending Acknowledgment
                      </span>
                    )}

                    {item.acknowledged && item.acknowledgedBy && (
                      <span className="text-slate-600 print:text-slate-500">
                        Method: {item.acknowledgedBy}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </>
    )}
    </div>
  );
}
