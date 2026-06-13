import { useState, useEffect } from 'react';
import { useGuardian } from './hooks/useGuardian';
import { SetupPanel } from './components/SetupPanel';
import { MonitorDashboard } from './components/MonitorDashboard';
import { DemoControls } from './components/DemoControls';
import { PrivacyProof } from './components/PrivacyProof';
import { FamilyAlertView } from './components/FamilyAlertView';

export default function App() {
  const [hash, setHash] = useState(() => window.location.hash);

  // Simple hash-based router listener
  useEffect(() => {
    const handleHashChange = () => {
      setHash(window.location.hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (hash.startsWith('#family')) {
    return <FamilyAlertView />;
  }

  const guardian = useGuardian();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">
      {/* Top Header bar */}
      <header className="border-b border-slate-900 bg-slate-950 px-6 py-4 flex items-center gap-3">
        <div className={`w-2.5 h-2.5 rounded-full ${
          guardian.state.status === 'alert' 
            ? 'bg-rose-500 pulse-ring-red' 
            : guardian.state.status === 'monitoring' 
              ? 'bg-teal-400 pulse-ring-teal' 
              : 'bg-slate-700'
        }`} />
        
        <span className="text-lg font-bold tracking-tight text-slate-100">Guardian</span>
        
        {guardian.state.status === 'monitoring' && (
          <span className="text-[10px] bg-teal-950/60 text-teal-400 border border-teal-900/30 px-2 py-0.5 rounded font-mono uppercase">
            Active
          </span>
        )}

        <div className="text-xs text-slate-500 hidden sm:flex items-center gap-2.5 ml-auto">
          <span>Ambient Audio Safety Agent · Audio stays on-device</span>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-800" />
          <span className={`font-mono text-[10px] px-2 py-0.5 rounded border ${
            guardian.state.modelStatus === 'loaded' 
              ? 'bg-teal-950/40 text-teal-400 border-teal-900/30' 
              : guardian.state.modelStatus === 'loading'
                ? 'bg-amber-950/20 text-amber-400 border-amber-900/30 animate-pulse'
                : 'bg-rose-950/40 text-rose-455 border-rose-900/30'
          }`}>
            {guardian.state.modelStatus === 'loaded' 
              ? '🤖 YAMNet: Connected' 
              : guardian.state.modelStatus === 'loading'
                ? '⏳ YAMNet: Loading...'
                : '⚠️ YAMNet: Simulated Mode'}
          </span>
        </div>
        
        <div className="flex items-center gap-3 ml-auto sm:ml-4">
          <span className="text-[10px] bg-slate-900 text-slate-350 border border-slate-800 px-2.5 py-1 rounded font-mono font-bold flex items-center gap-1" title="Caregiver pairing code">
            🔑 Code: <span className="text-teal-400 select-all font-extrabold">{guardian.pairingCode}</span>
          </span>
          <a
            href={`#family?code=${guardian.pairingCode}`}
            className="text-xs text-teal-400 hover:text-teal-300 underline font-medium"
            target="_blank"
            rel="noreferrer"
          >
            Family view →
          </a>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {guardian.state.status === 'idle' || guardian.state.status === 'seeding' ? (
          <SetupPanel
            state={guardian.state}
            startMonitoring={guardian.startMonitoring}
            seedPrior={guardian.seedPrior}
            setMicSource={guardian.setMicSource}
          />
        ) : (
          <MonitorDashboard
            state={guardian.state}
            stopMonitoring={guardian.stopMonitoring}
            acknowledgeAlert={guardian.acknowledgeAlert}
            getAnalyser={guardian.getAnalyser}
          />
        )}
        
        <PrivacyProof networkLog={guardian.state.networkLog} />
        
        <DemoControls
          injectDemoEvent={guardian.injectDemoEvent}
          injectDemoSequence={guardian.injectDemoSequence}
          resetModelToPrior={guardian.resetModelToPrior}
        />
      </main>
    </div>
  );
}
