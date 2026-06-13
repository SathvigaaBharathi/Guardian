import { HomeEventClass } from './types';

export const NUM_TIME_BINS = 48;
export const NUM_EVENT_CLASSES = 12;
export const SAMPLE_RATE = 16000;
export const FRAME_DURATION_MS = 975;
export const VAD_ENERGY_THRESHOLD = 0.01;
export const ANOMALY_KL_THRESHOLD = 2.5;
export const ANOMALY_CONSECUTIVE_BINS = 2;
export const LAPLACE_SMOOTHING = 1.0;
export const CRITICAL_EVENTS: HomeEventClass[] = ['fall_impact', 'distress_call'];
export const MAX_RECENT_EVENTS = 120;    // keep last 2 minutes of events in state
export const ANOMALY_CHECK_INTERVAL_MS = 30_000;
export const HEATMAP_REFRESH_INTERVAL_MS = 5_000;

export const YAMNET_CLASS_MAP: Record<HomeEventClass, number[]> = {
  footsteps_shuffling:   [1, 2, 3],        // footsteps, walking
  water_washing:         [288, 289, 290],  // water, splash, gurgle
  cooker_whistle:        [302, 389, 391],  // steam/hissing, whistle, steam whistle (pressure cooker)
  mixie_grinder:         [350, 358, 363],  // electric motor, vacuum cleaner, blender (mixie)
  gate_door_bell:        [279, 280, 395, 396], // door squeak, knock, buzzer, door bell
  devotional_chants:     [0, 4, 5, 6, 132], // voice, singing, speaking, chanting, music (prayers)
  afternoon_nap_silence: [],
  cough_throat_clearing: [313, 314, 315],  // cough, throat clearing, sneeze
  distress_call:         [15, 16, 44],      // scream, shout, groan
  fall_impact:           [467, 468, 469],  // thud, crash, bang (fall)
  vessel_clatter:        [318, 514, 519],  // tableware/dishware, clink/clank, chime (steel vessels)
  phone_ring:            [397, 398],        // telephone ring, cell ring
};

export const EVENT_ICONS: Record<HomeEventClass, string> = {
  footsteps_shuffling:   '🚶',
  water_washing:         '🚿',
  cooker_whistle:        '💨',
  mixie_grinder:         '⚙️',
  gate_door_bell:        '🚪',
  devotional_chants:     '🙏',
  afternoon_nap_silence: '🔇',
  cough_throat_clearing: '🤧',
  distress_call:         '🆘',
  fall_impact:           '⚠️',
  vessel_clatter:        '🍽️',
  phone_ring:            '📞',
};
