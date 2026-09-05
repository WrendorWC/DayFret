import Soundfont, { Player } from "soundfont-player";
import { getAudioContext, resumeAudio } from "./audioContext";
import type { SoundfontStatus } from "../types";
import type { RegisterMode } from "../types";

const NOTE_NAMES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
type GuitarInstrumentName = "acoustic_guitar_nylon" | "electric_guitar_clean";

export class Metronome {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume = 0.75;
  private noiseBuffer: AudioBuffer | null = null;
  private guitarPlayers: Partial<Record<RegisterMode, Player>> = {};
  private registerMode: RegisterMode = "acoustic";
  private soundfontLoadPromise: Promise<void> | null = null;
  private activeSoundfontVoice: { stop: (when?: number) => void } | null = null;
  private soundfontAvailable: Record<RegisterMode, boolean> = {
    acoustic: true,
    electric: true,
  };
  private soundfontStatus: SoundfontStatus = "idle";
  private soundfontStatusListeners = new Set<(status: SoundfontStatus) => void>();

  private setSoundfontStatus(status: SoundfontStatus): void {
    if (this.soundfontStatus === status) return;
    this.soundfontStatus = status;
    this.soundfontStatusListeners.forEach((listener) => listener(status));
  }

  getSoundfontStatus(): SoundfontStatus {
    return this.soundfontStatus;
  }

  onSoundfontStatusChange(listener: (status: SoundfontStatus) => void): () => void {
    this.soundfontStatusListeners.add(listener);
    return () => {
      this.soundfontStatusListeners.delete(listener);
    };
  }

  setRegisterMode(mode: RegisterMode): void {
    this.registerMode = mode;
    if (this.guitarPlayers[mode]) {
      this.setSoundfontStatus("ready");
      return;
    }
    if (!this.soundfontAvailable[mode]) {
      this.setSoundfontStatus("failed");
      return;
    }
    this.setSoundfontStatus("idle");
  }

  private soundfontNameForMode(mode: RegisterMode): GuitarInstrumentName {
    return mode === "electric" ? "electric_guitar_clean" : "acoustic_guitar_nylon";
  }

