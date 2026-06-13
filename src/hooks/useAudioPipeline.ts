import { useEffect, useRef } from 'react';
import { AudioCapture } from '../audio/AudioCapture';

export function useAudioPipeline() {
  const captureRef = useRef<AudioCapture>(new AudioCapture());

  useEffect(() => {
    const capture = captureRef.current;
    return () => {
      try {
        capture.stop();
      } catch (e) {
        console.warn('Audio capture cleanup failed:', e);
      }
    };
  }, []);

  return captureRef;
}
