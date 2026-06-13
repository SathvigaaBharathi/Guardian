import { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  getAnalyser: () => AnalyserNode | null;
  isListening: boolean;
}

export function AudioVisualizer({ getAnalyser, isListening }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isListening) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let analyser: AnalyserNode | null = null;
    let attempts = 0;

    // Retry checking for analyser node if setup lags slightly
    const findAnalyser = () => {
      analyser = getAnalyser();
      if (!analyser && attempts < 10) {
        attempts++;
        setTimeout(findAnalyser, 200);
        return;
      }
      if (!analyser) return;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        if (!canvas || !ctx) return;
        animationFrameId = requestAnimationFrame(draw);

        analyser!.getByteTimeDomainData(dataArray);

        // Dark background
        ctx.fillStyle = 'rgb(15, 23, 42)'; // bg-slate-900
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Drawing parameters
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgb(20, 184, 166)'; // text-teal-500
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(20, 184, 166, 0.6)';

        ctx.beginPath();

        const sliceWidth = canvas.width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * canvas.height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
      };

      draw();
    };

    findAnalyser();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [getAnalyser, isListening]);

  return (
    <canvas
      ref={canvasRef}
      width={120}
      height={32}
      className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden h-8 w-28 shrink-0 block"
    />
  );
}
