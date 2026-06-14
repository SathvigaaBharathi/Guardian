import React, { useState } from 'react';
import { HomeEventClass } from '../types';

interface DemoControlsProps {
  injectDemoEvent: (cls: HomeEventClass) => void;
  injectDemoSequence: (sequence: HomeEventClass[], bins: number[]) => void;
  resetModelToPrior: () => void;
  runOneClickDemo: () => void;
}

export function DemoControls({
  injectDemoEvent,
  injectDemoSequence,
  resetModelToPrior,
  runOneClickDemo,
}: DemoControlsProps) {
  const [collapsed, setCollapsed] = useState(true);

  // normal morning sequence: devotional_chants, cooker_whistle, mixie_grinder, vessel_clatter at bins 14, 15, 16
  const handleSimulateNormalMorning = () => {
    const seq: HomeEventClass[] = ['devotional_chants', 'cooker_whistle', 'mixie_grinder', 'vessel_clatter'];
    const bins = [14, 14, 15, 16];
    injectDemoSequence(seq, bins);
  };

  // silence anomaly sequence: silence, silence, silence, silence, silence, silence at bins 14, 15, 16
  const handleSimulateSilenceAnomaly = () => {
    const seq: HomeEventClass[] = [
      'afternoon_nap_silence', 
      'afternoon_nap_silence', 
      'afternoon_nap_silence', 
      'afternoon_nap_silence', 
      'afternoon_nap_silence', 
      'afternoon_nap_silence'
    ];
    const bins = [14, 14, 15, 15, 16, 16];
    injectDemoSequence(seq, bins);
  };

  // typical afternoon sequence: afternoon_nap_silence × 4 at bins 28, 29, 30, 31
  const handleSimulateAfternoon = () => {
    const seq: HomeEventClass[] = [
      'afternoon_nap_silence', 
      'afternoon_nap_silence', 
      'afternoon_nap_silence', 
      'afternoon_nap_silence'
    ];
    const bins = [28, 29, 30, 31];
    injectDemoSequence(seq, bins);
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
          🛠️ Demo & Simulation Center <span className="text-xxs text-teal-400 bg-teal-950/60 border border-teal-900/30 px-1.5 py-0.5 rounded font-normal">Judges Only</span>
        </h3>
        <span className="text-xs text-slate-500 font-mono">
          {collapsed ? '▲ Show Controls' : '▼ Hide Controls'}
        </span>
      </button>

      {!collapsed && (
        <div className="space-y-6 pt-1">
          {/* One-Click Automated Demo Mode */}
          <div className="bg-slate-950/40 border border-teal-900/30 p-4 rounded-xl text-center space-y-3 shadow-inner">
            <h4 className="text-xs font-bold text-teal-400 flex items-center justify-center gap-1.5">
              🚀 Automated Demo Walkthrough
            </h4>
            <p className="text-xxs text-slate-400 max-w-[320px] mx-auto leading-relaxed">
              Seeds model prior, logs typical breakfast activities, counts down 10 seconds, then registers unexpected morning silence. Anomaly triggers safety alert automatically.
            </p>
            <button
              type="button"
              onClick={runOneClickDemo}
              className="bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 hover:brightness-110 active:scale-[0.98] px-5 py-2.5 rounded-xl text-xs font-extrabold tracking-wide transition-all shadow-md inline-block"
            >
              Start Automated Demo Mode
            </button>
          </div>

          {/* Single Event Injectors */}
          <div className="space-y-2">
            <h4 className="text-xxs font-semibold uppercase tracking-wider text-slate-400">
              Inject Single Incident Events
            </h4>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => injectDemoEvent('fall_impact')}
                className="bg-rose-950/30 border border-rose-900 text-rose-300 hover:bg-rose-900 hover:text-white px-3 py-2 rounded-lg text-xs font-semibold transition-all active:translate-y-px"
              >
                ⚠️ Simulate Fall
              </button>
              <button
                type="button"
                onClick={() => injectDemoEvent('distress_call')}
                className="bg-orange-950/30 border border-orange-900 text-orange-300 hover:bg-orange-900 hover:text-white px-3 py-2 rounded-lg text-xs font-semibold transition-all active:translate-y-px"
              >
                🆘 Simulate Distress Call
              </button>
              <button
                type="button"
                onClick={() => injectDemoEvent('vessel_clatter')}
                className="bg-amber-950/30 border border-amber-900 text-amber-300 hover:bg-amber-900 hover:text-white px-3 py-2 rounded-lg text-xs font-semibold transition-all active:translate-y-px"
              >
                🍽️ Vessel Clatter
              </button>
            </div>
          </div>

          {/* Sequence Injectors */}
          <div className="space-y-2">
            <h4 className="text-xxs font-semibold uppercase tracking-wider text-slate-400">
              Inject Markov Transition Sequences
            </h4>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={handleSimulateNormalMorning}
                className="bg-slate-950 border border-slate-800 text-slate-300 hover:border-teal-500 hover:text-teal-400 px-3 py-2 rounded-lg text-xs font-semibold transition-all active:translate-y-px"
              >
                🙏 Puja & Breakfast (Normal)
              </button>
              <button
                type="button"
                onClick={handleSimulateSilenceAnomaly}
                className="bg-slate-950 border border-slate-800 text-slate-300 hover:border-rose-500 hover:text-rose-400 px-3 py-2 rounded-lg text-xs font-semibold transition-all active:translate-y-px"
              >
                🔇 Morning Silence (Anomaly)
              </button>
              <button
                type="button"
                onClick={handleSimulateAfternoon}
                className="bg-slate-950 border border-slate-800 text-slate-300 hover:border-teal-500 hover:text-teal-400 px-3 py-2 rounded-lg text-xs font-semibold transition-all active:translate-y-px"
              >
                😴 Typical Afternoon Nap
              </button>
            </div>
          </div>

          {/* Resets */}
          <div className="flex justify-between items-center border-t border-slate-800 pt-4">
            <p className="text-[10px] text-slate-500 leading-normal max-w-[70%]">
              * Injected events bypass the microphone and YAMNet layers, injecting raw AudioEvents directly into state. The anomaly detection and alert models process them identically.
            </p>
            <button
              type="button"
              onClick={resetModelToPrior}
              className="bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-slate-100 px-4 py-2 rounded-lg text-xs font-semibold transition-all active:translate-y-px shrink-0"
            >
              🔄 Reset to Prior
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
