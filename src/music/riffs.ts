import { ChartKey } from "./chords";
import { hashStringToInt } from "./daily";
import { buildScaleDiagram, FRET_COUNT, ScaleDef } from "./scales";

// ── Timing ────────────────────────────────────────────────────────────────────
// A quarter note is 12 ticks, which divides evenly into both sixteenths (3) and
// triplet eighths (4), so straight and shuffled feels share one grid.

export const TICKS_PER_QUARTER = 12;
export const TICKS_PER_BAR = TICKS_PER_QUARTER * 4;

// ── Types ─────────────────────────────────────────────────────────────────────

export type Technique =
  | "hammer" // hammer-on into the next note
  | "pull" // pull-off into the next note
  | "slide" // slide into the next note
  | "bend"
  | "vibrato";

export type RiffNote = {
  stringIndex: number; // 0 = low E .. 5 = high E
  fret: number;
  midi: number;
  interval: string; // scale degree label, for teaching
};

export type RiffEvent = {
  start: number; // ticks from the start of the riff
  duration: number; // ticks
  rest: boolean;
  notes: RiffNote[]; // more than one = double stop
  technique?: Technique;
  bendAmount?: "half" | "full"; // semitones bent up: 1 or 2
};

export type Riff = {
  scale: ScaleDef;
  key: ChartKey;
  boxNumber: number;
  startFret: number;
  endFret: number;
  feel: RiffFeel;
  bars: number;
  complexity: RiffComplexity;
  events: RiffEvent[];
};

// How hard the riff is to play — which is not the same as how fast. What makes
// a line difficult is leaving one hand position, leaping instead of stepping,
// skipping strings, breaking up the repetition, and putting notes between the
// scale tones. Each level turns those up together.
export type RiffComplexity = 1 | 2 | 3 | 4;

export type ComplexityLevel = {
  level: RiffComplexity;
  name: string;
  description: string;
  extraFrets: number; // how far past the one box the hand may range
  leapChance: number; // odds of jumping more than one scale step
  maxLeap: number; // how far such a jump may go
  repeatBarChance: number; // odds bar two simply repeats bar one
  chromaticChance: number; // passing notes from outside the scale
  techniqueScale: number; // multiplier on bends, slurs and slides
  stringSkipChance: number; // double stops across a skipped string
  subdivide: number; // odds of splitting a beat further than the feel asks
  shiftChance: number; // odds of moving the hand when there is time to do so
};

export const RIFF_COMPLEXITY: ComplexityLevel[] = [
  {
    level: 1,
    name: "Simple",
    description: "One position, stepwise, and the second bar answers the first.",
    extraFrets: 0,
    leapChance: 0.04,
    maxLeap: 2,
    repeatBarChance: 0.8,
    chromaticChance: 0,
    techniqueScale: 0.6,
    stringSkipChance: 0,
    subdivide: 0,
    shiftChance: 0,
  },
  {
    level: 2,
    name: "Moderate",
    description: "Still one position, but wider intervals and a freer second bar.",
    extraFrets: 0,
    leapChance: 0.12,
    maxLeap: 2,
    repeatBarChance: 0.45,
    chromaticChance: 0,
    techniqueScale: 1,
    stringSkipChance: 0.1,
    subdivide: 0.1,
    shiftChance: 0.12,
  },
  {
    level: 3,
    name: "Tricky",
    description: "Shifts out of the box, skips strings, and repeats itself less.",
    extraFrets: 4,
    leapChance: 0.3,
    maxLeap: 3,
    repeatBarChance: 0.2,
    chromaticChance: 0.07,
    techniqueScale: 1.3,
    stringSkipChance: 0.28,
    subdivide: 0.3,
    shiftChance: 0.45,
  },
  {
    level: 4,
    name: "Brutal",
    description: "Ranges across positions, leaps, chromatic passing notes, few repeats.",
    extraFrets: 8,
    leapChance: 0.45,
    maxLeap: 4,
    repeatBarChance: 0.05,
    chromaticChance: 0.16,
    techniqueScale: 1.5,
    stringSkipChance: 0.4,
    subdivide: 0.5,
    shiftChance: 0.7,
  },
];

