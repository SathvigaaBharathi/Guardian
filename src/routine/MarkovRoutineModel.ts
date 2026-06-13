import { NUM_TIME_BINS, NUM_EVENT_CLASSES, LAPLACE_SMOOTHING } from '../constants';
import { HomeEventClass, AudioEvent, RoutineModelState } from '../types';

export const EVENT_CLASSES: HomeEventClass[] = [
  'footsteps_shuffling',
  'water_washing',
  'cooker_whistle',
  'mixie_grinder',
  'gate_door_bell',
  'devotional_chants',
  'afternoon_nap_silence',
  'cough_throat_clearing',
  'distress_call',
  'fall_impact',
  'vessel_clatter',
  'phone_ring',
];

export function classIndex(c: HomeEventClass): number {
  return EVENT_CLASSES.indexOf(c);
}

function idx(bin: number, prev: number, curr: number): number {
  return bin * NUM_EVENT_CLASSES * NUM_EVENT_CLASSES + prev * NUM_EVENT_CLASSES + curr;
}

export function createModel(): RoutineModelState {
  const size = NUM_TIME_BINS * NUM_EVENT_CLASSES * NUM_EVENT_CLASSES;
  return {
    counts: new Float32Array(size).fill(LAPLACE_SMOOTHING),
    totalObservations: 0,
    lastUpdated: Date.now(),
    isSeeded: false,
  };
}

export function updateModel(
  model: RoutineModelState,
  prevEvent: AudioEvent | null,
  currEvent: AudioEvent
): RoutineModelState {
  const newCounts = new Float32Array(model.counts);
  const prevIdx = prevEvent ? classIndex(prevEvent.eventClass) : classIndex('afternoon_nap_silence');
  const currIdx = classIndex(currEvent.eventClass);
  newCounts[idx(currEvent.timeBin, prevIdx, currIdx)] += 1;
  return {
    ...model,
    counts: newCounts,
    totalObservations: model.totalObservations + 1,
    lastUpdated: Date.now(),
  };
}

export function getMarginalDist(model: RoutineModelState, bin: number): Float32Array {
  const dist = new Float32Array(NUM_EVENT_CLASSES);
  for (let prev = 0; prev < NUM_EVENT_CLASSES; prev++) {
    for (let curr = 0; curr < NUM_EVENT_CLASSES; curr++) {
      dist[curr] += model.counts[idx(bin, prev, curr)];
    }
  }
  const total = dist.reduce((a, b) => a + b, 0);
  return dist.map(v => v / (total || 1)) as Float32Array;
}

// Export model state as JSON string for localStorage persistence
export function exportModel(model: RoutineModelState): string {
  return JSON.stringify({
    counts: Array.from(model.counts),
    totalObservations: model.totalObservations,
    lastUpdated: model.lastUpdated,
    isSeeded: model.isSeeded,
  });
}

// Restore model from JSON string
export function importModel(json: string): RoutineModelState {
  const parsed = JSON.parse(json);
  return {
    counts: new Float32Array(parsed.counts),
    totalObservations: parsed.totalObservations,
    lastUpdated: parsed.lastUpdated,
    isSeeded: parsed.isSeeded,
  };
}
