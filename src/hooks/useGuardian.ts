import { useReducer, useEffect, useRef, useCallback } from 'react';
import { GuardianState, AudioEvent, HomeEventClass, NetworkLogEntry, MicSource } from '../types';
import { useAudioPipeline } from './useAudioPipeline';
import { processFrame } from '../audio/FrameProcessor';
import { loadYAMNet } from '../classifier/YAMNetLoader';
import { classifyFrame } from '../classifier/YAMNetInference';
import { mapToHomeEvent } from '../classifier/HomeEventMapper';
import { createModel, updateModel, exportModel, importModel } from '../routine/MarkovRoutineModel';
import { detectAnomaly, getCurrentKLScore } from '../routine/AnomalyDetector';
import { seedPriorFromTypicalDay } from '../routine/SyntheticPrior';
import { generateAlert } from '../agent/AlertAgent';
import { MAX_RECENT_EVENTS, ANOMALY_CHECK_INTERVAL_MS, CRITICAL_EVENTS } from '../constants';
import * as tf from '@tensorflow/tfjs';

const INITIAL_STATE: GuardianState = {
  status: 'idle',
  isListening: false,
  micSource: 'local',
  recentEvents: [],
  alerts: [],
  routineModel: createModel(),
  modelLoaded: false,
  networkLog: [],
  klScore: 0,
};

type Action =
  | { type: 'SET_STATUS'; payload: GuardianState['status'] }
  | { type: 'SET_LISTENING'; payload: boolean }
  | { type: 'ADD_EVENT'; payload: AudioEvent }
  | { type: 'ADD_ALERT'; payload: any }
  | { type: 'ACKNOWLEDGE_ALERT'; payload: string }
  | { type: 'UPDATE_MODEL'; payload: any }
  | { type: 'SET_MODEL_LOADED'; payload: boolean }
  | { type: 'ADD_NETWORK_LOG'; payload: NetworkLogEntry }
  | { type: 'UPDATE_KL_SCORE'; payload: number }
  | { type: 'SET_MIC_SOURCE'; payload: MicSource }
  | { type: 'RESET_STATE'; payload: any };

function guardianReducer(state: GuardianState, action: Action): GuardianState {
  switch (action.type) {
    case 'SET_STATUS':
      return { ...state, status: action.payload };
    case 'SET_LISTENING':
      return { ...state, isListening: action.payload };
    case 'ADD_EVENT': {
      const updatedEvents = [...state.recentEvents, action.payload].slice(-MAX_RECENT_EVENTS);
      return { ...state, recentEvents: updatedEvents };
    }
    case 'ADD_ALERT': {
      localStorage.setItem('guardian_latest_alert', JSON.stringify(action.payload));
      return { 
        ...state, 
        alerts: [action.payload, ...state.alerts],
        status: 'alert' 
      };
    }
    case 'ACKNOWLEDGE_ALERT': {
      const updatedAlerts = state.alerts.map(a =>
        a.id === action.payload
          ? { ...a, acknowledged: true, acknowledgedAt: Date.now() }
          : a
      );
      const hasUnacknowledged = updatedAlerts.some(a => !a.acknowledged);
      const nextStatus = hasUnacknowledged ? 'alert' : 'monitoring';

      if (!hasUnacknowledged) {
        localStorage.removeItem('guardian_latest_alert');
      } else {
        const firstUnacknowledged = updatedAlerts.find(a => !a.acknowledged);
        localStorage.setItem('guardian_latest_alert', JSON.stringify(firstUnacknowledged));
      }

      return { 
        ...state, 
        alerts: updatedAlerts, 
        status: nextStatus as GuardianState['status']
      };
    }
    case 'UPDATE_MODEL': {
      localStorage.setItem('guardian_routine_model', exportModel(action.payload));
      return { ...state, routineModel: action.payload };
    }
    case 'SET_MODEL_LOADED':
      return { ...state, modelLoaded: action.payload };
    case 'ADD_NETWORK_LOG':
      return { ...state, networkLog: [action.payload, ...state.networkLog].slice(0, 50) };
    case 'UPDATE_KL_SCORE':
      return { ...state, klScore: action.payload };
    case 'SET_MIC_SOURCE':
      return { ...state, micSource: action.payload };
    case 'RESET_STATE':
      return {
        ...state,
        status: 'monitoring',
        recentEvents: [],
        alerts: [],
        routineModel: action.payload,
        klScore: 0,
      };
    default:
      return state;
  }
}

