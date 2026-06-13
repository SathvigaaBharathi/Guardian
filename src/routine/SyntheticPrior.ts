import { createModel, updateModel } from './MarkovRoutineModel';
import { RoutineModelState, AudioEvent, HomeEventClass } from '../types';

// timeBin 0 = 00:00–00:30, bin 14 = 07:00–07:30, bin 28 = 14:00–14:30
const TYPICAL_DAY: [number, HomeEventClass][] = [
  [0, 'afternoon_nap_silence'], [1, 'afternoon_nap_silence'], [2, 'afternoon_nap_silence'], [3, 'afternoon_nap_silence'],
  [4, 'afternoon_nap_silence'], [5, 'afternoon_nap_silence'], [6, 'afternoon_nap_silence'], [7, 'afternoon_nap_silence'],
  [8, 'afternoon_nap_silence'], [9, 'afternoon_nap_silence'], [10, 'afternoon_nap_silence'], [11, 'afternoon_nap_silence'],
  [12, 'footsteps_shuffling'], [12, 'cough_throat_clearing'], // 06:00 - 06:30 AM
  [13, 'footsteps_shuffling'], [13, 'water_washing'], // 06:30 - 07:00 AM (washing face/sweeping)
  [14, 'devotional_chants'], [14, 'cooker_whistle'], [14, 'mixie_grinder'], // 07:00 - 07:30 AM (Puja chants, mixie grinding idli batter)
  [15, 'devotional_chants'], [15, 'mixie_grinder'], // 07:30 - 08:00 AM
  [16, 'cooker_whistle'], [16, 'vessel_clatter'], // 08:00 - 08:30 AM (boiling milk, tumbler clatter)
  [17, 'gate_door_bell'], [17, 'vessel_clatter'], // 08:30 - 09:00 AM (newspaper delivery, filter coffee clinking)
  [18, 'gate_door_bell'], [18, 'phone_ring'], // 09:00 - 09:30 AM (maid arrival, morning phone call)
  [19, 'water_washing'], [20, 'water_washing'], // 09:30 - 10:30 AM (bathing & washing vessels)
  [21, 'afternoon_nap_silence'], [22, 'afternoon_nap_silence'], [23, 'phone_ring'], // 10:30 - 12:00 PM
  [24, 'afternoon_nap_silence'], [25, 'afternoon_nap_silence'], // 12:00 - 01:00 PM
  [26, 'cooker_whistle'], [26, 'vessel_clatter'], // 01:00 - 01:30 PM (lunch cooker whistle & plates)
  [27, 'vessel_clatter'], [27, 'afternoon_nap_silence'], // 01:30 - 02:00 PM
  [28, 'afternoon_nap_silence'], [29, 'afternoon_nap_silence'], [30, 'afternoon_nap_silence'], [31, 'afternoon_nap_silence'], [32, 'afternoon_nap_silence'], // 02:00 - 04:30 PM (Afternoon nap silence)
  [33, 'vessel_clatter'], [33, 'devotional_chants'], // 04:30 - 05:00 PM (Evening filter coffee clanging)
  [34, 'devotional_chants'], [34, 'footsteps_shuffling'], // 05:00 - 05:30 PM
  [35, 'devotional_chants'], [36, 'devotional_chants'], [37, 'devotional_chants'], // 05:30 - 07:00 PM (lighting lamp, evening prayers)
  [38, 'afternoon_nap_silence'], [39, 'afternoon_nap_silence'], // 07:00 - 08:00 PM
  [40, 'footsteps_shuffling'], [40, 'vessel_clatter'], // 08:00 - 08:30 PM (preparing light dinner, plates clattering)
  [41, 'water_washing'], [41, 'afternoon_nap_silence'], // 08:30 - 09:00 PM (cleaning kitchen sink)
  [42, 'afternoon_nap_silence'], [43, 'afternoon_nap_silence'], [44, 'afternoon_nap_silence'], [45, 'afternoon_nap_silence'], // 09:00 - 11:00 PM (sleeping)
  [46, 'afternoon_nap_silence'], [47, 'afternoon_nap_silence'] // 11:00 - 12:00 AM
];

export function seedPriorFromTypicalDay(): RoutineModelState {
  let model = createModel();
  // Inject 3× to give reasonable statistical weight before real data arrives
  for (let repeat = 0; repeat < 3; repeat++) {
    let prev: AudioEvent | null = null;
    for (const [bin, cls] of TYPICAL_DAY) {
      const event: AudioEvent = {
        timestamp: Date.now(),
        eventClass: cls,
        confidence: 0.8,
        timeBin: bin,
        source: 'local',
      };
      model = updateModel(model, prev, event);
      prev = event;
    }
  }
  return { ...model, isSeeded: true };
}
