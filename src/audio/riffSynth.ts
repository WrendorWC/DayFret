import { Riff, RiffEvent, TICKS_PER_QUARTER } from "../music/riffs";
import { getAudioContext, resumeAudio } from "./audioContext";

// A plucked-string synth built on Karplus-Strong physical modelling: a short
// burst of filtered noise is fed into a delay line the length of one period,
// and each pass through a damping filter takes the high harmonics off first —
// which is what a real string does. No samples, so the offline standalone file
// still works with nothing to download.

const midiToHz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

// Overdrive settings, solved together by rendering both chains offline and
// matching RMS so the two tones sit at the same level (soft clipping otherwise
// runs more than 12 dB hotter).
//
// The first attempt at that matching went too far the other way: it distorted
// on paper but sounded clean, because a 3.6 kHz lowpass after the shaper threw
// away the very harmonics that make an overdrive audible. The post filter now
// opens to 5.6 kHz, there is a mid lift ahead of the clipper the way an amp
// has one, and the curve is asymmetric — that asymmetry adds even harmonics,
// which is the difference between "warm" and "fuzzy".
const DRIVE_PRE_GAIN = 6.0;
const DRIVE_AMOUNT = 4.0;
const DRIVE_BIAS = 0.25; // asymmetry, for even harmonics
const DRIVE_MID_HZ = 800;
const DRIVE_MID_DB = 1;
const DRIVE_PRESENCE_HZ = 3000; // after the clipper, where the bite lives
const DRIVE_PRESENCE_DB = 8;
const DRIVE_POST_HZ = 8000;
const DRIVE_MAKEUP = 0.0617;

export type RiffTone = "clean" | "driven";

// A note to sound. The string matters as much as the pitch: the same D sounds
// quite different played on a wound low string versus a plain high one, and
// that difference is most of what separates one chord voicing from another.
export type PlayNote = { midi: number; stringIndex?: number };

// Excitation and damping per string. Wound strings start darker and ring
// longer; plain strings are brighter and decay faster.
const STRING_CHARACTER = [
  { brightness: 0.28, damping: 0.9978, gain: 1.12 }, // low E
  { brightness: 0.32, damping: 0.9975, gain: 1.08 }, // A
  { brightness: 0.38, damping: 0.9971, gain: 1.03 }, // D
  { brightness: 0.46, damping: 0.9965, gain: 1.0 }, // G
  { brightness: 0.55, damping: 0.9958, gain: 0.96 }, // B
  { brightness: 0.62, damping: 0.9952, gain: 0.93 }, // high E
];

// Used when the caller does not say which string, so pitch alone decides.
function characterForPitch(freq: number) {
  if (freq < 150) return STRING_CHARACTER[0];
  if (freq < 220) return STRING_CHARACTER[1];
  if (freq < 300) return STRING_CHARACTER[2];
  if (freq < 400) return STRING_CHARACTER[3];
  if (freq < 550) return STRING_CHARACTER[4];
  return STRING_CHARACTER[5];
}

// One rendered pluck, cached by delay-line length so pitches that share a
// period length reuse the same buffer.
function renderPluck(
  ctx: AudioContext,
  periodSamples: number,
  seconds: number,
  brightness: number,
  damping: number,
): AudioBuffer {
  const rate = ctx.sampleRate;
  const total = Math.ceil(rate * seconds);
  const buffer = ctx.createBuffer(1, total, rate);
  const out = buffer.getChannelData(0);

  const n = Math.max(2, Math.round(periodSamples));
  const line = new Float32Array(n);

  // Excitation: noise through a one-pole lowpass. A darker burst reads as a
  // fleshy fingertip, a brighter one as a hard pick.
  let lp = 0;
  for (let i = 0; i < n; i += 1) {
    const white = Math.random() * 2 - 1;
    lp += brightness * (white - lp);
    line[i] = lp;
  }
  // Strip DC so the note does not thump
  let mean = 0;
  for (let i = 0; i < n; i += 1) mean += line[i];
  mean /= n;
  for (let i = 0; i < n; i += 1) line[i] -= mean;

  // Gently taper the burst so the attack is a pluck, not a click
  const fade = Math.max(2, Math.floor(n * 0.06));
  for (let i = 0; i < fade; i += 1) line[i] *= i / fade;

  let idx = 0;
  for (let i = 0; i < total; i += 1) {
    const cur = line[idx];
    out[i] = cur;
    // Average with the next sample: the low-pass in the feedback loop is what
    // makes the tone darken as it decays.
    const next = idx + 1 === n ? line[0] : line[idx + 1];
    line[idx] = (cur + next) * 0.5 * damping;
    idx = idx + 1 === n ? 0 : idx + 1;
  }

  // Normalise so every pitch arrives at a similar level
  let peak = 0;
  for (let i = 0; i < total; i += 1) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0) {
    const g = 0.85 / peak;
    for (let i = 0; i < total; i += 1) out[i] *= g;
  }
  return buffer;
}

