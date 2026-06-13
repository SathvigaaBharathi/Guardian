import { getMarginalDist, EVENT_CLASSES } from './MarkovRoutineModel';
import { ANOMALY_KL_THRESHOLD, CRITICAL_EVENTS } from '../constants';
import { AudioEvent, Anomaly, RoutineModelState, HomeEventClass } from '../types';

function klDivergence(observed: Float32Array, baseline: Float32Array): number {
  let kl = 0;
  for (let i = 0; i < observed.length; i++) {
    if (observed[i] > 0) {
      kl += observed[i] * Math.log((observed[i] + 1e-10) / (baseline[i] + 1e-10));
    }
  }
  return kl;
}

export function buildObservedDist(events: AudioEvent[], bin: number): Float32Array {
  const counts = new Float32Array(12).fill(0);
  const binEvents = events.filter(e => e.timeBin === bin);
  if (binEvents.length === 0) {
    counts[EVENT_CLASSES.indexOf('afternoon_nap_silence')] = 1;
  } else {
    binEvents.forEach(e => { 
      const idx = EVENT_CLASSES.indexOf(e.eventClass);
      if (idx !== -1) counts[idx] += 1; 
    });
  }
  const total = counts.reduce((a, b) => a + b, 0);
  return counts.map(v => v / (total || 1)) as Float32Array;
}

export function detectAnomaly(
  model: RoutineModelState,
  recentEvents: AudioEvent[],
  currentBin: number
): Anomaly | null {
  // Critical events: immediate alert, bypass routine check
  const criticalEvent = [...recentEvents].reverse().find(e =>
    CRITICAL_EVENTS.includes(e.eventClass) &&
    Date.now() - e.timestamp < 60_000
  );
  if (criticalEvent) {
    return {
      timeBin: currentBin,
      score: 99,
      missingEvents: [],
      observedEvents: [criticalEvent.eventClass],
      anomalyType: criticalEvent.eventClass === 'fall_impact' ? 'fall' : 'distress',
    };
  }

  if (!model.isSeeded || model.totalObservations < 20) return null;

  const baseline = getMarginalDist(model, currentBin);
  const observed = buildObservedDist(recentEvents, currentBin);
  const score = klDivergence(observed, baseline);

  if (score < ANOMALY_KL_THRESHOLD) return null;

  // 1. Identify missing critical routine indicators (e.g. awake & active indicators)
  const ROUTINE_ACTIVITIES: HomeEventClass[] = ['footsteps_shuffling', 'devotional_chants', 'water_washing', 'cooker_whistle'];
  const missingEvents = EVENT_CLASSES.filter((cls, i) =>
    ROUTINE_ACTIVITIES.includes(cls) && baseline[i] > 0.1 && observed[i] < 0.02
  );

  // 2. Identify unexpected active sounds when silence is expected (e.g. night wandering)
  const isSilenceExpected = baseline[EVENT_CLASSES.indexOf('afternoon_nap_silence')] > 0.7;
  const activeObserved = recentEvents.slice(-5).filter(e => 
    e.eventClass !== 'afternoon_nap_silence' && Date.now() - e.timestamp < 60_000
  );

  const isTemporalSilenceAnomaly = missingEvents.length > 0;
  const isUnexpectedNightActivity = isSilenceExpected && activeObserved.length > 0;

  // Filter out non-critical routine breaks (like the TV being turned off or phone not ringing)
  if (!isTemporalSilenceAnomaly && !isUnexpectedNightActivity) {
    return null;
  }

  return {
    timeBin: currentBin,
    score,
    missingEvents,
    observedEvents: recentEvents.slice(-5).map(e => e.eventClass),
    anomalyType: isTemporalSilenceAnomaly ? 'temporal_silence' : 'routine_break',
  };
}

// Exposed for live KL display in dashboard
export function getCurrentKLScore(
  model: RoutineModelState,
  recentEvents: AudioEvent[],
  currentBin: number
): number {
  if (!model.isSeeded || model.totalObservations < 20) return 0;
  const baseline = getMarginalDist(model, currentBin);
  const observed = buildObservedDist(recentEvents, currentBin);
  return klDivergence(observed, baseline);
}
