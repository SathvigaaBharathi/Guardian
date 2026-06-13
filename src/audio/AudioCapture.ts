import { MicSource } from '../types';

export class AudioCapture {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private frameCallback: ((frame: Float32Array) => void) | null = null;
  private analyser: AnalyserNode | null = null;
  public source: MicSource = 'local';

  async start(): Promise<void> {
    // Request mic — works for both local mic and phone mic via browser
    // iOS Safari requires this call to happen inside a user gesture (button click)
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,  // disable — we want raw ambient audio
        noiseSuppression: false,  // disable — falls/distress need raw signal
        autoGainControl: false,   // disable — we control gain via VAD
        sampleRate: 16000,
      }
    });

    this.context = new AudioContext({ sampleRate: 16000 });

    const source = this.context.createMediaStreamSource(this.stream);
    
    // Add Analyser for visualizer
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);

    this.processor = this.context.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = async (e) => {
      const raw = e.inputBuffer.getChannelData(0);
      const frame = await this.resampleIfNeeded(raw);
      if (this.frameCallback) this.frameCallback(frame);
    };

    // Chain analyser to processor
    this.analyser.connect(this.processor);
    this.processor.connect(this.context.destination);
  }

  private async resampleIfNeeded(raw: Float32Array): Promise<Float32Array> {
    if (!this.context) return raw;
    if (this.context.sampleRate === 16000) return raw;

    // Resample to 16kHz using OfflineAudioContext
    const offlineCtx = new OfflineAudioContext(
      1,
      Math.ceil(raw.length * 16000 / this.context.sampleRate),
      16000
    );
    const buffer = offlineCtx.createBuffer(1, raw.length, this.context.sampleRate);
    buffer.copyToChannel(raw as any, 0);
    const src = offlineCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(offlineCtx.destination);
    src.start();
    const rendered = await offlineCtx.startRendering();
    return rendered.getChannelData(0);
  }

  stop(): void {
    this.processor?.disconnect();
    this.analyser?.disconnect();
    this.stream?.getTracks().forEach(t => t.stop());
    this.context?.close();
    this.processor = null;
    this.analyser = null;
    this.stream = null;
    this.context = null;
  }

  onFrame(cb: (frame: Float32Array) => void): void {
    this.frameCallback = cb;
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  // Returns the local network URL for phone access — shown in SetupPanel
  static getNetworkHint(): string {
    return `Open this app on your phone: replace "localhost" with your computer's
local IP address (shown in terminal when you ran "npm run dev").
Both devices must be on the same WiFi network.`;
  }
}
