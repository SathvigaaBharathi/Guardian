import { useEffect, useRef, useState } from 'react';

interface AudioVisualizerProps {
  getAnalyser: () => AnalyserNode | null;
  isListening: boolean;
}

export function AudioVisualizer({ getAnalyser, isListening }: AudioVisualizerProps) {
  const canvasWaveRef = useRef<HTMLCanvasElement | null>(null);
  const canvasSpecRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<'waveform' | 'spectrogram'>('waveform');

  useEffect(() => {
    if (!isListening) return;

    let animationFrameId: number;
    let analyser: AnalyserNode | null = null;
    let attempts = 0;

    // Pre-initialize spectrogram background to slate-900
    const canvasSpec = canvasSpecRef.current;
    if (canvasSpec) {
      const ctxSpec = canvasSpec.getContext('2d');
      if (ctxSpec) {
        ctxSpec.fillStyle = 'rgb(15, 23, 42)';
        ctxSpec.fillRect(0, 0, canvasSpec.width, canvasSpec.height);
      }
    }

    const findAnalyser = () => {
      analyser = getAnalyser();
      if (!analyser && attempts < 10) {
        attempts++;
        setTimeout(findAnalyser, 200);
        return;
      }
      if (!analyser) return;

      const bufferLength = analyser.frequencyBinCount;
      const timeDataArray = new Uint8Array(bufferLength);
      const freqDataArray = new Uint8Array(bufferLength);

      const draw = () => {
        animationFrameId = requestAnimationFrame(draw);

        const canvasWave = canvasWaveRef.current;
        const canvasSpec = canvasSpecRef.current;

        // Draw waveform
        if (canvasWave) {
          const ctxWave = canvasWave.getContext('2d');
          if (ctxWave) {
            analyser!.getByteTimeDomainData(timeDataArray);

            ctxWave.fillStyle = 'rgb(15, 23, 42)'; // bg-slate-900
            ctxWave.fillRect(0, 0, canvasWave.width, canvasWave.height);

            ctxWave.lineWidth = 1.5;
            ctxWave.strokeStyle = 'rgb(20, 184, 166)'; // text-teal-500
            ctxWave.shadowBlur = 4;
            ctxWave.shadowColor = 'rgba(20, 184, 166, 0.6)';

            ctxWave.beginPath();
            const sliceWidth = canvasWave.width / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
              const v = timeDataArray[i] / 128.0;
              const y = (v * canvasWave.height) / 2;

              if (i === 0) {
                ctxWave.moveTo(x, y);
              } else {
                ctxWave.lineTo(x, y);
              }

              x += sliceWidth;
            }

            ctxWave.lineTo(canvasWave.width, canvasWave.height / 2);
            ctxWave.stroke();
          }
        }

        // Draw rolling spectrogram
        if (canvasSpec) {
          const ctxSpec = canvasSpec.getContext('2d');
          if (ctxSpec) {
            analyser!.getByteFrequencyData(freqDataArray);

            // Shift canvas left by 1 pixel
            ctxSpec.drawImage(
              canvasSpec,
              1, 0, canvasSpec.width - 1, canvasSpec.height,
              0, 0, canvasSpec.width - 1, canvasSpec.height
            );

            // Draw new column on the right edge
            const x = canvasSpec.width - 1;
            const binCount = Math.floor(freqDataArray.length * 0.6); // use bottom 60% of bins
            const step = binCount / canvasSpec.height;

            for (let y = 0; y < canvasSpec.height; y++) {
              // low frequencies at bottom, high at top
              const freqIdx = Math.floor((canvasSpec.height - 1 - y) * step);
              const val = freqDataArray[freqIdx] || 0;

              let fillStyle = 'rgb(15, 23, 42)';
              if (val > 10) {
                const ratio = val / 255;
                const hue = 180 - ratio * 180; // cyan (180) down to red (0)
                const light = 10 + ratio * 60;
                fillStyle = `hsl(${hue}, 100%, ${light}%)`;
              }

              ctxSpec.fillStyle = fillStyle;
              ctxSpec.fillRect(x, y, 1, 1);
            }
          }
        }
      };

      draw();
    };

    findAnalyser();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [getAnalyser, isListening]);

  const toggleMode = () => {
    setMode(prev => (prev === 'waveform' ? 'spectrogram' : 'waveform'));
  };

  return (
    <div className="flex items-center gap-2">
      <div
        onClick={toggleMode}
        className="relative group cursor-pointer"
        title="Click to toggle visualizer view (Waveform / Spectrogram)"
      >
        <canvas
          ref={canvasWaveRef}
          width={120}
          height={32}
          className={`bg-slate-900 border border-slate-800 rounded-lg overflow-hidden h-8 w-28 shrink-0 block ${
            mode === 'waveform' ? '' : 'hidden'
          }`}
        />
        <canvas
          ref={canvasSpecRef}
          width={120}
          height={32}
          className={`bg-slate-900 border border-slate-800 rounded-lg overflow-hidden h-8 w-28 shrink-0 block ${
            mode === 'spectrogram' ? '' : 'hidden'
          }`}
        />
        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg">
          <span className="text-[8px] font-mono font-bold text-slate-200 tracking-tighter uppercase">
            Toggle view
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={toggleMode}
        className="text-[9px] bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-850/80 rounded px-1.5 py-0.5 font-mono uppercase"
        title="Toggle audio visualizer type"
      >
        {mode === 'waveform' ? 'Wave' : 'Spec'}
      </button>
    </div>
  );
}
