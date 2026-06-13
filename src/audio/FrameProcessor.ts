import { isActive } from './VAD';

const REQUIRED_SAMPLES = 15600; // 975ms × 16kHz — exact requirement for YAMNet

export function processFrame(raw: Float32Array): Float32Array | null {
  if (!isActive(raw)) return null;

  if (raw.length === REQUIRED_SAMPLES) return raw;

  const out = new Float32Array(REQUIRED_SAMPLES);
  if (raw.length >= REQUIRED_SAMPLES) {
    out.set(raw.subarray(0, REQUIRED_SAMPLES));
  } else {
    out.set(raw); // rest is zeros — zero padding
  }
  return out;
}