export type RiffFeel = {
  id: string;
  name: string;
  description: string;
  swing: boolean;
  // Rhythm cells, each a list of tick durations (negative = rest)
  cells: number[][];
  // 0-1 likelihoods for the decorations
  doubleStopChance: number;
  bendChance: number;
  slurChance: number; // hammer-ons and pull-offs
  slideChance: number;
  // Which strings the riff prefers to sit on
  stringBias: "low" | "high" | "any";
  density: number; // 0-1, how often a cell subdivides
};

const Q = TICKS_PER_QUARTER;

export const RIFF_FEELS: RiffFeel[] = [
  {
    id: "rock",
    name: "Rock",
    description: "Straight eighths on the low strings with the odd sixteenth kick.",
    swing: false,
    cells: [[Q], [Q / 2, Q / 2], [Q / 2, Q / 4, Q / 4], [Q / 4, Q / 4, Q / 2], [-Q / 2, Q / 2]],
    doubleStopChance: 0.25,
    bendChance: 0.12,
    slurChance: 0.3,
    slideChance: 0.15,
    stringBias: "low",
    density: 0.6,
  },
  {
    id: "blues",
    name: "Shuffle Blues",
    description: "Triplet swing, bends on the money notes, double stops in fourths.",
    swing: true,
    cells: [[Q], [(Q * 2) / 3, Q / 3], [Q / 3, Q / 3, Q / 3], [-Q / 3, Q / 3, Q / 3]],
    doubleStopChance: 0.28,
    bendChance: 0.42,
    slurChance: 0.4,
    slideChance: 0.2,
    stringBias: "high",
    density: 0.55,
  },
  {
    id: "funk",
    name: "Funk",
    description: "Sixteenth-note syncopation with rests doing half the work.",
    swing: false,
    cells: [
      [Q / 4, Q / 4, Q / 4, Q / 4],
      [-Q / 4, Q / 4, Q / 2],
      [Q / 4, Q / 4, Q / 2],
      [-Q / 2, Q / 4, Q / 4],
      [Q / 2, -Q / 4, Q / 4],
    ],
    doubleStopChance: 0.4,
    bendChance: 0.1,
    slurChance: 0.35,
    slideChance: 0.25,
    stringBias: "high",
    density: 0.85,
  },
  {
    id: "metal",
    name: "Gallop",
    description: "Palm-muted gallop figures anchored on the root.",
    swing: false,
    cells: [[Q / 2, Q / 4, Q / 4], [Q / 4, Q / 4, Q / 4, Q / 4], [Q / 2, Q / 2], [Q]],
    doubleStopChance: 0.15,
    bendChance: 0.05,
    slurChance: 0.25,
    slideChance: 0.1,
    stringBias: "low",
    density: 0.9,
  },
  {
    id: "melodic",
    name: "Melodic",
    description: "Longer notes, singing phrases, vibrato on the tail.",
    swing: false,
    cells: [[Q], [Q, Q], [(Q * 3) / 2, Q / 2], [Q / 2, Q / 2], [Q / 2, Q / 4, Q / 4]],
    doubleStopChance: 0.2,
    bendChance: 0.3,
    slurChance: 0.45,
    slideChance: 0.3,
    stringBias: "high",
    density: 0.62,
  },
];

// ── Seeded RNG ────────────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(rng: () => number, list: T[]): T => list[Math.floor(rng() * list.length)];

// ── The note pool for one position ────────────────────────────────────────────

const OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64];

type PoolNote = RiffNote & { semis: number };

