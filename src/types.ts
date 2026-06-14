export type HomeEventClass =
  | 'footsteps_shuffling' | 'water_washing' | 'cooker_whistle'
  | 'mixie_grinder' | 'gate_door_bell' | 'devotional_chants' | 'afternoon_nap_silence'
  | 'cough_throat_clearing' | 'distress_call' | 'fall_impact'
  | 'vessel_clatter' | 'phone_ring';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export type MicSource = 'local' | 'remote_phone';

export interface AudioEvent {
  timestamp: number;        // Unix ms
  eventClass: HomeEventClass;
  confidence: number;       // 0–1
  timeBin: number;          // 0–47 (which 30-min window of the day)
  source: MicSource;        // whether this came from local mic or phone mic
}

export interface Anomaly {
  timeBin: number;
  score: number;            // KL divergence
  missingEvents: HomeEventClass[];
  observedEvents: HomeEventClass[];
  anomalyType: 'temporal_silence' | 'fall' | 'distress' | 'routine_break';
}

export interface Alert {
  id: string;
  timestamp: number;
  severity: AlertSeverity;
  anomaly: Anomaly;
  llmText: string;          // Generated natural language description
  acknowledged: boolean;
  acknowledgedAt?: number;
  reasoning?: string[]; // Chain of thought bullet reasoning steps
}

export interface RoutineModelState {
  counts: Float32Array;     // shape [48, 12, 12] flattened — transition counts
  totalObservations: number;
  lastUpdated: number;
  isSeeded: boolean;
}

export interface NetworkLogEntry {
  timestamp: number;
  url: string;
  method: string;
  bodyPreview: string;      // first 120 chars of request body — proves no audio
  containsAudio: boolean;   // always false — used to prove privacy claim
}

export interface GuardianState {
  status: 'idle' | 'seeding' | 'monitoring' | 'alert';
  isListening: boolean;
  micSource: MicSource;
  recentEvents: AudioEvent[];
  alerts: Alert[];
  routineModel: RoutineModelState;
  modelLoaded: boolean;
  modelStatus?: 'loading' | 'loaded' | 'failed';
  networkLog: NetworkLogEntry[];    // live log of all outbound requests
  klScore: number;                  // current KL divergence score for live display
  checkInRequested?: boolean;       // bidirectional welfare check status
  wsStatus?: 'connecting' | 'connected' | 'disconnected'; // WebSocket connection status
  demoStatus?: string;              // Step-by-step one-click demo progress status
}
