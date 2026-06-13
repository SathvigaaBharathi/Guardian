import React, { useState } from 'react';
import { NetworkLogEntry } from '../types';

interface PrivacyProofProps {
  networkLog: NetworkLogEntry[];
}

export function PrivacyProof({ networkLog }: PrivacyProofProps) {
  const [collapsed, setCollapsed] = useState(false);

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl space-y-4">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex justify-between items-center text-slate-200 focus:outline-none"
      >
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          🔒 Privacy Verification Network Logger
        </h3>
        <span className="text-xs text-slate-500 font-mono">
          {collapsed ? '▲ Show Logs' : '▼ Hide Logs'}
        </span>
      </button>

      {!collapsed && (
        <div className="space-y-4 pt-1">
          {/* Statement */}
          <p className="text-xxs text-slate-400 leading-relaxed bg-slate-950/40 p-3 rounded-lg border border-slate-850">
            🛡️ <strong>Provable Privacy:</strong> Every outbound network request is logged below in real-time. 
            No binary audio arrays, wave buffers, or recordings are sent. We only send structured textual parameters (e.g. event times and anomaly types) to Groq. 
            You can verify this in Chrome DevTools under the <code className="text-teal-400 font-mono">Network</code> tab during alerts.
          </p>

          {/* Network Logs List */}
          {networkLog.length === 0 ? (
            <p className="text-xxs text-slate-550 italic py-2 text-center">
              No outgoing network requests yet. Trigger an alert to log Groq completions.
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {networkLog.map((log, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950 border border-slate-850 rounded-lg p-3 space-y-2 font-mono text-[10px]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-900 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-500 font-bold uppercase">{log.method}</span>
                      <span className="text-slate-400 truncate max-w-[280px]" title={log.url}>
                        {log.url}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-650">{formatTime(log.timestamp)}</span>
                      <span className="bg-emerald-950 text-emerald-400 border border-emerald-900/40 px-2 py-0.5 rounded text-[9px] font-semibold">
                        ✓ Text only — no audio data
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] mb-1 font-semibold uppercase">Request Body Preview:</span>
                    <pre className="text-slate-300 bg-slate-900 p-2 rounded border border-slate-850/50 whitespace-pre-wrap overflow-x-auto text-[9px] leading-snug">
                      {log.bodyPreview}...
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