function buildPool(
  scale: ScaleDef,
  key: ChartKey,
  startFret: number,
  endFret: number,
): { byPitch: PoolNote[]; all: PoolNote[] } {
  const diagram = buildScaleDiagram(scale, key);
  const all: PoolNote[] = diagram.notes
    .filter((n) => n.fret >= startFret && n.fret <= endFret)
    .map((n) => ({
      stringIndex: n.stringIndex,
      fret: n.fret,
      midi: OPEN_STRING_MIDI[n.stringIndex] + n.fret,
      interval: n.interval,
      semis: (OPEN_STRING_MIDI[n.stringIndex] + n.fret - key.pitchClass) % 12,
    }));

  // One entry per distinct pitch, so stepwise motion means "next scale tone"
  const seen = new Map<number, PoolNote>();
  for (const n of all) if (!seen.has(n.midi)) seen.set(n.midi, n);
  const byPitch = [...seen.values()].sort((a, b) => a.midi - b.midi);
  return { byPitch, all };
}

// Prefer the fingering closest to where the hand already is
function placeMidi(all: PoolNote[], midi: number, prevString: number | null): PoolNote | null {
  const options = all.filter((n) => n.midi === midi);
  if (options.length === 0) return null;
  if (prevString === null) return options[0];
  return options.reduce((best, n) =>
    Math.abs(n.stringIndex - prevString) < Math.abs(best.stringIndex - prevString) ? n : best,
  );
}

// ── Idiomatic decorations ─────────────────────────────────────────────────────

// A bend is only offered where the target pitch is itself a scale tone: the
// classic b7->R and 4->5 whole steps, and the b3->3 blues bend.
const BEND_TARGETS: Array<{ from: number; semis: 1 | 2 }> = [
  { from: 10, semis: 2 }, // b7 -> root
  { from: 5, semis: 2 }, // 4 -> 5
  { from: 3, semis: 1 }, // b3 -> 3 (the blues bend)
  { from: 9, semis: 2 }, // 6 -> b7
  { from: 2, semis: 2 }, // 2 -> 3
];

function bendFor(
  note: PoolNote,
  scaleSemis: Set<number>,
  rng: () => number,
): "half" | "full" | null {
  // Bends live on the thinner strings and need a fret to push against
  if (note.stringIndex < 2 || note.fret < 3) return null;
  const candidates = BEND_TARGETS.filter(
    (b) => b.from === note.semis && scaleSemis.has((note.semis + b.semis) % 12),
  );
  if (candidates.length === 0) return null;
  return pick(rng, candidates).semis === 2 ? "full" : "half";
}

// Consonant double stops only, on adjacent strings, within a hand span
const CONSONANT = new Set([3, 4, 5, 7, 8, 9, 12]);

function doubleStopFor(
  note: PoolNote,
  all: PoolNote[],
  rng: () => number,
  skipChance = 0,
): PoolNote | null {
  // Adjacent strings normally; at the harder settings the pair may straddle a
  // skipped string, which is a good deal more awkward to play.
  const maxGap = rng() < skipChance ? 2 : 1;
  const partners = all.filter((p) => {
    const span = Math.abs(p.stringIndex - note.stringIndex);
    if (span < 1 || span > maxGap) return false;
    if (Math.abs(p.fret - note.fret) > 3) return false;
    const gap = Math.abs(p.midi - note.midi);
    return CONSONANT.has(gap);
  });
  if (partners.length === 0) return null;
  // Favour the higher note so the double stop sits on top
  const above = partners.filter((p) => p.midi > note.midi);
  return pick(rng, above.length > 0 ? above : partners);
}

// ── Generation ────────────────────────────────────────────────────────────────

type Cell = { durations: number[] };

// Break the longest note of a cell in two. An even split just adds speed; an
// uneven one pushes the second note off the beat, which is what actually makes
// a rhythm hard to place.
function splitLongest(durations: number[], rng: () => number): number[] {
  let idx = -1;
  let longest = 0;
  for (let i = 0; i < durations.length; i += 1) {
    if (durations[i] > longest) {
      longest = durations[i];
      idx = i;
    }
  }
  // Anything shorter than an eighth cannot be halved and still be readable
  if (idx < 0 || longest < TICKS_PER_QUARTER / 2) return durations;

  const quarter = longest / 4;
  const pair =
    rng() < 0.5
      ? [longest / 2, longest / 2]
      : rng() < 0.5
        ? [quarter * 3, quarter]
        : [quarter, quarter * 3];
  // Keep everything on the tick grid
  if (pair.some((d) => !Number.isInteger(d) || d < 1)) return durations;
  return [...durations.slice(0, idx), ...pair, ...durations.slice(idx + 1)];
}

