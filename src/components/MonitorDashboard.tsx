import React, { useMemo } from 'react';
import { GuardianState, AudioEvent } from '../types';
import { EVENT_ICONS } from '../constants';
import { RoutineHeatmap } from './RoutineHeatmap';
import { AlertPanel } from './AlertPanel';
import { AudioVisualizer } from './AudioVisualizer';
import { useRoutineModel } from '../hooks/useRoutineModel';
import { AlertHistoryTimeline } from './AlertHistoryTimeline';
import { EVENT_CLASSES, getMarginalDist } from '../routine/MarkovRoutineModel';

interface MonitorDashboardProps {
  state: GuardianState;
  stopMonitoring: () => void;
  acknowledgeAlert: (id: string) => void;
  getAnalyser: () => AnalyserNode | null;
}

export function MonitorDashboard({
  state,
  stopMonitoring,
  acknowledgeAlert,
  getAnalyser,
}: MonitorDashboardProps) {
  // Compute heatmap data using model state
  const heatmapData = useRoutineModel(state.routineModel);

  // Compute stat card figures
  const eventsCount = state.recentEvents.length;
  const activeAlertsCount = state.alerts.filter(a => !a.acknowledged).length;

  // Insights calculations
  const daysOfData = useMemo(() => {
    const keys = Object.keys(localStorage);
    const dailyKeys = keys.filter(k => k.startsWith('guardian_model_'));
    return Math.max(1, dailyKeys.length);
  }, [state.routineModel]);

  const currentBin = Math.floor((new Date().getHours() * 60 + new Date().getMinutes()) / 30);

  const expectedNowText = useMemo(() => {
    if (!state.routineModel.isSeeded) return 'Awaiting calibration...';
    const dist = getMarginalDist(state.routineModel, currentBin);
    let maxIdx = 0;
    let maxVal = -1;
    for (let i = 0; i < dist.length; i++) {
      if (dist[i] > maxVal) {
        maxVal = dist[i];
        maxIdx = i;
      }
    }
    const cls = EVENT_CLASSES[maxIdx];
    const icon = EVENT_ICONS[cls] || '❓';
    return `${icon} ${cls.replace(/_/g, ' ')}`;
  }, [state.routineModel, currentBin]);

  const expectedNextText = useMemo(() => {
    if (!state.routineModel.isSeeded) return 'Awaiting calibration...';
    
    const nextBin = (currentBin + 1) % 48;
    const lastEvent = state.recentEvents[state.recentEvents.length - 1];
    let prevIdx = lastEvent ? EVENT_CLASSES.indexOf(lastEvent.eventClass) : EVENT_CLASSES.indexOf('afternoon_nap_silence');
    if (prevIdx === -1) prevIdx = EVENT_CLASSES.indexOf('afternoon_nap_silence');
    
    let maxTransitionIdx = 0;
    let maxTransitionCount = -1;
    for (let curr = 0; curr < 12; curr++) {
      const count = state.routineModel.counts[nextBin * 12 * 12 + prevIdx * 12 + curr] || 0;
      if (count > maxTransitionCount) {
        maxTransitionCount = count;
        maxTransitionIdx = curr;
      }
    }
    
    const cls = EVENT_CLASSES[maxTransitionIdx];
    const icon = EVENT_ICONS[cls] || '❓';
    return `${icon} ${cls.replace(/_/g, ' ')}`;
  }, [state.routineModel, state.recentEvents, currentBin]);

  const getRelativeTime = (ts: number) => {
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 5) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    return `${diffMin}m ago`;
  };

  // Filter ticker events: do not repeat consecutive silences to avoid flooding the UI
  const filteredTickerEvents = useMemo(() => {
    const result: AudioEvent[] = [];
    let prevWasSilence = false;

    // Process from oldest to newest, but we'll reverse for rendering (most recent first)
    state.recentEvents.forEach((event) => {
      const isSilence = event.eventClass === 'afternoon_nap_silence';
      if (isSilence) {
        if (!prevWasSilence) {
          result.push(event);
          prevWasSilence = true;
        }
      } else {
        result.push(event);
        prevWasSilence = false;
      }
    });

    return [...result].reverse().slice(0, 10);
  }, [state.recentEvents]);

  const statusNormal = state.status === 'monitoring';

  return (
    <div className="space-y-6">
      
      {/* Top row — status bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-4 shadow-md print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          {/* Pulsing indicator */}
          <div className="relative flex h-3 w-3 shrink-0">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              statusNormal ? 'bg-teal-400' : 'bg-rose-400'
            }`} />
            <span className={`relative inline-flex rounded-full h-3 w-3 ${
              statusNormal ? 'bg-teal-500' : 'bg-rose-500'
            }`} />
          </div>
          
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-200 shrink-0">
            {state.status === 'alert' ? '🚨 ALERT ACTIVE' : '✓ MONITORING ACTIVE'}
          </span>
          
          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase shrink-0 ${
            state.micSource === 'remote_phone'
              ? 'bg-blue-950/60 text-blue-400 border border-blue-900/30'
              : 'bg-teal-950/60 text-teal-400 border border-teal-900/30'
          }`}>
            {state.micSource === 'remote_phone' ? '📱 WiFi Mic' : '💻 Local Mic'}
          </span>

          {/* Real-time Oscilloscope visualizer */}
          {state.isListening && (
            <div className="flex items-center gap-1.5 pl-1 shrink-0">
              <span className="text-[10px] text-slate-500 font-mono">SIGNAL:</span>
              <AudioVisualizer getAnalyser={getAnalyser} isListening={state.isListening} />
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 text-xxs font-mono text-slate-400 ml-auto md:ml-0">
          <span>Obs: <strong className="text-slate-200">{state.routineModel.totalObservations}</strong></span>
          <span className={state.klScore > 2.5 ? 'text-amber-400 animate-pulse' : 'text-slate-400'}>
            KL Score: <strong className="text-slate-200">{state.klScore.toFixed(2)}</strong>
          </span>
          <button
            type="button"
            onClick={stopMonitoring}
            className="bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-slate-200 px-3 py-1 rounded border border-slate-855 transition-all text-[10px] font-medium"
          >
            Stop
          </button>
        </div>
      </div>

      {/* Second row — three stat cards */}
      <div className="grid grid-cols-3 gap-4 print:hidden">
        {/* Card 1 */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 text-center space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">Classified Today</span>
          <span className="text-2xl md:text-3xl font-extrabold text-slate-100 font-mono">{eventsCount}</span>
        </div>
        {/* Card 2 */}
        <div className={`border rounded-xl p-4 text-center space-y-1 transition-all ${
          activeAlertsCount > 0 
            ? 'bg-rose-950/20 border-rose-900/50 shadow-lg shadow-rose-900/5' 
            : 'bg-slate-900/60 border-slate-800/80'
        }`}>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">Active Alerts</span>
          <span className={`text-2xl md:text-3xl font-extrabold font-mono ${
            activeAlertsCount > 0 ? 'text-rose-400' : 'text-slate-100'
          }`}>{activeAlertsCount}</span>
        </div>
        {/* Card 3 */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 text-center space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">Transitions Logged</span>
          <span className="text-2xl md:text-3xl font-extrabold text-slate-100 font-mono">{state.routineModel.totalObservations}</span>
        </div>
      </div>

      {/* Cognitive Routine Insights Card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4 print:hidden">
        <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5 border-b border-slate-800/40 pb-2">
          🤖 Live Cognitive Routine Insights
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="bg-slate-900/50 border border-slate-850 p-3.5 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Temporal Span</span>
            <div className="text-base font-bold text-slate-200 font-mono">
              {daysOfData} {daysOfData === 1 ? 'Day' : 'Days'}
            </div>
            <p className="text-[9px] text-slate-550 leading-none">Baseline snapshots on disk</p>
          </div>

          <div className="bg-slate-900/50 border border-slate-850 p-3.5 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Transitions</span>
            <div className="text-base font-bold text-slate-200 font-mono">
              {state.routineModel.totalObservations}
            </div>
            <p className="text-[9px] text-slate-555 leading-none font-medium">Logged Markov count steps</p>
          </div>

          <div className="bg-slate-900/50 border border-slate-850 p-3.5 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Expected Behavior Now</span>
            <div className="text-sm font-bold text-slate-200 truncate capitalize">
              {expectedNowText}
            </div>
            <p className="text-[9px] text-slate-550 leading-none">Peak marginal probability</p>
          </div>

          <div className="bg-slate-900/50 border border-slate-850 p-3.5 rounded-xl space-y-1 border-l-2 border-l-teal-500/30">
            <span className="text-[10px] text-teal-450 uppercase font-bold text-teal-400">Guardian Expects (Next 30m)</span>
            <div className="text-sm font-bold text-teal-400 truncate capitalize">
              {expectedNextText}
            </div>
            <p className="text-[9px] text-slate-555 leading-none font-medium">Markov transition prediction</p>
          </div>
        </div>
      </div>

      {/* Alerts Panel */}
      <div className="print:hidden">
        <AlertPanel alerts={state.alerts} acknowledgeAlert={acknowledgeAlert} />
      </div>

      {/* Alert History Timeline (Incident Medical Record Ledger) */}
      <AlertHistoryTimeline alerts={state.alerts} />

      {/* Events Ticker */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl space-y-3.5 print:hidden">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5 border-b border-slate-800 pb-2.5">
          📊 Real-Time Ambient Acoustic Feed
        </h3>

        {filteredTickerEvents.length === 0 ? (
          <p className="text-xxs text-slate-555 italic py-4 text-center">
            Awaiting sounds... captures occur every 1 second.
          </p>
        ) : (
          <div className="divide-y divide-slate-850 overflow-hidden rounded-lg border border-slate-850">
            {filteredTickerEvents.map((event) => {
              const icon = EVENT_ICONS[event.eventClass] || '❓';
              const isCritical = ['fall_impact', 'distress_call'].includes(event.eventClass);

              return (
                <div
                  key={event.timestamp + '-' + event.eventClass}
                  className={`px-4 py-3 flex items-center justify-between text-xs transition-colors ${
                    isCritical 
                      ? 'bg-rose-950/20 text-rose-300' 
                      : 'bg-slate-950/30 hover:bg-slate-900 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-sm shrink-0">{icon}</span>
                    <span className={`capitalize font-medium truncate ${
                      isCritical ? 'text-rose-400 font-bold' : 'text-slate-200'
                    }`}>
                      {event.eventClass.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-slate-550 shrink-0 font-mono">
                      (Conf: {(event.confidence * 100).toFixed(0)}%)
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3 font-mono text-[10px] shrink-0 text-slate-455">
                    <span className="bg-slate-850 px-1.5 py-0.5 rounded text-[9px] text-slate-400">
                      {event.source === 'remote_phone' ? 'phone' : 'local'}
                    </span>
                    <span>{getRelativeTime(event.timestamp)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Routine Heatmap */}
      <div className="print:hidden">
        <RoutineHeatmap heatmapData={heatmapData} recentEvents={state.recentEvents} />
      </div>

    </div>
  );
}