  private ensureContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = getAudioContext();
    }
    return this.audioContext;
  }

  private getMasterGain(ctx: AudioContext): GainNode {
    if (!this.masterGain) {
      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(ctx.destination);
    }
    return this.masterGain;
  }

  setVolume(level: number): void {
    this.volume = level;
    if (this.masterGain) {
      this.masterGain.gain.value = level;
    }
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;

    const length = Math.floor(ctx.sampleRate * 0.08);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }

    this.noiseBuffer = buffer;
    return buffer;
  }

  private async ensureGuitarSoundfont(): Promise<void> {
    const mode = this.registerMode;

    if (!this.soundfontAvailable[mode]) {
      this.setSoundfontStatus("failed");
      return;
    }
    if (this.guitarPlayers[mode]) {
      this.setSoundfontStatus("ready");
      return;
    }
    if (this.soundfontLoadPromise) {
      await this.soundfontLoadPromise;
      return;
    }

    const ctx = this.ensureContext();
    this.setSoundfontStatus("loading");
    this.soundfontLoadPromise = Soundfont
      .instrument(ctx, this.soundfontNameForMode(mode), {
        soundfont: "MusyngKite",
        format: "mp3",
      })
      .then((player) => {
        this.guitarPlayers[mode] = player;
        this.setSoundfontStatus("ready");
      })
      .catch(() => {
        // Keep fallback synth active if remote soundfont cannot load.
        this.soundfontAvailable[mode] = false;
        this.setSoundfontStatus("failed");
      })
      .finally(() => {
        this.soundfontLoadPromise = null;
      });

    await this.soundfontLoadPromise;
  }

  async resume(): Promise<void> {
    this.ensureContext();
    await resumeAudio();
    void this.ensureGuitarSoundfont();
  }

  primeSoundfont(): void {
    void this.ensureGuitarSoundfont();
  }

  click(accent = false): void {
    // Scheduling a hair ahead rather than exactly at currentTime: starting a
    // node at "now" can clip its own attack, and some browsers drop it.
    this.clickAt(this.ensureContext().currentTime + 0.005, accent);
  }

  // Schedules a click at an exact time on the audio clock. Timer callbacks
  // jitter by tens of milliseconds; the audio clock does not, so the beat grid
  // is built from these times rather than from when the timer happens to fire.
  clickAt(when: number, accent = false): void {
    const ctx = this.ensureContext();
    const now = when;
    const master = this.getMasterGain(ctx);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(accent ? 1320 : 980, now);

    // Loud enough to sit alongside the guitar, which peaks around 0.35.
    const peak = accent ? 0.5 : 0.36;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.07);

    // A tiny filtered noise transient gives the tick an edge so it cuts
    // through a sustaining guitar instead of blending into it.
    const click = ctx.createBufferSource();
    click.buffer = this.getNoiseBuffer(ctx);
    const clickFilter = ctx.createBiquadFilter();
    clickFilter.type = "bandpass";
    clickFilter.frequency.value = accent ? 3600 : 2600;
    clickFilter.Q.value = 1.2;
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.0001, now);
    clickGain.gain.exponentialRampToValueAtTime(accent ? 0.34 : 0.24, now + 0.002);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

    click.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(master);
    click.start(now);
    click.stop(now + 0.04);
  }

  playMidiNote(midi: number, durationSeconds = 0.2): void {
    const soundfontPlayed = this.playSoundfontNote(midi, durationSeconds);
    if (soundfontPlayed) return;
    void this.ensureGuitarSoundfont();
    this.playSynthNote(midi, durationSeconds);
  }

  private playSoundfontNote(midi: number, durationSeconds: number): boolean {
    const player = this.guitarPlayers[this.registerMode];
    if (!player) return false;
    this.setSoundfontStatus("ready");
    const ctx = this.ensureContext();
    const noteName = this.noteNameForMidi(midi);
    if (this.activeSoundfontVoice) {
      this.activeSoundfontVoice.stop(ctx.currentTime);
      this.activeSoundfontVoice = null;
    }
    const voice = player.play(noteName, ctx.currentTime, {
      duration: durationSeconds,
      gain: 0.95,
    });
    if (voice && typeof (voice as { stop?: unknown }).stop === "function") {
      this.activeSoundfontVoice = voice as { stop: (when?: number) => void };
    }
    return true;
  }

  private noteNameForMidi(midi: number): string {
    const note = NOTE_NAMES_SHARP[((midi % 12) + 12) % 12];
    const octave = Math.floor(midi / 12) - 1;
    return `${note}${octave}`;
  }

  private playSynthNote(midi: number, durationSeconds: number): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const frequency = 440 * Math.pow(2, (midi - 69) / 12);

    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(0.0001, now);
    mainGain.gain.exponentialRampToValueAtTime(0.2, now + 0.003);
    mainGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);

    const toneLowPass = ctx.createBiquadFilter();
    toneLowPass.type = "lowpass";
    toneLowPass.frequency.setValueAtTime(4200, now);
    toneLowPass.frequency.exponentialRampToValueAtTime(1400, now + durationSeconds * 0.9);
    toneLowPass.Q.setValueAtTime(0.9, now);

    const bodyHighPass = ctx.createBiquadFilter();
    bodyHighPass.type = "highpass";
    bodyHighPass.frequency.setValueAtTime(85, now);
    bodyHighPass.Q.setValueAtTime(0.6, now);

    const oscFundamental = ctx.createOscillator();
    const oscFundamentalGain = ctx.createGain();
    oscFundamental.type = "triangle";
    oscFundamental.frequency.setValueAtTime(frequency, now);
    oscFundamental.detune.setValueAtTime((Math.random() - 0.5) * 6, now);
    oscFundamentalGain.gain.setValueAtTime(0.95, now);

    const oscHarmonic = ctx.createOscillator();
    const oscHarmonicGain = ctx.createGain();
    oscHarmonic.type = "sawtooth";
    oscHarmonic.frequency.setValueAtTime(frequency * 2, now);
    oscHarmonic.detune.setValueAtTime((Math.random() - 0.5) * 12, now);
    oscHarmonicGain.gain.setValueAtTime(0.14, now);

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = this.getNoiseBuffer(ctx);
    const noiseBandPass = ctx.createBiquadFilter();
    noiseBandPass.type = "bandpass";
    noiseBandPass.frequency.setValueAtTime(2300, now);
    noiseBandPass.Q.setValueAtTime(0.8, now);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.16, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

    oscFundamental.connect(oscFundamentalGain);
    oscFundamentalGain.connect(toneLowPass);

    oscHarmonic.connect(oscHarmonicGain);
    oscHarmonicGain.connect(toneLowPass);

    noiseSource.connect(noiseBandPass);
    noiseBandPass.connect(noiseGain);
    noiseGain.connect(toneLowPass);

    toneLowPass.connect(bodyHighPass);
    bodyHighPass.connect(mainGain);
    mainGain.connect(ctx.destination);

    oscFundamental.start(now);
    oscFundamental.stop(now + durationSeconds + 0.04);

    oscHarmonic.start(now);
    oscHarmonic.stop(now + durationSeconds + 0.04);

    noiseSource.start(now);
    noiseSource.stop(now + 0.03);
  }
}
