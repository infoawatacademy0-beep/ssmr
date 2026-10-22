import type { VoiceEffectMode } from '../types';

/* ─────────────────────────────────────────────────────────────
   VIP & Studio Real-Time Web Audio Voice Processor
   1. Studio Vocal Noise-Reduction & Clarity Pre-Chain (All Modes):
      • 90 Hz High-Pass filter removes room rumble, wind & mic thumps
      • 11.5 kHz Low-Pass filter removes high-frequency static hiss
      • 2.8 kHz Vocal Presence boost ensures crystal-clear speech
      • Broadcast DynamicsCompressor prevents clipping & loud clatter
   2. Voice Modes:
      • 'normal' — Studio Noise-Free HD Voice
      • 'child'  — High-pitched cheerful kid voice (+6.8 semitones)
      • 'venom'  — Deep symbiote monster voice (-6.5 & -11 semitones)
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

  public start(inputTrack: MediaStreamTrack, initialMode: VoiceEffectMode = 'normal'): MediaStreamTrack {
    if (this.rawTrack === inputTrack && this.ctx && this.destinationNode) {
      if (this.currentMode !== initialMode) {
        this.setMode(initialMode);
      }
      return this.destinationNode.stream.getAudioTracks()[0] || inputTrack;
    }

    this.stop();
    this.rawTrack = inputTrack;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx({ latencyHint: 'interactive' });

    const inputStream = new MediaStream([inputTrack]);
    this.sourceNode = this.ctx.createMediaStreamSource(inputStream);
    this.destinationNode = this.ctx.createMediaStreamDestination();

    this.monitorGainNode = this.ctx.createGain();
    this.monitorGainNode.gain.value = 0;
    this.monitorGainNode.connect(this.ctx.destination);

    this.setMode(initialMode);

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.destinationNode.stream.getAudioTracks()[0] || inputTrack;
  }

  public setSelfMonitor(enabled: boolean): void {
    if (this.monitorGainNode && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      this.monitorGainNode.gain.setTargetAtTime(enabled ? 0.85 : 0, this.ctx.currentTime, 0.03);
    }
  }

  /**
   * Builds the studio noise-suppression & anti-clatter vocal conditioner.
   */
  private buildStudioCleanChain(ctx: AudioContext, rawInput: AudioNode): AudioNode {
    // 1. Cut low-end rumble, mic bumps, and wind noise (< 95 Hz)
    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'highpass';
    rumbleFilter.frequency.value = 95;
    rumbleFilter.Q.value = 0.707;

    // 2. Cut 50/60Hz electrical hum
    const humNotch = ctx.createBiquadFilter();
    humNotch.type = 'notch';
    humNotch.frequency.value = 55;
    humNotch.Q.value = 4.0;

    // 3. Cut harsh ultrasonic static & background hiss (> 11,500 Hz)
    const deHissFilter = ctx.createBiquadFilter();
    deHissFilter.type = 'lowpass';
    deHissFilter.frequency.value = 11500;
    deHissFilter.Q.value = 0.707;

    // 4. Boost vocal clarity band (2.8 kHz)
    const clarityBoost = ctx.createBiquadFilter();
    clarityBoost.type = 'peaking';
    clarityBoost.frequency.value = 2800;
    clarityBoost.Q.value = 1.1;
    clarityBoost.gain.value = 2.5;

    // 5. Broadcast Dynamics Compressor to eliminate sudden loud clatter/peaks
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 18;
    compressor.ratio.value = 4.5;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.16;

    rawInput.connect(rumbleFilter);
    rumbleFilter.connect(humNotch);
    humNotch.connect(deHissFilter);
    deHissFilter.connect(clarityBoost);
    clarityBoost.connect(compressor);

    this.activeNodes.push(rumbleFilter, humNotch, deHissFilter, clarityBoost, compressor);
    return compressor;
  }

  public setMode(mode: VoiceEffectMode): void {
    this.currentMode = mode;
    if (!this.ctx || !this.sourceNode || !this.destinationNode || !this.monitorGainNode) {
      return;
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    this.cleanupGraph();

    const ctx = this.ctx;
    const cleanInput = this.buildStudioCleanChain(ctx, this.sourceNode);
    const output = this.destinationNode;
    const monitor = this.monitorGainNode;

    // Final limiter / output gain
    const masterOut = ctx.createGain();
    masterOut.gain.value = 1.05;
    masterOut.connect(output);
    masterOut.connect(monitor);
    this.activeNodes.push(masterOut);

    if (mode === 'normal') {
      cleanInput.connect(masterOut);
      return;
    }

    if (mode === 'child') {
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
      presenceShelf.gain.value = 3.0;

      const pitchOut = this.createPitchShifterNode(ctx, cleanInput, 1.48, 0.055);

      pitchOut.connect(highpass);
      highpass.connect(formantBoost);
      formantBoost.connect(presenceShelf);

      const childGain = ctx.createGain();
      childGain.gain.value = 1.3;
      presenceShelf.connect(childGain);
      childGain.connect(masterOut);

      this.activeNodes.push(highpass, formantBoost, presenceShelf, childGain);
      return;
    }

    if (mode === 'venom') {
      const mainDeepPitch = this.createPitchShifterNode(ctx, cleanInput, 0.68, 0.065);
      const subMonsterPitch = this.createPitchShifterNode(ctx, cleanInput, 0.54, 0.075);

      const growlOsc = ctx.createOscillator();
      growlOsc.type = 'sine';
      growlOsc.frequency.value = 34;

      const growlModGain = ctx.createGain();
      growlModGain.gain.value = 0.32;

      const ringModNode = ctx.createGain();
      ringModNode.gain.value = 0.68;
      growlOsc.connect(growlModGain);
      growlModGain.connect(ringModNode.gain);
      growlOsc.start();
      this.activeSources.push(growlOsc);

      mainDeepPitch.connect(ringModNode);

      const preDistortionMix = ctx.createGain();
      preDistortionMix.gain.value = 1.0;

      const subGain = ctx.createGain();
      subGain.gain.value = 0.6;
      subMonsterPitch.connect(subGain);

      ringModNode.connect(preDistortionMix);
      subGain.connect(preDistortionMix);

      const shaper = ctx.createWaveShaper();
      shaper.curve = this.makeDistortionCurve(15);
      shaper.oversample = '2x';

      const bassBoost = ctx.createBiquadFilter();
      bassBoost.type = 'lowshelf';
      bassBoost.frequency.value = 150;
      bassBoost.gain.value = 7.0;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 3400;
      lowpass.Q.value = 0.85;

      const slapDelay = ctx.createDelay(0.2);
      slapDelay.delayTime.value = 0.04;
      const slapFeedback = ctx.createGain();
      slapFeedback.gain.value = 0.24;
      const slapWet = ctx.createGain();
      slapWet.gain.value = 0.28;

      preDistortionMix.connect(shaper);
      shaper.connect(bassBoost);
      bassBoost.connect(lowpass);

      const venomMaster = ctx.createGain();
      venomMaster.gain.value = 1.4;

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

  private createPitchShifterNode(
    ctx: AudioContext,
    input: AudioNode,
    pitchRatio: number,
    grainDurationSec: number = 0.06,
  ): GainNode {
    const sampleRate = ctx.sampleRate;
    const grainSamples = Math.floor(grainDurationSec * sampleRate);

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

      if (pitchRatio >= 1) {
        delayAData[i] = minDelaySec + (1 - phaseA) * maxSweepSec;
        delayBData[i] = minDelaySec + (1 - phaseB) * maxSweepSec;
      } else {
        delayAData[i] = minDelaySec + phaseA * maxSweepSec;
        delayBData[i] = minDelaySec + phaseB * maxSweepSec;
      }

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

    splitter.connect(delayA.delayTime, 0);
    splitter.connect(delayB.delayTime, 1);
    splitter.connect(grainGainA.gain, 2);
    splitter.connect(grainGainB.gain, 3);

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
