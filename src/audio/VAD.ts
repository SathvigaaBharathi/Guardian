import { VAD_ENERGY_THRESHOLD } from '../constants';

export function computeRMS(frame: Float32Array): number {
  if (frame.length === 0) return 0;
  const sum = frame.reduce((acc, v) => acc + v * v, 0);
  return Math.sqrt(sum / frame.length);
}

export function isActive(frame: Float32Array): boolean {
  return computeRMS(frame) > VAD_ENERGY_THRESHOLD;
}
