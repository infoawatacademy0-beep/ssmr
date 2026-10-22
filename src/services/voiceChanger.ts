import type { VoiceEffectMode } from '../types';

/* ─────────────────────────────────────────────────────────────
   VIP Real-Time Web Audio Voice Changer Engine
   Provides zero-dependency, sample-accurate Hann-windowed
   pitch shifting and vocal formant synthesis for:
   • 'normal' — Clean studio pass-through
   • 'child'  — High-pitched cheerful kid voice (+6.8 semitones + formant shift)
   • 'venom'  — Dual-layered deep symbiote monster voice (-6.5 & -11 semitones,
                guttural growl modulation, sub-bass boost & dark symbiote slapback)
   ───────────────────────────────────────────────────────────── */

export class VoiceChangerProcessor {
  private ctx: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private monitorGainNode: GainNode | null = null;
  private activeNodes: AudioNode[] = [];
  private activeSources: AudioScheduledSourceNode[] = [];
  private currentMode: VoiceEffectMode = 'normal';
  private rawTrack: MediaStreamTrack | null = null;

  /**
   * Initializes the Web Audio processing pipeline for a given microphone MediaStreamTrack
   * and returns the processed output MediaStreamTrack.
   */
  public start(inputTrack: MediaStreamTrack, initialMode: VoiceEffectMode = 'normal'): MediaStreamTrack {
    if (this.rawTrack === inputTrack && this.ctx && this.destinationNode) {
      this.setMode(initialMode);
      return this.destinationNode.stream.getAudioTracks()[0] || inputTrack;
    }

    this.stop();
    this.rawTrack = inputTrack;

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx();

    const inputStream = new MediaStream([inputTrack]);
    this.sourceNode = this.ctx.createMediaStreamSource(inputStream);
    this.destinationNode = this.ctx.createMediaStreamDestination();

    // Optional self-monitoring node (muted by default so user doesn't get feedback unless testing)
    this.monitorGainNode = this.ctx.createGain();
    this.monitorGainNode.gain.value = 0;
    this.monitorGainNode.connect(this.ctx.destination);

    this.setMode(initialMode);

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.destinationNode.stream.getAudioTracks()[0] || inputTrack;
  }

  /**
   * Toggle local self-monitoring so the VIP user can test their own Child / Venom voice.
   */
  public setSelfMonitor(enabled: boolean): void {
    if (this.monitorGainNode && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      this.monitorGainNode.gain.setTargetAtTime(enabled ? 0.85 : 0, this.ctx.currentTime, 0.03);
    }
  }