function buildBarRhythm(feel: RiffFeel, rng: () => number, subdivide = 0): Cell[] {
  const cells: Cell[] = [];
  let filled = 0;
  while (filled < TICKS_PER_BAR) {
    const candidates = feel.cells.filter((c) => {
      const len = c.reduce((s, d) => s + Math.abs(d), 0);
      return filled + len <= TICKS_PER_BAR;
    });
    if (candidates.length === 0) break;
    // Sparser feels lean on the longer cells
    const chosen =
      rng() < feel.density
        ? pick(rng, candidates)
        : candidates.reduce((longest, c) => {
            const len = c.reduce((s, d) => s + Math.abs(d), 0);
            const bestLen = longest.reduce((s, d) => s + Math.abs(d), 0);
            return len > bestLen ? c : longest;
          });
    // Harder settings cut the beat finer than the feel asked for
    let durations = chosen;
    if (subdivide > 0 && rng() < subdivide) durations = splitLongest(durations, rng);
    if (subdivide > 0.35 && rng() < subdivide * 0.7) durations = splitLongest(durations, rng);

    cells.push({ durations });
    filled += durations.reduce((s, d) => s + Math.abs(d), 0);
  }
  // Top up any remainder with a rest so bars are always full
  if (filled < TICKS_PER_BAR) cells.push({ durations: [-(TICKS_PER_BAR - filled)] });
  return cells;
}