export function useGuardian() {
  const [state, dispatch] = useReducer(guardianReducer, INITIAL_STATE);
  const captureRef = useAudioPipeline();
  const modelRef = useRef<tf.GraphModel | null>(null);
  
  // Refs for tracking async audio frames
  const audioBuffer = useRef<number[]>([]);
  const latestFrameRef = useRef<Float32Array | null>(null);
  const lastEventRef = useRef<AudioEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Connect to local WebSocket for cross-device synchronization
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws-sync`;
    
    let reconnectTimeout: any;

    function connect() {
      console.log('Connecting Monitor dashboard to sync WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'ALERT_ACKNOWLEDGED') {
            console.log('Received remote alert acknowledgement:', msg.payload);
            dispatch({ type: 'ACKNOWLEDGE_ALERT', payload: msg.payload });
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message on Monitor:', e);
        }
      };

      ws.onclose = () => {
        console.log('Monitor dashboard WebSocket disconnected. Retrying in 3s...');
        reconnectTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.warn('Monitor dashboard WebSocket error:', err);
      };
    }

    connect();

    return () => {
      if (wsRef.current) wsRef.current.close();
      clearTimeout(reconnectTimeout);
    };
  }, []);

  // Broadcast new alerts when they appear in local state
  useEffect(() => {
    const activeAlerts = state.alerts.filter(a => !a.acknowledged);
    if (activeAlerts.length > 0) {
      const latestAlert = activeAlerts[0];
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'ALERT_TRIGGERED',
          payload: latestAlert
        }));
      }
    }
  }, [state.alerts]);

  // Load model on mount
  useEffect(() => {
    async function initModel() {
      try {
        const loadedModel = await loadYAMNet();
        modelRef.current = loadedModel;
        dispatch({ type: 'SET_MODEL_LOADED', payload: true });
      } catch (e) {
        console.error('Failed to load YAMNet model:', e);
      }
    }
    initModel();

    // Recover routine model from localStorage
    const savedModel = localStorage.getItem('guardian_routine_model');
    if (savedModel) {
      try {
        const restored = importModel(savedModel);
        dispatch({ type: 'UPDATE_MODEL', payload: restored });
      } catch (e) {
        console.warn('Failed to restore routine model:', e);
      }
    }
  }, []);

  // Helper to add network log entries
  const addNetworkLog = useCallback((entry: NetworkLogEntry) => {
    dispatch({ type: 'ADD_NETWORK_LOG', payload: entry });
  }, []);

  // Set microphone source
  const setMicSource = useCallback((source: MicSource) => {
    dispatch({ type: 'SET_MIC_SOURCE', payload: source });
    captureRef.current.source = source;
  }, [captureRef]);

  // Seed model prior
  const seedPrior = useCallback(() => {
    dispatch({ type: 'SET_STATUS', payload: 'seeding' });
    setTimeout(() => {
      const seeded = seedPriorFromTypicalDay();
      dispatch({ type: 'UPDATE_MODEL', payload: seeded });
      dispatch({ type: 'SET_STATUS', payload: 'idle' });
    }, 1000);
  }, []);

  // Start monitoring
  const startMonitoring = useCallback(async () => {
    try {
      await captureRef.current.start();
      dispatch({ type: 'SET_LISTENING', payload: true });
      dispatch({ type: 'SET_STATUS', payload: 'monitoring' });

      // Connect capture callback to accumulate raw audio
      audioBuffer.current = [];
      latestFrameRef.current = null;
      
      captureRef.current.onFrame((samples) => {
        const arr = Array.from(samples);
        audioBuffer.current.push(...arr);
        
        // Accumulate 975ms frame (15600 samples at 16kHz)
        if (audioBuffer.current.length >= 15600) {
          latestFrameRef.current = new Float32Array(audioBuffer.current.slice(0, 15600));
          audioBuffer.current = audioBuffer.current.slice(15600);
        }
      });
    } catch (e) {
      console.error('Failed to start audio capture:', e);
      alert('Microphone access denied or failed to initialize.');
    }
  }, [captureRef]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    captureRef.current.stop();
    dispatch({ type: 'SET_LISTENING', payload: false });
    dispatch({ type: 'SET_STATUS', payload: 'idle' });
  }, [captureRef]);

  // Acknowledge alert
  const acknowledgeAlert = useCallback((id: string) => {
    dispatch({ type: 'ACKNOWLEDGE_ALERT', payload: id });
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'ALERT_ACKNOWLEDGED',
        payload: id
      }));
    }
  }, []);

  // Inject a single demo event directly
  const injectDemoEvent = useCallback((cls: HomeEventClass) => {
    const now = new Date();
    const timeBin = Math.floor((now.getHours() * 60 + now.getMinutes()) / 30);
    const event: AudioEvent = {
      timestamp: Date.now(),
      eventClass: cls,
      confidence: 0.9,
      timeBin,
      source: state.micSource,
    };
    
    dispatch({ type: 'ADD_EVENT', payload: event });
    
    // Update Markov transition model
    const updatedModel = updateModel(state.routineModel, lastEventRef.current, event);
    dispatch({ type: 'UPDATE_MODEL', payload: updatedModel });
    lastEventRef.current = event;

    // Trigger immediate anomaly check for critical events
    if (CRITICAL_EVENTS.includes(cls)) {
      const apiKey = sessionStorage.getItem('guardian_api_key') || '';
      const anomaly = detectAnomaly(state.routineModel, [...state.recentEvents, event], timeBin);
      if (anomaly) {
        generateAlert(anomaly, apiKey, addNetworkLog).then((alert) => {
          dispatch({ type: 'ADD_ALERT', payload: alert });
        });
      }
    }
  }, [state.routineModel, state.recentEvents, state.micSource, addNetworkLog]);

  // Inject a demo sequence of events across timebins
  const injectDemoSequence = useCallback((sequence: HomeEventClass[], bins: number[]) => {
    let currentModel = { ...state.routineModel };
    const injectedEvents: AudioEvent[] = [];
    let prev: AudioEvent | null = lastEventRef.current;

    sequence.forEach((cls, idx) => {
      const timeBin = bins[idx] !== undefined ? bins[idx] : Math.floor((new Date().getHours() * 60 + new Date().getMinutes()) / 30);
      const event: AudioEvent = {
        timestamp: Date.now() - (sequence.length - idx) * 1000, // staggered backward in time
        eventClass: cls,
        confidence: 0.85,
        timeBin,
        source: state.micSource,
      };
      
      injectedEvents.push(event);
      currentModel = updateModel(currentModel, prev, event);
      prev = event;
    });

    // Batch add events and update model
    injectedEvents.forEach(e => {
      dispatch({ type: 'ADD_EVENT', payload: e });
    });
    dispatch({ type: 'UPDATE_MODEL', payload: currentModel });
    lastEventRef.current = prev;
  }, [state.routineModel, state.micSource]);

  // Reset model back to synthetic prior
  const resetModelToPrior = useCallback(() => {
    const seeded = seedPriorFromTypicalDay();
    dispatch({ type: 'RESET_STATE', payload: seeded });
    lastEventRef.current = null;
  }, []);

  // Main classification loop effect
  useEffect(() => {
    if (state.status !== 'monitoring' && state.status !== 'alert') return;
    if (!state.isListening) return;

    const interval = setInterval(async () => {
      const rawFrame = latestFrameRef.current;
      const now = new Date();
      const timeBin = Math.floor((now.getHours() * 60 + now.getMinutes()) / 30);

      let event: AudioEvent | null = null;

      if (rawFrame) {
        if (modelRef.current) {
          // Run VAD / compute active frame
          const frame = processFrame(rawFrame);
          latestFrameRef.current = null; // consume frame

          if (frame) {
            // Frame is active, run YAMNet
            try {
              const result = await classifyFrame(modelRef.current!, frame);
              event = mapToHomeEvent(result.classIndex, result.confidence, state.micSource);
            } catch (e) {
              console.error('Inference error:', e);
            }
          }
        } else {
          // Model not loaded (e.g. offline/CORS) - consume frame and fall back to silence
          latestFrameRef.current = null;
        }
      }

      // If silent or energy is low, classify as silence
      if (!event) {
        event = {
          timestamp: Date.now(),
          eventClass: 'afternoon_nap_silence',
          confidence: 1.0,
          timeBin,
          source: state.micSource,
        };
      }

      // Dispatch event and update transition model
      const finalEvent = event as AudioEvent;
      dispatch({ type: 'ADD_EVENT', payload: finalEvent });
      
      const nextModel = updateModel(state.routineModel, lastEventRef.current, finalEvent);
      dispatch({ type: 'UPDATE_MODEL', payload: nextModel });
      lastEventRef.current = finalEvent;

      // Update KL score
      const kl = getCurrentKLScore(nextModel, [...state.recentEvents, finalEvent], timeBin);
      dispatch({ type: 'UPDATE_KL_SCORE', payload: kl });

    }, 1000);

    return () => clearInterval(interval);
  }, [state.isListening, state.status, state.routineModel, state.recentEvents, state.micSource]);

  // Periodic anomaly detection loop
  useEffect(() => {
    if (state.status !== 'monitoring') return;

    const interval = setInterval(async () => {
      const now = new Date();
      const timeBin = Math.floor((now.getHours() * 60 + now.getMinutes()) / 30);
      
      const anomaly = detectAnomaly(state.routineModel, state.recentEvents, timeBin);
      if (anomaly) {
        const apiKey = sessionStorage.getItem('guardian_api_key') || '';
        const alert = await generateAlert(anomaly, apiKey, addNetworkLog);
        dispatch({ type: 'ADD_ALERT', payload: alert });
      }
    }, ANOMALY_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [state.status, state.routineModel, state.recentEvents, addNetworkLog]);

  return {
    state,
    startMonitoring,
    stopMonitoring,
    acknowledgeAlert,
    injectDemoEvent,
    injectDemoSequence,
    seedPrior,
    setMicSource,
    resetModelToPrior,
    getAnalyser: () => captureRef.current.getAnalyser(),
  };
}
