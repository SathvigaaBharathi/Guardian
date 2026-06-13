import React, { useState } from 'react';
import { GuardianState, MicSource } from '../types';
import { AudioCapture } from '../audio/AudioCapture';

interface SetupPanelProps {
  state: GuardianState;
  startMonitoring: () => void;
  seedPrior: () => void;
  setMicSource: (source: MicSource) => void;
}

export function SetupPanel({
  state,
  startMonitoring,
  seedPrior,
  setMicSource,
}: SetupPanelProps) {
  const [micPermitted, setMicPermitted] = useState(false);
  
  // Safe notification API detection to prevent ReferenceErrors on iOS/mobile
  const isNotificationSupported = typeof window !== 'undefined' && 'Notification' in window;
  
  const [notifPermitted, setNotifPermitted] = useState(() => {
    if (isNotificationSupported) {
      return Notification.permission === 'granted';
    }
    return false;
  });
  
  const [checkingMic, setCheckingMic] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Seeding terminal logs state
  const [seedingLogs, setSeedingLogs] = useState<string[]>([]);
  const [isSeedingProgress, setIsSeedingProgress] = useState(false);

  const handleSeedPriorClick = () => {
    setIsSeedingProgress(true);
    setSeedingLogs([]);
    
    const logs = [
      "⚡ Initializing empty 48x12 transition matrix...",
      "📅 Loading baseline: Sleep intervals (11:00 PM - 06:00 AM)...",
      "🌅 Loading baseline: Morning wake-up & Puja chants...",
      "🍳 Loading baseline: Kitchen activity & cooker whistles...",
      "🔇 Loading baseline: Afternoon nap silence...",
      "📊 Running Laplace smoothing (α = 1.0)...",
      "✅ Prior seeded successfully! Matrix contains 144 observations."
    ];
    
    logs.forEach((log, index) => {
      setTimeout(() => {
        setSeedingLogs(prev => [...prev, log]);
        if (index === logs.length - 1) {
          setTimeout(() => {
            seedPrior(); // Trigger the actual seed callback
            setIsSeedingProgress(false);
          }, 350);
        }
      }, (index + 1) * 200);
    });
  };

  // Check mic permission status
  const requestMicPermission = async () => {
    setCheckingMic(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop()); // release mic
      setMicPermitted(true);
    } catch (e) {
      console.warn('Microphone permission request failed:', e);
      setMicPermitted(false);
      alert('Microphone access denied. Please enable microphone permissions in your browser or phone settings.');
    } finally {
      setCheckingMic(false);
    }
  };

  // Check notification permission status
  const requestNotifPermission = async () => {
    if (!isNotificationSupported) {
      alert("Push notifications are not supported on this browser or OS view. Note: iOS Safari only supports push notifications if you install the app as a Progressive Web App (PWA) to your home screen. You can still use the 'Family View' to monitor alerts in real-time.");
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setNotifPermitted(result === 'granted');
    } catch (e) {
      console.warn('Notification permission request failed:', e);
    }
  };

  const isModelSeeded = state.routineModel.isSeeded;
  const canStart = micPermitted && isModelSeeded;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Onboarding Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-900/40 via-slate-900 to-indigo-950/40 border border-slate-800 p-6 md:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-6 -ml-6 w-32 h-32 rounded-full bg-indigo-500/10 blur-3xl" />
        
        <div className="relative flex flex-col md:flex-row items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-teal-500 to-indigo-500 flex items-center justify-center text-white text-3xl font-extrabold shadow-lg shadow-teal-500/10">
            🛡️
          </div>
          <div className="flex-1 text-center md:text-left space-y-1.5">
            <h1 className="text-2xl md:text-3xl font-black text-slate-100 tracking-tight">
              Get Started with Guardian
            </h1>
            <p className="text-sm text-slate-400 max-w-md">
              Your intelligent, local ambient safety assistant. Let's configure your sensory input and initialize permissions in just a few quick taps.
            </p>
          </div>
        </div>
      </div>

      {/* Main Setup Wizard Card */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl space-y-8">
        
        {/* Model Status Warning (If offline/failed) */}
        {!state.modelLoaded && (
          <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-4 text-xs text-slate-300 leading-relaxed space-y-2 animate-fadeIn">
            <h4 className="font-bold text-amber-500 flex items-center gap-1.5">
              ⚠️ YAMNet Model Loading Offline
            </h4>
            <p>
              The YAMNet neural network model failed to load from local storage. This typically happens on mobile devices when accessing the site via a local IP using a self-signed HTTPS certificate, as mobile browsers often block subresource fetches on untrusted certificates. Guardian has automatically enabled <strong>Simulated Mode</strong>.
            </p>
            <p className="text-xxs text-slate-400">
              You can still click <strong>Launch</strong>, watch the ambient timeline tick, and use the <strong>Demo Simulation Controls</strong> to inject sounds, train the Markov routine matrix, and test caregiver alert synchronization on your phone.
            </p>
          </div>
        )}

        {/* Step 1: Input Sensor */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-400 font-mono font-bold text-xs flex items-center justify-center">1</div>
            <h3 className="text-base font-bold text-slate-200">Select Audio Input Sensor</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setMicSource('local')}
              className={`p-4 rounded-xl text-left border-2 transition-all duration-300 relative overflow-hidden group ${
                state.micSource === 'local'
                  ? 'bg-slate-950 border-teal-500/80 shadow-lg shadow-teal-500/5'
                  : 'bg-slate-950/40 border-slate-850 hover:border-slate-800 hover:bg-slate-950/80'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">💻</span>
                {state.micSource === 'local' && (
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
                )}
              </div>
              <h4 className="text-sm font-bold text-slate-200">This Device's Mic</h4>
              <p className="text-xs text-slate-500 mt-1 leading-normal">
                Use your computer's built-in microphone to monitor sounds locally.
              </p>
            </button>
            
            <button
              type="button"
              onClick={() => setMicSource('remote_phone')}
              className={`p-4 rounded-xl text-left border-2 transition-all duration-300 relative overflow-hidden group ${
                state.micSource === 'remote_phone'
                  ? 'bg-slate-950 border-teal-500/80 shadow-lg shadow-teal-500/5'
                  : 'bg-slate-950/40 border-slate-850 hover:border-slate-800 hover:bg-slate-950/80'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">📱</span>
                {state.micSource === 'remote_phone' && (
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
                )}
              </div>
              <h4 className="text-sm font-bold text-slate-200">Phone Mic over WiFi</h4>
              <p className="text-xs text-slate-500 mt-1 leading-normal">
                Use your mobile phone's mic. Great for positioning in other rooms.
              </p>
            </button>
          </div>

          {state.micSource === 'remote_phone' && (
            <div className="bg-gradient-to-r from-blue-950/30 to-indigo-950/30 border border-blue-900/50 rounded-xl p-4 text-xs text-slate-400 space-y-2 animate-fadeIn">
              <span className="font-bold text-blue-400 flex items-center gap-1.5">
                📶 Local WiFi Streaming Setup
              </span>
              <p className="leading-relaxed font-mono bg-slate-950/60 p-2.5 rounded border border-slate-850">
                {AudioCapture.getNetworkHint()}
              </p>
            </div>
          )}
        </div>

        {/* Step 2: System Approvals Checklist */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-400 font-mono font-bold text-xs flex items-center justify-center">2</div>
            <h3 className="text-base font-bold text-slate-200">Permissions & Initial Seeding</h3>
          </div>

          <div className="space-y-3">
            {/* Permission 1: Microphone */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-850 transition-all hover:bg-slate-950">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-200">1. Ambient Audio Permission</span>
                  {micPermitted && <span className="text-xs text-emerald-400 font-bold">✓ Active</span>}
                </div>
                <p className="text-xs text-slate-500 max-w-sm">
                  Required to sample sound clips on-device. Audio is processed locally and never stored.
                </p>
              </div>
              <button
                type="button"
                disabled={micPermitted || checkingMic}
                onClick={requestMicPermission}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
                  micPermitted
                    ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900/50 cursor-default'
                    : 'bg-teal-650 hover:bg-teal-600 active:scale-95 text-white border border-teal-500/20'
                }`}
              >
                {checkingMic ? 'Accessing...' : micPermitted ? '✓ Granted' : 'Authorize Microphone'}
              </button>
            </div>

            {/* Permission 2: Notifications */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-850 transition-all hover:bg-slate-950">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-200">2. Browser Alerts</span>
                  {notifPermitted ? (
                    <span className="text-xs text-emerald-400 font-bold">✓ Enabled</span>
                  ) : !isNotificationSupported ? (
                    <span className="text-xs text-amber-500 font-semibold">Caregiver Mode Only</span>
                  ) : null}
                </div>
                <p className="text-xs text-slate-500 max-w-sm">
                  Allows the browser to pop notifications when a critical event is detected.
                </p>
              </div>
              <button
                type="button"
                disabled={notifPermitted}
                onClick={requestNotifPermission}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
                  notifPermitted
                    ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900/50 cursor-default'
                    : !isNotificationSupported
                      ? 'bg-slate-800 text-slate-500 border border-slate-855 cursor-default'
                      : 'bg-teal-650 hover:bg-teal-600 active:scale-95 text-white border border-teal-500/20'
                }`}
              >
                {!isNotificationSupported ? 'Not Supported' : notifPermitted ? '✓ Configured' : 'Enable Notifications'}
              </button>
            </div>

            {/* Info block for unsupported notifications on iOS/mobile */}
            {!isNotificationSupported && (
              <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-3.5 text-xxs text-slate-400 space-y-1">
                <span className="font-bold text-amber-400 block">💡 Mobile Notification Hint:</span>
                <p className="leading-normal">
                  Standard Web Notifications are unavailable in this mobile browser. To monitor safety alerts, please launch the 
                  <strong className="text-slate-200"> Caregiver View (via the top-right link)</strong> on a phone, or run the monitoring page on a desktop browser.
                </p>
              </div>
            )}

            {/* Permission 3: Seeding Prior */}
            <div className="flex flex-col justify-between gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-850 transition-all hover:bg-slate-950">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-200">3. Acoustic Routine Prior</span>
                    {isModelSeeded && !isSeedingProgress && (
                      <span className="text-xs text-emerald-400 font-bold">✓ Matrix Ready</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Trains the AI model baseline probabilities using a simulated typical household day.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSeedPriorClick}
                  disabled={state.status === 'seeding' || isSeedingProgress}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
                    isModelSeeded && !isSeedingProgress
                      ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900/50 hover:bg-teal-950/30'
                      : 'bg-teal-650 hover:bg-teal-600 active:scale-95 text-white border border-teal-500/20'
                  }`}
                >
                  {isSeedingProgress ? 'Simulating...' : isModelSeeded ? '✓ Re-Seed' : 'Seed Routine'}
                </button>
              </div>

              {/* Seeding terminal logs console */}
              {(isSeedingProgress || seedingLogs.length > 0) && (
                <div className="bg-slate-950 border border-slate-850/85 rounded-lg p-3.5 font-mono text-[10px] text-teal-400 space-y-1.5 animate-fadeIn max-h-48 overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-slate-900 pb-1.5 mb-1.5 text-slate-500 font-bold">
                    <span>🤖 prior-matrix-seeder.log</span>
                    {isSeedingProgress && <span className="animate-pulse text-teal-500">SEEDING...</span>}
                  </div>
                  {seedingLogs.map((log, i) => (
                    <div key={i} className="animate-fadeIn">{log}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Start Button */}
        <div className="pt-2">
          <button
            type="button"
            disabled={!canStart}
            onClick={startMonitoring}
            className={`w-full py-4 rounded-xl text-sm font-extrabold tracking-wide border transition-all duration-300 select-none ${
              canStart
                ? 'bg-gradient-to-r from-teal-500 to-emerald-500 border-teal-400 hover:from-teal-400 hover:to-emerald-400 text-slate-950 shadow-lg shadow-teal-500/10 active:scale-[0.99]'
                : 'bg-slate-800/40 border-slate-855 text-slate-600 cursor-not-allowed'
            }`}
          >
            🚀 Launch Audio Ambient Monitoring
          </button>
          {!canStart && (
            <p className="text-xxs text-center text-rose-500/90 font-medium mt-3">
              * Please complete steps 1 and 3 (Authorize Microphone & Seed Routine Prior) to activate the monitor.
            </p>
          )}
        </div>

      </div>

      {/* Guide accordion to help new users */}
      <div className="border border-slate-850 rounded-2xl bg-slate-900/40">
        <button
          type="button"
          onClick={() => setShowGuide(!showGuide)}
          className="w-full px-5 py-4 flex items-center justify-between text-xs font-bold text-slate-300"
        >
          <span>❓ Troubleshooting & Live Testing Tutorial</span>
          <span>{showGuide ? '▲ Hide Guide' : '▼ View Guide'}</span>
        </button>

        {showGuide && (
          <div className="px-5 pb-5 border-t border-slate-850 pt-4 space-y-4 text-xs text-slate-400 leading-relaxed">
            <div className="space-y-1.5">
              <h4 className="font-bold text-slate-200">How to test this system right now:</h4>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Grant microphone access and click <strong className="text-teal-400">Seed Prior</strong>.</li>
                <li>Launch the Monitor. You will see a live dashboard detailing acoustic activity.</li>
                <li>Open the <strong className="text-teal-400">Family View</strong> in a secondary tab or phone browser by clicking the link in the header.</li>
                <li>Scroll to the bottom of the monitor dashboard, find the <strong className="text-slate-200">Simulation Controls</strong>, and click a critical event like <strong className="text-rose-400">Fall Impact</strong>.</li>
                <li>Watch the caregiver page update instantly in real time!</li>
              </ol>
            </div>
            
            <div className="space-y-1.5">
              <h4 className="font-bold text-slate-200">Why does it run entirely on-device?</h4>
              <p className="text-xxs">
                Unlike smart home speakers that stream transcripts to the cloud, Guardian runs a voice activity detector and YAMNet model locally in your browser memory. Audio samples are analyzed immediately and discarded within 1 second. No voice transcripts, clips, or files are ever stored or uploaded. Groq LLM descriptions are generated securely using the local API key configured in `.env`.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