export function generateRiff(
  scale: ScaleDef,
  key: ChartKey,
  boxNumber: number,
  feel: RiffFeel,
  seed: number,
  bars = 2,
  complexity: RiffComplexity = 2,
): Riff {
  const rng = mulberry32(seed);
  const hard = RIFF_COMPLEXITY.find((c) => c.level === complexity) ?? RIFF_COMPLEXITY[1];
  const diagram = buildScaleDiagram(scale, key);
  const box =
    diagram.boxes.find((b) => b.number === boxNumber) ?? diagram.boxes[0] ?? { start: 0, end: 4, number: 1 };
  // Harder settings let the hand range beyond the single position
  const lowFret = Math.max(0, box.start - Math.floor(hard.extraFrets / 2));
  const highFret = Math.min(FRET_COUNT, box.end + Math.ceil(hard.extraFrets / 2));
  const { byPitch, all } = buildPool(scale, key, lowFret, highFret);
  const scaleSemis = new Set(scale.tones.map((t) => t.semis));

  if (byPitch.length < 3) {
    return { scale, key, boxNumber, startFret: lowFret, endFret: highFret, feel, bars, complexity, events: [] };
  }

  // Bias the register: low feels start near the bottom of the box, high feels
  // near the top, so a gallop and a blues lick don't sit in the same octave.
  const span = byPitch.length;
  const lowIdx = Math.floor(span * 0.15);
  const highIdx = Math.floor(span * 0.55);
  const startIdx =
    feel.stringBias === "low" ? lowIdx : feel.stringBias === "high" ? highIdx : Math.floor(span / 3);

  // Root positions make the strongest landing points
  const rootIndices = byPitch
    .map((n, i) => (n.semis === 0 ? i : -1))
    .filter((i) => i >= 0);
  const nearestRoot = (from: number): number =>
    rootIndices.length === 0
      ? from
      : rootIndices.reduce((best, i) => (Math.abs(i - from) < Math.abs(best - from) ? i : best));

  // ── Pitch contour for one bar, as indices into byPitch ──
  const contourForBar = (noteCount: number, anchor: number): number[] => {
    const shape = pick(rng, ["rise", "fall", "arch", "zigzag", "pedal"]);
    const out: number[] = [];
    let idx = anchor;
    for (let i = 0; i < noteCount; i += 1) {
      out.push(Math.max(0, Math.min(span - 1, idx)));
      const bigStep =
        rng() < hard.leapChance ? 2 + Math.floor(rng() * (hard.maxLeap - 1)) : 1;
      switch (shape) {
        case "rise":
          idx += bigStep;
          break;
        case "fall":
          idx -= bigStep;
          break;
        case "arch":
          idx += i < noteCount / 2 ? bigStep : -bigStep;
          break;
        case "zigzag":
          idx += i % 2 === 0 ? bigStep : -bigStep;
          break;
        case "pedal":
          // Alternate between a fixed anchor and a neighbour a step or two away
          idx = i % 2 === 0 ? anchor : anchor + 1 + Math.floor(rng() * 2);
          break;
      }
      if (idx < 0) idx = Math.min(span - 1, anchor + 1);
      if (idx > span - 1) idx = Math.max(0, anchor - 1);
    }
    return out;
  };

  // ── Bar 1 is the motif; later bars repeat it with a varied tail ──
  const motifRhythm = buildBarRhythm(feel, rng, hard.subdivide);
  const motifDurations = motifRhythm.flatMap((c) => c.durations);
  const soundedCount = motifDurations.filter((d) => d > 0).length;
  const motifContour = contourForBar(soundedCount, startIdx);

  const events: RiffEvent[] = [];
  // The hand covers four frets and stays put until there is room to move it.
  // Without this the widened range at the harder settings simply scattered
  // notes across it — 8 to 10 to 5 to 3 on one string, joined by pull-offs no
  // hand could make. Difficulty should come from shifting position, not from
  // stretches nobody can play.
  const HAND_SPAN = 4;
  let handFret = Math.max(lowFret, Math.min(box.start, highFret - HAND_SPAN + 1));

  const reachable = (hf: number): PoolNote[] =>
    all.filter((n) => n.fret >= hf && n.fret <= hf + HAND_SPAN - 1);

  // Where this pitch falls under the hand, preferring the string nearest the
  // one just played.
  const placeInHand = (midi: number, hf: number, prev: number | null): PoolNote | null => {
    const opts = reachable(hf).filter((n) => n.midi === midi);
    if (opts.length === 0) return null;
    if (prev === null) return opts[0];
    return opts.reduce((best, n) =>
      Math.abs(n.stringIndex - prev) < Math.abs(best.stringIndex - prev) ? n : best,
    );
  };

  // When the wanted pitch is out of reach and there is no time to shift, play
  // the closest note that IS reachable rather than lunging for it.
  const nearestInHand = (midi: number, hf: number, prev: number | null): PoolNote | null => {
    const opts = reachable(hf);
    if (opts.length === 0) return null;
    return opts.reduce((best, n) => {
      const d = Math.abs(n.midi - midi);
      const bd = Math.abs(best.midi - midi);
      if (d !== bd) return d < bd ? n : best;
      if (prev === null) return best;
      return Math.abs(n.stringIndex - prev) < Math.abs(best.stringIndex - prev) ? n : best;
    });
  };

  // The nearest hand position that can reach a pitch at all
  const handFor = (midi: number): number | null => {
    const spots: number[] = [];
    for (let hf = lowFret; hf + HAND_SPAN - 1 <= highFret; hf += 1) {
      if (all.some((n) => n.midi === midi && n.fret >= hf && n.fret <= hf + HAND_SPAN - 1)) {
        spots.push(hf);
      }
    }
    if (spots.length === 0) return null;
    return spots.reduce((b, c) => (Math.abs(c - handFret) < Math.abs(b - handFret) ? c : b));
  };

  let tick = 0;
  let prevString: number | null = null;
  let prevFret: number | null = null;
  // Tick of the last note struck, so "is there time to move the hand" can be
  // answered by the clock rather than by whether a rest happened to occur —
  // a sixteenth rest is not time to cross the neck.
  let lastOnset: number | null = null;

  for (let bar = 0; bar < bars; bar += 1) {
    const isLastBar = bar === bars - 1;
    // Riffs repeat: keep the rhythm, and keep the contour except for the tail
    const durations = motifDurations;
    let contour = [...motifContour];

    if (bar > 0) {
      const variation = rng();
      if (variation < hard.repeatBarChance) {
        // Say it again — the plainest and most riff-like answer, which is why
        // the easy settings do it most.
      } else if (variation < hard.repeatBarChance + (1 - hard.repeatBarChance) * 0.55) {
        // Answer the motif a scale step away
        const shift = rng() < 0.5 ? 1 : -1;
        contour = contour.map((c) => Math.max(0, Math.min(span - 1, c + shift)));
      } else {
        // Same opening, new ending
        const tailFrom = Math.floor(contour.length / 2);
        const tail = contourForBar(contour.length - tailFrom, contour[tailFrom]);
        contour = [...contour.slice(0, tailFrom), ...tail];
      }
    }

    // Land the final bar on a root
    if (isLastBar && contour.length > 0) {
      contour[contour.length - 1] = nearestRoot(contour[contour.length - 1]);
    }

    let sounded = 0;
    for (let d = 0; d < durations.length; d += 1) {
      const dur = durations[d];
      if (dur < 0) {
        events.push({ start: tick, duration: -dur, rest: true, notes: [] });
        tick += -dur;
        continue;
      }

      const idx = contour[Math.min(sounded, contour.length - 1)] ?? startIdx;
      const target = byPitch[idx];

      // There is room to move the hand only if a beat or more has passed since
      // the last note was struck — counting rests, but measured on the clock.
      const roomToShift = lastOnset === null || tick - lastOnset >= Q;
      // Every position the hand could take and still reach this note
      const reachableHands = (midi: number): number[] => {
        const spots: number[] = [];
        for (let hf = lowFret; hf + HAND_SPAN - 1 <= highFret; hf += 1) {
          if (all.some((n) => n.midi === midi && n.fret >= hf && n.fret <= hf + HAND_SPAN - 1)) {
            spots.push(hf);
          }
        }
        return spots;
      };

      if (roomToShift && hard.shiftChance > 0 && rng() < hard.shiftChance) {
        // Move on purpose, not only when stranded. Waiting for a note to be
        // out of reach almost never happens — the contour stays under the
        // hand — so without this the harder settings never made you shift,
        // which is most of what makes a slow line difficult.
        const away = reachableHands(target.midi).filter((hf) => Math.abs(hf - handFret) >= 2);
        if (away.length > 0) handFret = pick(rng, away);
      } else if (roomToShift && placeInHand(target.midi, handFret, prevString) === null) {
        const moved = handFor(target.midi);
        if (moved !== null) handFret = moved;
      }

      let placed = placeInHand(target.midi, handFret, prevString);
      if (placed === null) {
        placed = nearestInHand(target.midi, handFret, prevString);
      }
      if (placed === null) {
        // Nothing at all under the hand — move it rather than reach. If there
        // was no time for a proper shift, cap how far it can travel so the
        // move stays possible at tempo.
        const moved = handFor(target.midi);
        if (moved !== null) {
          handFret = roomToShift
            ? moved
            : Math.max(handFret - 4, Math.min(handFret + 4, moved));
        }
        placed =
          placeInHand(target.midi, handFret, prevString) ??
          nearestInHand(target.midi, handFret, prevString) ??
          target;
      }
      // Last guard: with no time to move, the hand cannot travel more than a
      // few frets between notes, whatever the contour asked for.
      if (!roomToShift && prevFret !== null && Math.abs(placed.fret - prevFret) > 4) {
        const close = all.filter((n) => Math.abs(n.fret - prevFret!) <= 4);
        if (close.length > 0) {
          placed = close.reduce((best, n) =>
            Math.abs(n.midi - target.midi) < Math.abs(best.midi - target.midi) ? n : best,
          );
          handFret = Math.max(lowFret, Math.min(highFret - HAND_SPAN + 1, placed.fret));
        }
      }

      const isFinal = isLastBar && sounded === contour.length - 1;
      const onBeat = tick % TICKS_PER_QUARTER === 0;

      // A chromatic approach: slip a semitone below the scale tone on a short
      // off-beat note. Only at the harder settings, and never on the last note
      // or a downbeat, where an outside tone would just sound wrong.
      let sounded_note: PoolNote = placed;
      if (
        hard.chromaticChance > 0 &&
        !onBeat &&
        !isFinal &&
        dur < Q &&
        placed.fret - 1 >= handFret &&
        rng() < hard.chromaticChance
      ) {
        sounded_note = {
          ...placed,
          fret: placed.fret - 1,
          midi: placed.midi - 1,
          interval: "ch",
        };
      }

      const ev: RiffEvent = {
        start: tick,
        duration: dur,
        rest: false,
        notes: [sounded_note],
      };

      // Bend — favoured on longer notes and on the beat
      const bend = bendFor(sounded_note, scaleSemis, rng);
      if (bend && rng() < feel.bendChance * hard.techniqueScale * (dur >= Q / 2 ? 1.4 : 0.5)) {
        ev.bendAmount = bend;
        ev.technique = "bend";
      } else if (rng() < feel.doubleStopChance * hard.techniqueScale && (onBeat || isFinal)) {
        // Double stop — strongest on downbeats and at the end
        const partner = doubleStopFor(sounded_note, all, rng, hard.stringSkipChance);
        if (partner) ev.notes.push(partner);
      }

      // Slur or slide into the following note when they share a string
      if (!ev.technique && !isFinal && sounded + 1 < contour.length) {
        const nextTarget = byPitch[contour[sounded + 1]];
        const nextPlaced = placeMidi(all, nextTarget.midi, placed.stringIndex);
        if (nextPlaced && nextPlaced.stringIndex === sounded_note.stringIndex) {
          const gap = Math.abs(nextPlaced.fret - sounded_note.fret);
          if (gap >= 1 && gap <= 3 && rng() < feel.slurChance * hard.techniqueScale) {
            ev.technique = nextPlaced.fret > placed.fret ? "hammer" : "pull";
          } else if (gap >= 2 && gap <= 5 && rng() < feel.slideChance * hard.techniqueScale) {
            ev.technique = "slide";
          }
        }
      }

      // Let the last note ring
      if (isFinal && !ev.bendAmount) ev.technique = "vibrato";

      events.push(ev);
      prevString = sounded_note.stringIndex;
      prevFret = sounded_note.fret;
      lastOnset = tick;
      tick += dur;
      sounded += 1;
    }
  }

  // A slur or slide is chosen before the following note is finally placed, and
  // a hand shift can move that note to another string. Sweep once at the end
  // and drop any that cannot actually be executed: hammer-ons, pull-offs and
  // slides all need the next note on the same string, within a finger's reach.
  const soundedEvents = events.filter((e) => !e.rest);
  for (let i = 0; i < soundedEvents.length; i += 1) {
    const e = soundedEvents[i];
    if (!e.technique || e.technique === "bend" || e.technique === "vibrato") continue;
    const next = soundedEvents[i + 1];
    const from = e.notes[0];
    const to = next?.notes[0];
    const sameString = to !== undefined && to.stringIndex === from.stringIndex;
    const reach = to === undefined ? Infinity : Math.abs(to.fret - from.fret);
    const limit = e.technique === "slide" ? 5 : 3;
    if (!sameString || reach < 1 || reach > limit) delete e.technique;
  }

  return { scale, key, boxNumber, startFret: lowFret, endFret: highFret, feel, bars, complexity, events };
}

// The riff of the day, seeded from the date the same way the chord chart is
export function riffSeed(dateISO: string, variant: number): number {
  return hashStringToInt(`${dateISO}:riff`) + variant * 7919;
}