  /**
   * Switches the active real-time voice effect without interrupting the output MediaStreamTrack.
   */
  public setMode(mode: VoiceEffectMode): void {
    this.currentMode = mode;
    if (!this.ctx || !this.sourceNode || !this.destinationNode || !this.monitorGainNode) {
      return;
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    // Disconnect and clean up previous effect graph
    this.cleanupGraph();

    const ctx = this.ctx;
    const input = this.sourceNode;
    const output = this.destinationNode;
    const monitor = this.monitorGainNode;

    const masterOut = ctx.createGain();
    masterOut.gain.value = 1.0;
    masterOut.connect(output);
    masterOut.connect(monitor);
    this.activeNodes.push(masterOut);

    if (mode === 'normal') {
      input.connect(masterOut);
      return;
    }

    if (mode === 'child') {
      // ── CHILD / BABY VOICE (+6.8 semitones pitch shift + bright vocal formants) ──
      const highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 210;

      const formantBoost = ctx.createBiquadFilter();
      formantBoost.type = 'peaking';
      formantBoost.frequency.value = 2200;
      formantBoost.Q.value = 1.2;
      formantBoost.gain.value = 5.5;

      const presenceShelf = ctx.createBiquadFilter();
      presenceShelf.type = 'highshelf';
      presenceShelf.frequency.value = 3400;
      presenceShelf.gain.value = 3.5;

      const pitchOut = this.createPitchShifterNode(ctx, input, 1.48, 0.055);

      pitchOut.connect(highpass);
      highpass.connect(formantBoost);
      formantBoost.connect(presenceShelf);

      const childGain = ctx.createGain();
      childGain.gain.value = 1.35;
      presenceShelf.connect(childGain);
      childGain.connect(masterOut);

      this.activeNodes.push(highpass, formantBoost, presenceShelf, childGain);
      return;
    }

    if (mode === 'venom') {
      // ── VENOM SYMBIOTE MONSTER VOICE ──
      // Dual-layered deep pitch shift (-6.5 semitones main + -10.5 semitones sub-growl)
      // + guttural ring modulation + symbiote distortion + dark cave resonance
      const mainDeepPitch = this.createPitchShifterNode(ctx, input, 0.68, 0.065);
      const subMonsterPitch = this.createPitchShifterNode(ctx, input, 0.54, 0.075);

      // Guttural growl ring modulator (34 Hz) on a parallel texture branch
      const growlOsc = ctx.createOscillator();
      growlOsc.type = 'sine';
      growlOsc.frequency.value = 34;

      const growlModGain = ctx.createGain();
      growlModGain.gain.value = 0.35;

      const ringModNode = ctx.createGain();
      ringModNode.gain.value = 0.65;
      growlOsc.connect(growlModGain);
      growlModGain.connect(ringModNode.gain);
      growlOsc.start();
      this.activeSources.push(growlOsc);

      mainDeepPitch.connect(ringModNode);

      // Mix main deep layer + sub-octave monster layer
      const preDistortionMix = ctx.createGain();
      preDistortionMix.gain.value = 1.0;

      const subGain = ctx.createGain();
      subGain.gain.value = 0.65;
      subMonsterPitch.connect(subGain);

      ringModNode.connect(preDistortionMix);
      subGain.connect(preDistortionMix);

      // Subtle symbiote saturation (WaveShaper)
      const shaper = ctx.createWaveShaper();
      shaper.curve = this.makeDistortionCurve(18);
      shaper.oversample = '2x';

      // Chest / Sub-bass resonance boost (110 Hz)
      const bassBoost = ctx.createBiquadFilter();
      bassBoost.type = 'lowshelf';
      bassBoost.frequency.value = 150;
      bassBoost.gain.value = 7.5;

      // Darken harsh highs while keeping consonant articulation
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 3200;
      lowpass.Q.value = 0.9;

      // Symbiote dark chamber slapback echo (42 ms)
      const slapDelay = ctx.createDelay(0.2);
      slapDelay.delayTime.value = 0.042;
      const slapFeedback = ctx.createGain();
      slapFeedback.gain.value = 0.26;
      const slapWet = ctx.createGain();
      slapWet.gain.value = 0.32;

      preDistortionMix.connect(shaper);
      shaper.connect(bassBoost);
      bassBoost.connect(lowpass);

      // Dry + Chamber Wet to master
      const venomMaster = ctx.createGain();
      venomMaster.gain.value = 1.45;

      lowpass.connect(venomMaster);
      lowpass.connect(slapDelay);
      slapDelay.connect(slapFeedback);
      slapFeedback.connect(slapDelay);
      slapDelay.connect(slapWet);
      slapWet.connect(venomMaster);

      venomMaster.connect(masterOut);

      this.activeNodes.push(
        growlModGain,
        ringModNode,
        preDistortionMix,
        subGain,
        shaper,
        bassBoost,
        lowpass,
        slapDelay,
        slapFeedback,
        slapWet,
        venomMaster,
      );
    }
  }

  /**
   * Builds a click-free dual-grain Hann-windowed pitch shifter using looping AudioBuffers
   * so the two grains remain 100% phase-locked indefinitely.
   */
  private createPitchShifterNode(
    ctx: AudioContext,
    input: AudioNode,
    pitchRatio: number,
    grainDurationSec: number = 0.06,
  ): GainNode {
    const sampleRate = ctx.sampleRate;
    const grainSamples = Math.floor(grainDurationSec * sampleRate);

    // 4-channel control buffer:
    // ch0: delayA curve, ch1: delayB curve (offset by 50%)
    // ch2: gainA Hann window, ch3: gainB Hann window (offset by 50%)
    const controlBuffer = ctx.createBuffer(4, grainSamples, sampleRate);
    const delayAData = controlBuffer.getChannelData(0);
    const delayBData = controlBuffer.getChannelData(1);
    const gainAData = controlBuffer.getChannelData(2);
    const gainBData = controlBuffer.getChannelData(3);

    const slope = Math.abs(1 - pitchRatio);
    const maxSweepSec = Math.min(0.045, Math.max(0.008, slope * grainDurationSec));
    const minDelaySec = 0.002;

    for (let i = 0; i < grainSamples; i++) {
      const phaseA = i / grainSamples;
      const phaseB = (phaseA + 0.5) % 1.0;

      // Pitch up (ratio > 1): delay ramps DOWN; Pitch down (ratio < 1): delay ramps UP
      if (pitchRatio >= 1) {
        delayAData[i] = minDelaySec + (1 - phaseA) * maxSweepSec;
        delayBData[i] = minDelaySec + (1 - phaseB) * maxSweepSec;
      } else {
        delayAData[i] = minDelaySec + phaseA * maxSweepSec;
        delayBData[i] = minDelaySec + phaseB * maxSweepSec;
      }

      // Smooth sin^2 Hann window envelope (gainA + gainB === 1.0 everywhere)
      const winA = Math.sin(Math.PI * phaseA);
      const winB = Math.sin(Math.PI * phaseB);
      gainAData[i] = winA * winA;
      gainBData[i] = winB * winB;
    }

    const controlSource = ctx.createBufferSource();
    controlSource.buffer = controlBuffer;
    controlSource.loop = true;

    const splitter = ctx.createChannelSplitter(4);
    controlSource.connect(splitter);

    const delayA = ctx.createDelay(0.2);
    const delayB = ctx.createDelay(0.2);
    delayA.delayTime.value = 0;
    delayB.delayTime.value = 0;

    const grainGainA = ctx.createGain();
    const grainGainB = ctx.createGain();
    grainGainA.gain.value = 0;
    grainGainB.gain.value = 0;

    // Connect control signals to AudioParams
    splitter.connect(delayA.delayTime, 0);
    splitter.connect(delayB.delayTime, 1);
    splitter.connect(grainGainA.gain, 2);
    splitter.connect(grainGainB.gain, 3);

    // Connect audio signal through both grains
    const outputMix = ctx.createGain();
    outputMix.gain.value = 1.0;

    input.connect(delayA);
    input.connect(delayB);
    delayA.connect(grainGainA);
    delayB.connect(grainGainB);
    grainGainA.connect(outputMix);
    grainGainB.connect(outputMix);

    controlSource.start();

    this.activeSources.push(controlSource);
    this.activeNodes.push(splitter, delayA, delayB, grainGainA, grainGainB, outputMix);

    return outputMix;
  }

  private makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
    const k = amount;
    const nSamples = 44100;
    const buffer = new ArrayBuffer(nSamples * 4);
    const curve = new Float32Array(buffer);
    const deg = Math.PI / 180;
    for (let i = 0; i < nSamples; ++i) {
      const x = (i * 2) / nSamples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  private cleanupGraph(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        // Ignore
      }
    }
    for (const src of this.activeSources) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // Ignore
      }
    }
    this.activeSources = [];

    for (const node of this.activeNodes) {
      try {
        node.disconnect();
      } catch {
        // Ignore
      }
    }
    this.activeNodes = [];
  }

  public getMode(): VoiceEffectMode {
    return this.currentMode;
  }

  public stop(): void {
    this.cleanupGraph();
    if (this.monitorGainNode) {
      try {
        this.monitorGainNode.disconnect();
      } catch {
        // Ignore
      }
      this.monitorGainNode = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.sourceNode = null;
    this.destinationNode = null;
    this.rawTrack = null;
  }
}