// Asymmetric soft-clipping curve. A symmetric curve produces odd harmonics
// only, which reads as fuzz; the offset adds even harmonics for a warmer,
// more amp-like break-up.
function driveCurve(amount: number, bias: number): Float32Array<ArrayBuffer> {
  const n = 2048;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const span = Math.tanh(amount + bias) - Math.tanh(bias);
  for (let i = 0; i < n; i += 1) {
    const x = (i * 2) / n - 1;
    curve[i] = (Math.tanh(x * amount + bias) - Math.tanh(bias)) / span;
  }
  return curve;
}

// The Riffs tab unmounts whenever you switch tabs, so a per-component synth
// leaked an AudioContext on every visit. Browsers only allow a handful of live
// contexts per page, and once that ceiling is hit ALL audio on the page goes
// silent — the metronome included. One shared instance avoids the whole class
// of problem.
let shared: RiffSynth | null = null;

export function getRiffSynth(): RiffSynth {
  if (!shared) shared = new RiffSynth();
  return shared;
}

export class RiffSynth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ampIn: GainNode | null = null;
  private shaper: WaveShaperNode | null = null;
  private drivenGain: GainNode | null = null;
  private cleanGain: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private scheduled: AudioScheduledSourceNode[] = [];
  private stopAt = 0;
  private tone: RiffTone = "clean";
  private volume = 0.75;

  private ensure(): AudioContext {
    if (this.ctx) return this.ctx;

    const ctx = getAudioContext();
    this.ctx = ctx;

    // ── Amp chain, built once and shared by every note ──
    this.ampIn = ctx.createGain();

    // Body resonance: a little chest around 110 Hz and presence near 2.5 kHz,
    // then roll off the fizz above the top of a guitar's range.
    const body = ctx.createBiquadFilter();
    body.type = "peaking";
    body.frequency.value = 110;
    body.Q.value = 1.1;
    body.gain.value = 4;

    const presence = ctx.createBiquadFilter();
    presence.type = "peaking";
    presence.frequency.value = 2400;
    presence.Q.value = 0.9;
    presence.gain.value = 3;

    const rollOff = ctx.createBiquadFilter();
    rollOff.type = "lowpass";
    rollOff.frequency.value = 5200;
    rollOff.Q.value = 0.7;

    // Two parallel paths so the tone switch is instant
    this.cleanGain = ctx.createGain();
    this.drivenGain = ctx.createGain();
    this.shaper = ctx.createWaveShaper();
    this.shaper.curve = driveCurve(DRIVE_AMOUNT, DRIVE_BIAS);
    this.shaper.oversample = "4x";
    // A mid lift ahead of the clipper, the way an overdrive pedal works
    const driveMid = ctx.createBiquadFilter();
    driveMid.type = "peaking";
    driveMid.frequency.value = DRIVE_MID_HZ;
    driveMid.Q.value = 0.8;
    driveMid.gain.value = DRIVE_MID_DB;
    const drivePre = ctx.createGain();
    drivePre.gain.value = DRIVE_PRE_GAIN;
    // Lift the harmonics the clipper just created, then roll off the fizz
    const drivePresence = ctx.createBiquadFilter();
    drivePresence.type = "peaking";
    drivePresence.frequency.value = DRIVE_PRESENCE_HZ;
    drivePresence.Q.value = 0.9;
    drivePresence.gain.value = DRIVE_PRESENCE_DB;
    const drivePost = ctx.createBiquadFilter();
    drivePost.type = "lowpass";
    drivePost.frequency.value = DRIVE_POST_HZ;

    this.master = ctx.createGain();
    this.master.gain.value = this.volume * 0.8;

    this.ampIn.connect(body);
    body.connect(presence);
    presence.connect(rollOff);

    rollOff.connect(this.cleanGain);
    this.cleanGain.connect(this.master);

    rollOff.connect(driveMid);
    driveMid.connect(drivePre);
    drivePre.connect(this.shaper);
    this.shaper.connect(drivePresence);
    drivePresence.connect(drivePost);
    drivePost.connect(this.drivenGain);
    this.drivenGain.connect(this.master);

    this.master.connect(ctx.destination);
    this.applyTone();
    return ctx;
  }

  private applyTone(): void {
    if (!this.cleanGain || !this.drivenGain) return;
    this.cleanGain.gain.value = this.tone === "clean" ? 1 : 0;
    this.drivenGain.gain.value = this.tone === "driven" ? DRIVE_MAKEUP : 0;
  }

  setTone(tone: RiffTone): void {
    this.tone = tone;
    this.applyTone();
  }

  async resume(): Promise<void> {
    this.ensure();
    await resumeAudio();
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.volume * 0.8;
  }

  // Buffers are keyed by delay-line length; the exact pitch is then dialled in
  // with playbackRate, which also fixes the tuning error from rounding.
  private bufferFor(
    ctx: AudioContext,
    freq: number,
    stringIndex?: number,
  ): { buffer: AudioBuffer; baseFreq: number; gain: number } {
    const n = Math.max(2, Math.round(ctx.sampleRate / freq));
    const character =
      stringIndex === undefined ? characterForPitch(freq) : STRING_CHARACTER[stringIndex];
    // Cached per string as well as per pitch, since the two produce different
    // tone from the same delay-line length.
    const key = `${n}:${stringIndex ?? "x"}`;
    let buffer = this.buffers.get(key);
    if (!buffer) {
      buffer = renderPluck(ctx, n, freq > 300 ? 2.4 : 3.4, character.brightness, character.damping);
      this.buffers.set(key, buffer);
    }
    // The loop filter averages each sample with the one ahead of it, which is
    // a half-sample advance, so the string actually sounds at a period of
    // n - 0.5. Using that here keeps every pitch exactly in tune; without it
    // notes run sharp, and worse the higher you go.
    return { buffer, baseFreq: ctx.sampleRate / (n - 0.5), gain: character.gain };
  }

  private pluck(
    midi: number,
    at: number,
    seconds: number,
    opts: {
      bendSemis?: number;
      vibrato?: boolean;
      legato?: boolean;
      gain?: number;
      stringIndex?: number;
    } = {},
  ): void {
    const ctx = this.ensure();
    if (!this.ampIn) return;

    const freq = midiToHz(midi);
    const { buffer, baseFreq, gain: stringGain } = this.bufferFor(ctx, freq, opts.stringIndex);
    const dur = Math.max(0.1, seconds);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const rate = freq / baseFreq;
    src.playbackRate.setValueAtTime(rate, at);

    if (opts.bendSemis) {
      // A real bend arrives over the first part of the note and then holds
      const target = rate * Math.pow(2, opts.bendSemis / 12);
      src.playbackRate.setValueAtTime(rate, at + dur * 0.06);
      src.playbackRate.linearRampToValueAtTime(target, at + dur * 0.34);
    }

    if (opts.vibrato) {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 5.4;
      lfoGain.gain.value = rate * 0.011;
      lfo.connect(lfoGain);
      lfoGain.connect(src.playbackRate);
      lfo.start(at + dur * 0.2);
      lfo.stop(at + dur + 0.6);
      this.scheduled.push(lfo);
    }

    // The string is already decaying on its own; this envelope only handles
    // the attack and the damping when the note ends.
    const amp = ctx.createGain();
    const peak = (opts.gain ?? 0.5) * stringGain * (opts.legato ? 0.7 : 1);
    const attack = opts.legato ? 0.012 : 0.002;
    amp.gain.setValueAtTime(0, at);
    amp.gain.linearRampToValueAtTime(peak, at + attack);
    amp.gain.setValueAtTime(peak, at + dur);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.34);

    src.connect(amp);
    amp.connect(this.ampIn);
    src.start(at);
    src.stop(at + dur + 0.4);
    this.scheduled.push(src);
  }

  // ── Playback for chords, scales and arpeggios ───────────────────────────

  // Strum a chord. Notes are raked low to high like a pick crossing strings.
  playChord(
    notes: PlayNote[],
    opts: { at?: number; strumMs?: number; seconds?: number } = {},
  ): number {
    const ctx = this.ensure();
    const at = opts.at ?? ctx.currentTime + 0.06;
    const rake = (opts.strumMs ?? 18) / 1000;
    const seconds = opts.seconds ?? 1.5;
    const ordered = [...notes].sort((a, b) => a.midi - b.midi);
    ordered.forEach((n, i) => {
      this.pluck(n.midi, at + i * rake, seconds, {
        gain: 0.34,
        stringIndex: n.stringIndex,
      });
    });
    return at;
  }

  // Play a run of single notes at a steady rate — a scale or an arpeggio.
  playSequence(
    notes: PlayNote[],
    bpm: number,
    opts: { notesPerBeat?: number; at?: number } = {},
  ): { startTime: number; secondsPerNote: number; totalSeconds: number } {
    const ctx = this.ensure();
    const notesPerBeat = opts.notesPerBeat ?? 2;
    const secondsPerNote = 60 / bpm / notesPerBeat;
    const start = opts.at ?? ctx.currentTime + 0.08;
    notes.forEach((n, i) => {
      // Let each note ring a little past the next so the line sounds joined
      this.pluck(n.midi, start + i * secondsPerNote, secondsPerNote * 1.25, {
        gain: 0.42,
        stringIndex: n.stringIndex,
      });
    });
    return {
      startTime: start,
      secondsPerNote,
      totalSeconds: notes.length * secondsPerNote,
    };
  }

  play(
    riff: Riff,
    bpm: number,
    loop: boolean,
    startAt?: number,
  ): { startTime: number; totalSeconds: number } {
    this.stop();
    const ctx = this.ensure();
    const secPerTick = 60 / bpm / TICKS_PER_QUARTER;
    // Caller may hand us a beat time to come in on; otherwise start shortly.
    const earliest = ctx.currentTime + 0.06;
    const start = startAt !== undefined && startAt >= earliest ? startAt : ctx.currentTime + 0.12;

    const totalTicks = riff.events.reduce((s, e) => s + e.duration, 0);
    const totalSeconds = totalTicks * secPerTick;
    const passes = loop ? 4 : 1;

    for (let pass = 0; pass < passes; pass += 1) {
      const offset = start + pass * totalSeconds;
      riff.events.forEach((e: RiffEvent, i) => {
        if (e.rest) return;
        const at = offset + e.start * secPerTick;
        const ringTicks =
          e.technique === "hammer" || e.technique === "pull" ? e.duration * 1.7 : e.duration;
        const prev = riff.events[i - 1];
        const legato = Boolean(prev && (prev.technique === "hammer" || prev.technique === "pull"));

        e.notes.forEach((n, j) => {
          // Double stops are raked a few milliseconds apart, the way a pick
          // crosses two strings rather than hitting them dead together.
          const strum = j * 0.012;
          this.pluck(n.midi, at + strum, ringTicks * secPerTick, {
            bendSemis: e.bendAmount === "full" ? 2 : e.bendAmount === "half" ? 1 : undefined,
            vibrato: e.technique === "vibrato",
            legato,
            gain: e.notes.length > 1 ? 0.36 : 0.5,
            stringIndex: n.stringIndex,
          });
        });
      });
    }

    this.stopAt = start + totalSeconds * passes;
    return { startTime: start, totalSeconds };
  }

  stop(): void {
    for (const node of this.scheduled) {
      try {
        node.stop();
      } catch {
        // already stopped
      }
    }
    this.scheduled = [];
    this.stopAt = 0;
  }

  // Drops this synth's nodes. The AudioContext itself is shared with the
  // metronome, so it is deliberately left open.
  release(): void {
    this.stop();
    this.buffers.clear();
  }

  get currentTime(): number {
    return this.ctx?.currentTime ?? 0;
  }

  get endsAt(): number {
    return this.stopAt;
  }
}
