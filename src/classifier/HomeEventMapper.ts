import { YAMNET_CLASS_MAP } from '../constants';
import { AudioEvent, HomeEventClass, MicSource } from '../types';

export function mapToHomeEvent(
  classIndex: number,
  confidence: number,
  source: MicSource = 'local'
): AudioEvent | null {
  if (confidence < 0.35) return null;

  const now = new Date();
  const timeBin = Math.floor((now.getHours() * 60 + now.getMinutes()) / 30);

  for (const [cls, indices] of Object.entries(YAMNET_CLASS_MAP)) {
    if (indices.includes(classIndex)) {
      return {
        timestamp: Date.now(),
        eventClass: cls as HomeEventClass,
        confidence,
        timeBin,
        source,
      };
    }
  }

  // No match but active sound is present — classify as tv_radio (serving as general background activity)
  if (confidence > 0.35) {
    return {
      timestamp: Date.now(),
      eventClass: 'mixie_grinder', // Map other unmapped active noises to mixie_grinder as general ambient activity
      confidence,
      timeBin,
      source,
    };
  }

  return null;
}
