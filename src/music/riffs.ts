import { ChartKey } from "./chords";
import { hashStringToInt } from "./daily";
import { buildScaleDiagram, FRET_COUNT, ScaleDef } from "./scales";
import { OPEN_STRING_MIDI } from "./tuning";

// ── Timing ────────────────────────────────────────────────────────────────────
// A quarter note is 12 ticks, which divides evenly into both sixteenths (3) and
// triplet eighths (4), so straight and shuffled feels share one grid.

export const TICKS_PER_QUARTER = 12;
export const TICKS_PER_BAR = TICKS_PER_QUARTER * 4;

const Q = TICKS_PER_QUARTER;

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
  notes: RiffNote[]; // a riff is a single-note line, so always exactly one
  technique?: Technique;
  bendAmount?: "half" | "full"; // semitones bent up: 1 or 2
  // The bend comes back down before the note ends. Always so when the next
  // note is on the same string — it can't be fretted with the string still
  // pushed up — and often otherwise, as the bend-and-release lick.
  bendRelease?: boolean;
};

export type Riff = {
  scale: ScaleDef;
  key: ChartKey;
  boxNumber: number;
  span: number; // how many positions the riff travels through, from boxNumber up
  startFret: number;
  endFret: number;
  feel: RiffFeel;
  bars: number;
  complexity: RiffComplexity;
  events: RiffEvent[];
};

// How hard the riff is to play. Difficulty comes from things a player would
// recognise as technique: density, leaps between chord tones, sequences,
// chromatic approach notes, a wider reach and position shifts. Randomness is
// not one of them. A riff that leaps about at random sounds scattered rather
// than hard, so every level keeps the same musical structure (a motif, its
// repeats, a turnaround) and the dials only change what goes inside it.
export type RiffComplexity = 1 | 2 | 3 | 4;

// How the cells after the first treat the motif
type Development = "repeat" | "answer" | "develop" | "phrase";

export type ComplexityLevel = {
  level: RiffComplexity;
  name: string;
  description: string;
  extraFrets: number; // how far past the one box the hand may range
  handSpan: number; // frets under the hand: 4 is a finger each, 5 is a stretch
  leapChance: number; // odds a note leaps to a chord tone instead of stepping
  maxLeap: number; // scale steps such a leap may cover
  development: Development;
  chromaticChance: number; // approach notes a half step into a strong beat
  sequenceChance: number; // odds a busy cell is played as a sequence
  sequenceGroup: 3 | 4; // notes per group in that sequence
  techniqueScale: number; // multiplier on bends, slurs and slides
  subdivide: number; // odds of splitting a beat further than the feel asks
  wideRegister: boolean; // one more string either side of the feel's register
  outsideBoxCost: number; // how firmly the fingering is held inside the box
  // How much there is to learn and how fast it goes. These are what actually
  // separate the levels: a 2-bar riff in eighths is a few minutes' work, four
  // bars of sixteenths and sextuplets that never quite repeat is not.
  bars: number;
  plainRhythm: boolean; // eighths and longer only, where the feel allows
  busyness: number; // floor on how often the busier rhythm cells are chosen
  extraCells: number[][]; // rhythm cells added to the feel's own
  restScale: number; // multiplier on the feel's rests: gaps make a line easier
  transposeRange: number; // scale steps a developed motif may move
  // Each cell keeps to one subdivision — all sixteenths, or all sextuplets —
  // with at most a short figure to finish on. Switching grids every beat is
  // hard to play but sounds like nobody chose the rhythm.
  gridRhythm: boolean;
};

export const RIFF_COMPLEXITY: ComplexityLevel[] = [
  {
    level: 1,
    name: "Simple",
    description: "Two bars in eighths and quarters, in one position: a short motif played three times and a turnaround home to the root.",
    extraFrets: 0,
    handSpan: 4,
    leapChance: 0.1,
    maxLeap: 2,
    development: "repeat",
    chromaticChance: 0,
    sequenceChance: 0,
    sequenceGroup: 3,
    techniqueScale: 0.8,
    subdivide: 0,
    wideRegister: false,
    outsideBoxCost: 4,
    bars: 2,
    plainRhythm: true,
    busyness: 0,
    extraCells: [],
    restScale: 1,
    transposeRange: 1,
    gridRhythm: false,
  },
  {
    level: 2,
    name: "Moderate",
    description: "Two bars with the odd sixteenth: the motif is answered rather than repeated, with the occasional leap and approach note.",
    extraFrets: 2,
    handSpan: 4,
    leapChance: 0.25,
    maxLeap: 3,
    development: "answer",
    chromaticChance: 0.2,
    sequenceChance: 0.15,
    sequenceGroup: 4,
    techniqueScale: 1.15,
    subdivide: 0.3,
    wideRegister: false,
    outsideBoxCost: 2,
    bars: 2,
    plainRhythm: false,
    busyness: 0,
    extraCells: [],
    restScale: 1,
    transposeRange: 1,
    gridRhythm: false,
  },
  {
    level: 3,
    name: "Tricky",
    description: "Four bars, mostly sixteenths: sequences in fours, chromatic approach notes, hammer-on runs and a stretch across more strings.",
    // Only a fret either side of the box. Wider, and the notes it adds sit on
    // the outer strings alone, so reaching them means sliding along a string
    extraFrets: 2,
    handSpan: 5,
    leapChance: 0.38,
    maxLeap: 4,
    development: "develop",
    chromaticChance: 0.4,
    sequenceChance: 0.55,
    sequenceGroup: 4,
    techniqueScale: 1.6,
    subdivide: 0.7,
    wideRegister: true,
    outsideBoxCost: 1.5,
    bars: 4,
    plainRhythm: false,
    busyness: 0.9,
    extraCells: [
      [Q / 4, Q / 4, Q / 4, Q / 4],
      [Q / 4, Q / 2, Q / 4],
      [(Q * 3) / 4, Q / 4],
    ],
    restScale: 0.7,
    transposeRange: 2,
    gridRhythm: false,
  },
  {
    level: 4,
    name: "Brutal",
    description: "Four bars as a call and an answer: the motif moved through the scale in sixteenths and sextuplets, sequences in threes across the beat, legato runs and position shifts.",
    extraFrets: 7,
    handSpan: 5,
    // Leaps are rarer and smaller than they were: hard to play is not the
    // same as jumping about, and a line that zigzags on every note stops
    // sounding like a line
    leapChance: 0.3,
    maxLeap: 4,
    development: "phrase",
    chromaticChance: 0.35,
    // Threes over sixteenths: the pattern restarts somewhere new against the
    // beat every time, which is what makes it hard to count and hard to play
    sequenceChance: 0.6,
    sequenceGroup: 3,
    techniqueScale: 1.5,
    subdivide: 1,
    wideRegister: true,
    outsideBoxCost: 0.3,
    bars: 4,
    plainRhythm: false,
    busyness: 1,
    extraCells: [
      [Q / 4, Q / 4, Q / 4, Q / 4],
      [Q / 6, Q / 6, Q / 6, Q / 6, Q / 6, Q / 6], // sextuplet
    ],
    restScale: 0.5,
    transposeRange: 3,
    gridRhythm: true,
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
  bendChance: number;
  slurChance: number; // hammer-ons and pull-offs
  slideChance: number;
  // Which strings of the box the riff lives on
  stringBias: "low" | "high" | "any";
  density: number; // 0-1, how often a busy cell is chosen over a long one
  // The motif's length in beats. Two-beat cells make the tight, repeating
  // figures of rock, funk and metal; a whole bar makes a phrase.
  cellBeats: 2 | 4;
  pedalChance: number; // odds the riff pumps a root pedal under the melody
  pedalDensity: number; // in a pedal riff, odds an off-beat note is the pedal
  restChance: number; // odds an off-beat note becomes a rest
};

export const RIFF_FEELS: RiffFeel[] = [
  {
    id: "rock",
    name: "Rock",
    description: "Straight eighths on the low strings, often pumping a root pedal under the melody.",
    swing: false,
    cells: [[Q], [Q / 2, Q / 2], [Q / 2, Q / 4, Q / 4], [Q / 4, Q / 4, Q / 2], [-Q / 2, Q / 2]],
    bendChance: 0.12,
    slurChance: 0.3,
    slideChance: 0.15,
    stringBias: "low",
    density: 0.6,
    cellBeats: 2,
    pedalChance: 0.5,
    pedalDensity: 0.65,
    restChance: 0.1,
  },
  {
    id: "blues",
    name: "Shuffle Blues",
    description: "Triplet swing on the top strings, with the bends landing on the money notes.",
    swing: true,
    cells: [[Q], [(Q * 2) / 3, Q / 3], [Q / 3, Q / 3, Q / 3], [-Q / 3, Q / 3, Q / 3]],
    bendChance: 0.42,
    slurChance: 0.4,
    slideChance: 0.2,
    stringBias: "high",
    density: 0.55,
    cellBeats: 4,
    pedalChance: 0,
    pedalDensity: 0,
    restChance: 0.12,
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
    bendChance: 0.1,
    slurChance: 0.35,
    slideChance: 0.25,
    stringBias: "high",
    density: 0.85,
    cellBeats: 2,
    pedalChance: 0.25,
    pedalDensity: 0.5,
    restChance: 0.4,
  },
  {
    id: "metal",
    name: "Gallop",
    description: "Gallop figures chugging on a low root, with the melody on the beat.",
    swing: false,
    cells: [[Q / 2, Q / 4, Q / 4], [Q / 4, Q / 4, Q / 4, Q / 4], [Q / 2, Q / 2], [Q]],
    bendChance: 0.05,
    slurChance: 0.2,
    slideChance: 0.1,
    stringBias: "low",
    density: 0.9,
    cellBeats: 2,
    pedalChance: 0.9,
    pedalDensity: 0.85,
    restChance: 0,
  },
  {
    id: "melodic",
    name: "Melodic",
    description: "Longer notes, singing phrases, vibrato on the tail.",
    swing: false,
    cells: [[Q], [Q, Q], [(Q * 3) / 2, Q / 2], [Q / 2, Q / 2], [Q / 2, Q / 4, Q / 4]],
    bendChance: 0.3,
    slurChance: 0.45,
    slideChance: 0.3,
    stringBias: "high",
    density: 0.62,
    cellBeats: 4,
    pedalChance: 0,
    pedalDensity: 0,
    restChance: 0.06,
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

// ── Beats ─────────────────────────────────────────────────────────────────────

// How much weight a moment in the bar carries: the downbeat most, then beat 3,
// then the other beats, then everything between them. Pitch choice follows
// it — the root and chord tones go where the ear expects to hear the harmony.
function beatStrength(tick: number): number {
  if (tick % TICKS_PER_BAR === 0) return 3;
  if (tick % (Q * 2) === 0) return 2;
  if (tick % Q === 0) return 1;
  return 0;
}

// ── Decorations ───────────────────────────────────────────────────────────────

// A bend is only offered where the target pitch is itself a scale tone: the
// classic b7->R and 4->5 whole steps, and the b3->3 blues bend.
const BEND_TARGETS: Array<{ from: number; semis: 1 | 2 }> = [
  { from: 10, semis: 2 }, // b7 -> root
  { from: 5, semis: 2 }, // 4 -> 5
  { from: 3, semis: 1 }, // b3 -> 3 (the blues bend)
  { from: 9, semis: 2 }, // 6 -> b7
  { from: 2, semis: 2 }, // 2 -> 3
];

// ── Rhythm ────────────────────────────────────────────────────────────────────

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

// The rhythm cells a level plays a feel with. Simple keeps to eighths and
// longer when the feel has any; the hard levels add their own busier cells.
function cellsFor(feel: RiffFeel, level: ComplexityLevel): number[][] {
  let cells = feel.cells;
  if (level.plainRhythm) {
    const plain = cells.filter((c) => c.every((d) => Math.abs(d) >= Q / 2));
    if (plain.length >= 2) cells = plain;
  }
  // A swung feel keeps its triplet grid: straight sixteenths would fight it
  const extra = feel.swing ? level.extraCells.filter((c) => c.every((d) => Math.abs(d) % (Q / 3) === 0 || Math.abs(d) % (Q / 6) === 0)) : level.extraCells;
  return [...cells, ...extra];
}

// A cell on one grid: every beat the same subdivision, with now and then a
// short figure on its last beat to finish the phrase. Swung feels use their
// triplets; the singing feel lets the last beat ring.
function gridRhythm(feel: RiffFeel, rng: () => number, length: number): number[] {
  const beats = Math.max(1, Math.round(length / Q));
  const grids = feel.swing
    ? [[Q / 3, Q / 3, Q / 3], [Q / 6, Q / 6, Q / 6, Q / 6, Q / 6, Q / 6]]
    : [[Q / 4, Q / 4, Q / 4, Q / 4], [Q / 4, Q / 4, Q / 4, Q / 4], [Q / 6, Q / 6, Q / 6, Q / 6, Q / 6, Q / 6]];
  const grid = pick(rng, grids);
  const endings = feel.id === "melodic" ? [[Q]] : feel.swing ? [[(Q * 2) / 3, Q / 3], [Q]] : [[Q / 2, Q / 2], [Q / 4, Q / 4, Q / 2], [Q]];
  const out: number[] = [];
  for (let b = 0; b < beats; b += 1) {
    const last = b === beats - 1;
    out.push(...(last && beats > 1 && rng() < 0.55 ? pick(rng, endings) : grid));
  }
  return out;
}

// Fill `length` ticks from the given rhythm cells
function buildRhythm(
  feel: RiffFeel,
  rng: () => number,
  subdivide: number,
  length: number,
  cells: number[][] = feel.cells,
  busyness = 0,
): number[] {
  const out: number[] = [];
  let filled = 0;
  const len = (c: number[]) => c.reduce((s, d) => s + Math.abs(d), 0);
  const density = Math.max(feel.density, busyness);
  while (filled < length) {
    const candidates = cells.filter((c) => filled + len(c) <= length);
    if (candidates.length === 0) break;
    // Sparser feels lean on the longer cells; the hard levels lean on the
    // busiest ones
    const busiest = candidates.reduce((b, c) => (c.length / len(c) > b.length / len(b) ? c : b));
    let chosen =
      rng() < busyness - 0.5
        ? busiest
        : rng() < density
        ? pick(rng, candidates)
        : candidates.reduce((longest, c) => (len(c) > len(longest) ? c : longest));
    // Harder settings cut the beat finer than the feel asked for
    if (subdivide > 0 && rng() < subdivide) chosen = splitLongest(chosen, rng);
    if (subdivide > 0.35 && rng() < subdivide * 0.7) chosen = splitLongest(chosen, rng);
    out.push(...chosen);
    filled += len(chosen);
  }
  if (filled < length) out.push(-(length - filled));
  return out;
}

// ── Building blocks ───────────────────────────────────────────────────────────

// One slot in a cell: a rest, or a note given as an index into the riff's
// pitch list. Pedal notes are flagged so the fingering keeps them on the low
// string and the decorations leave them alone.
type Slot = {
  start: number;
  duration: number;
  rest: boolean;
  idx: number;
  pedal: boolean;
  chromatic?: number;
  pos?: number; // which position of a travelling riff the note belongs to
};

type Pitch = { midi: number; semis: number; label: string };

type Candidate = { stringIndex: number; fret: number };

// ── Generation ────────────────────────────────────────────────────────────────

export function generateRiff(
  scale: ScaleDef,
  key: ChartKey,
  boxNumber: number,
  feel: RiffFeel,
  seed: number,
  bars: number | undefined = undefined, // defaults to the level's own length
  complexity: RiffComplexity = 2,
  span = 1, // positions to travel through: 1 stays in one box
): Riff {
  // A riff that travels needs room to: at least a bar per position
  bars = Math.max(bars ?? (RIFF_COMPLEXITY.find((c) => c.level === complexity) ?? RIFF_COMPLEXITY[1]).bars, span === 3 ? 4 : span);
  // A riff needs at least three different pitches to be a tune rather than a
  // note. The rare seed that falls short tries the next one; the result is
  // still fixed for a given seed, so the riff of the day stays the riff of
  // the day.
  let riff = buildRiff(scale, key, boxNumber, feel, seed, bars, complexity, span);
  for (let attempt = 1; attempt < 24; attempt += 1) {
    const pitches = new Set(riff.events.filter((e) => !e.rest).map((e) => e.notes[0].midi));
    if (pitches.size >= 3 || riff.events.length === 0) break;
    riff = buildRiff(scale, key, boxNumber, feel, seed + attempt * 104729, bars, complexity, span);
  }
  return riff;
}

function buildRiff(
  scale: ScaleDef,
  key: ChartKey,
  boxNumber: number,
  feel: RiffFeel,
  seed: number,
  bars: number,
  complexity: RiffComplexity,
  span: number,
): Riff {
  const rng = mulberry32(seed);
  const hard = RIFF_COMPLEXITY.find((c) => c.level === complexity) ?? RIFF_COMPLEXITY[1];
  const diagram = buildScaleDiagram(scale, key);
  const box =
    diagram.boxes.find((b) => b.number === boxNumber) ?? diagram.boxes[0] ?? { start: 0, end: 4, number: 1 };
  // ── Positions ──
  // A multi-position riff climbs through neighbouring boxes: the next box up
  // the neck each time, as far as the neck allows.
  const positions = [box];
  const boxCount = diagram.boxNumbers.length || 1;
  while (positions.length < span) {
    const last = positions[positions.length - 1];
    const nextNumber = (last.number % boxCount) + 1;
    const next = diagram.boxes
      .filter((b) => b.number === nextNumber && b.start > last.start)
      .sort((a, b) => a.start - b.start)[0];
    if (!next) break;
    positions.push(next);
  }
  const lastBox = positions[positions.length - 1];
  const lowFret = Math.max(0, box.start - Math.floor(hard.extraFrets / 2));
  const highFret = Math.min(FRET_COUNT, lastBox.end + Math.ceil(hard.extraFrets / 2));
  const travels = positions.length > 1;
  const empty: Riff = {
    scale, key, boxNumber, span: positions.length, startFret: lowFret, endFret: highFret, feel, bars, complexity, events: [],
  };

  const scaleSemis = new Set(scale.tones.map((t) => t.semis));
  const labelFor = new Map(scale.tones.map((t) => [t.semis, t.label]));
  const semisOf = (midi: number) => (((midi - key.pitchClass) % 12) + 12) % 12;

  // The chord the riff lives on: root, third and fifth of the scale's own
  // tonic chord. These are the notes that make a line sound like it is in a
  // key rather than wandering a scale.
  const third = scaleSemis.has(3) ? 3 : scaleSemis.has(4) ? 4 : null;
  const fifth = scaleSemis.has(7) ? 7 : scaleSemis.has(6) ? 6 : scaleSemis.has(8) ? 8 : null;
  const chordSemis = new Set([0, ...(third === null ? [] : [third]), ...(fifth === null ? [] : [fifth])]);

  // ── Register: which strings of the box the feel lives on ──
  // Rock and gallop riffs sit on the bottom strings and blues licks on the top
  // ones. Inside that register the line still crosses strings — that is how a
  // box is played — it just doesn't sprawl over all six.
  const allStrings = [0, 1, 2, 3, 4, 5];
  let register =
    feel.stringBias === "low" ? [0, 1, 2] : feel.stringBias === "high" ? [3, 4, 5] : allStrings;
  if (hard.wideRegister && feel.stringBias === "low") register = [0, 1, 2, 3];
  if (hard.wideRegister && feel.stringBias === "high") register = [2, 3, 4, 5];
  // Brutal ranges over five strings: wide leaps need somewhere to land
  if (hard.level === 4 && feel.stringBias === "low") register = [0, 1, 2, 3, 4];
  if (hard.level === 4 && feel.stringBias === "high") register = [1, 2, 3, 4, 5];
  // At Tricky and Brutal a low riff works the A, D and G strings, coming down
  // to the low E only for its root. A busy line parked on the low E is a
  // rumble rather than a riff: the notes are too low to tell apart at speed.
  const liftOffLowE = hard.level >= 3 && feel.stringBias === "low";
  if (liftOffLowE) register = register.filter((x) => x !== 0);

  const placesFor = (midi: number, strings: number[], lo: number, hi: number): Candidate[] =>
    strings
      .map((s) => ({ stringIndex: s, fret: midi - OPEN_STRING_MIDI[s] }))
      .filter((c) => c.fret >= lo && c.fret <= hi);

  // Every scale tone the register can reach inside the window, low to high
  const pitchList = (strings: number[]): Pitch[] => {
    const seen = new Set<number>();
    const out: Pitch[] = [];
    for (let midi = 40; midi <= 64 + FRET_COUNT; midi += 1) {
      const semis = semisOf(midi);
      if (!scaleSemis.has(semis) || seen.has(midi)) continue;
      if (placesFor(midi, strings, lowFret, highFret).length === 0) continue;
      seen.add(midi);
      out.push({ midi, semis, label: labelFor.get(semis) ?? "?" });
    }
    return out;
  };
  let pitches = pitchList(register);
  // A register with no root in it has no home; widen it until it has one
  if (!pitches.some((p) => p.semis === 0) || pitches.length < 5) {
    register = allStrings;
    pitches = pitchList(register);
  }
  // The low E's root stays available as the floor the riff can drop to
  if (liftOffLowE && register.every((x) => x !== 0)) {
    const lowRoot = pitchList([0]).find((p) => p.semis === 0);
    if (lowRoot && !pitches.some((p) => p.midi === lowRoot.midi)) {
      pitches = [...pitches, lowRoot].sort((a, b) => a.midi - b.midi);
    }
  }
  if (pitches.length < 3) return empty;

  const hi = pitches.length - 1;
  // The band of pitches the current position can reach. One-position riffs
  // use all of them; a travelling riff narrows it to each box in turn.
  const bandFor = (b: { start: number; end: number }): [number, number] => {
    const inBox = pitches
      .map((p, i) => (placesFor(p.midi, register, Math.max(0, b.start - 1), b.end + 1).length > 0 ? i : -1))
      .filter((i) => i >= 0);
    return inBox.length >= 3 ? [inBox[0], inBox[inBox.length - 1]] : [0, hi];
  };
  const bands = positions.map((b) => (travels ? bandFor(b) : ([0, hi] as [number, number])));
  let bandLo = bands[0][0];
  let bandHi = bands[0][1];
  const clamp = (i: number, lo = 0, top = bandHi) => Math.max(Math.max(lo, bandLo), Math.min(top, i));
  const isChord = (i: number) => chordSemis.has(pitches[i].semis);
  const roots = pitches.map((p, i) => (p.semis === 0 ? i : -1)).filter((i) => i >= 0);

  // Home: the root the riff starts from and returns to. Low feels take the
  // lowest one, high feels one up in the top of the register.
  // A travelling riff starts from a root its first position can reach.
  const homeRoots = roots.filter((i) => i >= bandLo && i <= bandHi).length > 0 ? roots.filter((i) => i >= bandLo && i <= bandHi) : roots;
  const span0 = bandHi - bandLo;
  const home =
    feel.stringBias === "low"
      ? homeRoots[0]
      : feel.stringBias === "high"
        ? homeRoots.reduce((b, i) => (Math.abs(i - (bandLo + span0 * 0.6)) < Math.abs(b - (bandLo + span0 * 0.6)) ? i : b))
        : homeRoots.reduce((b, i) => (Math.abs(i - (bandLo + span0 / 2)) < Math.abs(b - (bandLo + span0 / 2)) ? i : b));

  // The chord tone nearest an index, looking `dir` first
  const nearestChord = (i: number, dir: number, lo = 0, top = bandHi, maxDist = hi): number => {
    for (let d = 0; d <= maxDist; d += 1) {
      for (const s of d === 0 ? [0] : [dir || 1, -(dir || 1)]) {
        const j = i + s * d;
        if (j >= Math.max(lo, bandLo) && j <= Math.min(top, bandHi) && isChord(j)) return j;
      }
    }
    return clamp(i, lo, top);
  };

  // ── Pedal: a low root pumped under the melody ──
  // The most common riff device there is, and one that stays in one position:
  // the root on the low string on the off-beats, the tune on the beats above it.
  const pedalIdx = roots[0];
  // A pedal holds the hand down: wrong for a riff that is meant to travel, and
  // at the hard levels mostly a way of dwelling on one low note
  const pedalOdds = travels ? 0 : feel.pedalChance * (hard.level === 4 ? 0 : hard.level === 3 ? 0.3 : 1);
  const usePedal = rng() < pedalOdds && hi - pedalIdx >= 4;
  const melodyLo = usePedal ? pedalIdx + 1 : 0;

  // ── Lines ──

  // A melody that steps, sometimes leaps to a chord tone, sits on chord tones
  // when the beat is strong, and never just trades two notes back and forth.
  const melodyLine = (onsets: number[], start: number, lowest: number): number[] => {
    const lo = Math.max(lowest, bandLo);
    const hi = bandHi;
    const out: number[] = [];
    let idx = clamp(start, lo);
    let dir = idx - lo < hi - idx ? 1 : -1;
    let run = 0;
    for (let k = 0; k < onsets.length; k += 1) {
      if (k > 0) {
        let next: number;
        if (rng() < hard.leapChance) {
          const opts: number[] = [];
          for (let d = 2; d <= hard.maxLeap; d += 1) {
            for (const s of [dir, -dir]) {
              const j = idx + s * d;
              if (j >= lo && j <= hi && isChord(j)) opts.push(j);
            }
          }
          next = opts.length > 0 ? (rng() < 0.7 ? opts[0] : pick(rng, opts)) : idx + dir;
        } else if (rng() < 0.1) {
          next = idx; // a repeated note, the way a riff restates a pitch
        } else {
          next = idx + dir;
        }
        // Bounce off the edges of the register rather than sticking to them
        if (next > hi) next = idx - 1;
        if (next < lo) next = idx + 1;
        next = clamp(next, lo);
        if (beatStrength(onsets[k]) >= 2 && !isChord(next)) next = nearestChord(next, dir, lo, hi, 1);
        // A-B-A-B is a trill, not a line: keep going instead of turning back
        if (k >= 3 && next === out[k - 2] && out[k - 1] === out[k - 3] && next !== out[k - 1]) {
          const away = Math.sign(out[k - 1] - next) || 1;
          next = clamp(out[k - 1] + away, lo);
          if (next === out[k - 2]) next = clamp(out[k - 1] - away, lo);
        }
        const moved = Math.sign(next - idx);
        if (moved !== 0) {
          if (moved === dir) run += 1;
          else {
            dir = moved;
            run = 1;
          }
        }
        // Phrases turn around after a few steps one way
        if (run >= 3 && rng() < 0.35) {
          dir = -dir;
          run = 0;
        }
        idx = next;
      }
      out.push(idx);
    }
    return out;
  };

  // A sequence: the same little shape repeated a step higher each time —
  // 1-2-3, 2-3-4, 3-4-5. The classic way to make a fast line hard to play
  // without making it random.
  const sequenceLine = (count: number, start: number, lowest: number): number[] => {
    const lo = Math.max(lowest, bandLo);
    const hi = bandHi;
    const g = hard.sequenceGroup;
    const reachTop = Math.floor((count - 1) / g) + g - 1;
    let dir = start + reachTop <= hi ? 1 : -1;
    if (dir === -1 && start - reachTop < lo) dir = 1;
    // Fold back off the edges rather than sticking to them: a sequence that
    // runs out of room and clamps turns into one note hammered six times
    const fold = (v: number): number => {
      let x = v;
      for (let i = 0; i < 4 && (x < lo || x > hi); i += 1) x = x > hi ? hi - (x - hi) : lo + (lo - x);
      return clamp(x, lo);
    };
    return Array.from({ length: count }, (_, k) => fold(start + dir * (Math.floor(k / g) + (k % g))));
  };

  // No pitch more than twice running in a line. A third restatement is where
  // a riff stops moving: step it to the neighbour instead.
  const unstick = (line: number[]): number[] => {
    const out = [...line];
    for (let k = 2; k < out.length; k += 1) {
      if (out[k] === out[k - 1] && out[k] === out[k - 2]) {
        const up = out[k] + 1 <= bandHi;
        out[k] = clamp(up ? out[k] + 1 : out[k] - 1, Math.max(melodyLo, bandLo));
      }
    }
    return out;
  };

  // Turn rhythm into a cell of slots, with pitches
  const makeCell = (durations: number[], startTick: number, startIdx: number, allowSequence: boolean): Slot[] => {
    const slots: Slot[] = [];
    let t = startTick;
    for (const d of durations) {
      slots.push({ start: t, duration: Math.abs(d), rest: d < 0, idx: 0, pedal: false });
      t += Math.abs(d);
    }
    const sounded = slots.filter((s) => !s.rest);
    if (usePedal) {
      // Off-beats chug the pedal; the beats carry the tune. The riff's first
      // note is the pedal itself, which is the root on the downbeat.
      const melodySlots = sounded.filter(
        (s, k) => !(k === 0 && s.start === 0) && (beatStrength(s.start) >= 1 || rng() >= feel.pedalDensity),
      );
      // A pedal with nothing over it is one note chugging: at least one note in
      // three carries the tune, taken from the strongest beats first.
      const wanted = Math.max(1, Math.round(sounded.length / 3));
      const spare = sounded
        .filter((s, k) => !melodySlots.includes(s) && !(k === 0 && s.start === 0))
        .sort((a, b) => beatStrength(b.start) - beatStrength(a.start) || a.start - b.start);
      while (melodySlots.length < wanted && spare.length > 0) melodySlots.push(spare.shift()!);
      melodySlots.sort((a, b) => a.start - b.start);
      for (const s of sounded) {
        s.pedal = !melodySlots.includes(s);
        s.idx = pedalIdx;
      }
      const tune = melodyLine(
        melodySlots.map((s) => s.start),
        nearestChord(Math.max(startIdx, melodyLo + 1), 1, melodyLo),
        melodyLo,
      );
      melodySlots.forEach((s, k) => (s.idx = tune[k]));
    } else {
      const busy = sounded.length >= 6 && sounded.every((s) => s.duration <= Q / 2);
      const line =
        allowSequence && busy && rng() < hard.sequenceChance
          ? sequenceLine(sounded.length, startIdx, melodyLo)
          : melodyLine(
              sounded.map((s) => s.start),
              startIdx,
              melodyLo,
            );
      const moving = unstick(line);
      sounded.forEach((s, k) => (s.idx = moving[k]));
    }
    return slots;
  };

  // Off-beat notes turned into rests: what gives funk its gaps. Never the
  // riff's first note, and a cell always keeps at least two notes.
  const addRests = (durations: number[], startTick: number, chance: number): number[] => {
    if (chance <= 0) return durations;
    const out = [...durations];
    let t = startTick;
    let sounding = out.filter((d) => d > 0).length;
    for (let i = 0; i < out.length; i += 1) {
      const d = out[i];
      if (d > 0 && t !== 0 && beatStrength(t) === 0 && sounding > 2 && rng() < chance) {
        out[i] = -d;
        sounding -= 1;
      }
      t += Math.abs(d);
    }
    return out;
  };

  const shiftCell = (cell: Slot[], by: number, newStart: number): Slot[] => {
    const offset = newStart - cell[0].start;
    const lo = Math.max(melodyLo, bandLo);
    // Notes pushed past the edge of the range fold back into it. Clamping
    // them would stack them all on the edge note.
    const fold = (v: number): number => {
      let x = v;
      for (let i = 0; i < 4 && (x < lo || x > bandHi); i += 1) x = x > bandHi ? bandHi - (x - bandHi) : lo + (lo - x);
      return clamp(x, lo);
    };
    const out = cell.map((s) => {
      const moved = { ...s, start: s.start + offset };
      if (!s.rest && !s.pedal) {
        moved.idx = fold(s.idx + by);
        // A moved motif keeps its shape but lands its strong beats on the
        // chord, the way a player adjusts a lick played from another degree
        if (by !== 0 && beatStrength(moved.start) >= 2 && !isChord(moved.idx)) {
          moved.idx = nearestChord(moved.idx, Math.sign(by) || 1, lo, bandHi, 1);
        }
      }
      return moved;
    });
    const tune = out.filter((s) => !s.rest && !s.pedal);
    unstick(tune.map((s) => s.idx)).forEach((idx, k) => (tune[k].idx = idx));
    return out;
  };

  // Same opening, new ending: keep the first half of the cell, rewrite the rest
  const retail = (cell: Slot[], newStart: number, by = 0): Slot[] => {
    const out = shiftCell(cell, by, newStart);
    const half = newStart + (out[out.length - 1].start + out[out.length - 1].duration - newStart) / 2;
    const tail = out.filter((s) => s.start >= half && !s.rest && !s.pedal);
    if (tail.length === 0) return out;
    const before = out.filter((s) => s.start < half && !s.rest && !s.pedal);
    const from = before.length > 0 ? before[before.length - 1].idx : home;
    const line = melodyLine(
      [before.length > 0 ? before[before.length - 1].start : newStart, ...tail.map((s) => s.start)],
      from,
      melodyLo,
    );
    tail.forEach((s, k) => (s.idx = line[k + 1]));
    return out;
  };

  // ── The motif ──
  const L = feel.cellBeats * Q;
  const total = bars * TICKS_PER_BAR;
  const nCells = Math.max(1, Math.round(total / L));
  const firstIdx = rng() < 0.8 ? home : nearestChord(home + (rng() < 0.5 ? 1 : -1), 1, melodyLo);
  // A motif needs at least three notes. Two, repeated, is a trill — R, b3,
  // R, b3 — which is the sound of a riff that has not started yet.
  const cells = cellsFor(feel, hard);
  const restChance = feel.restChance * hard.restScale;
  const rhythm = (at: number, length = L) =>
    addRests(
      hard.gridRhythm ? gridRhythm(feel, rng, length) : buildRhythm(feel, rng, hard.subdivide, length, cells, hard.busyness),
      at,
      restChance,
    );
  let rhythmA = rhythm(0);
  for (let tries = 0; tries < 8 && rhythmA.filter((d) => d > 0).length < 3; tries += 1) {
    rhythmA = addRests(buildRhythm(feel, rng, Math.max(hard.subdivide, 0.5), L, cells, hard.busyness), 0, restChance);
  }
  const cellA = makeCell(rhythmA, 0, firstIdx, true);
  const transposeBy = () => (rng() < 0.5 ? 1 : -1) * (1 + Math.floor(rng() * hard.transposeRange));

  // The middle cells, by how far the level develops the motif. Four-bar riffs
  // run the same plan twice, with fresh choices the second time, so a long
  // riff is a longer piece of music rather than one bar on repeat.
  // The phrase plan's moves for the motif, chosen once so the call and the
  // answer move it the same way — that sameness is what the ear follows
  const phraseMoves = [transposeBy(), transposeBy()];
  let cellB: { rhythm: number[]; slots: Slot[] } | null = null;

  // In a travelling riff each cell belongs to a position, in order up the
  // neck, and the motif is carried up with it: the same idea played in the
  // next box, the way a player connects positions.
  const posOf = (i: number) => Math.min(positions.length - 1, Math.floor((i * positions.length) / nCells));
  const enter = (p: number): number => {
    bandLo = bands[p][0];
    bandHi = bands[p][1];
    return bands[p][0] - bands[0][0];
  };
  const middle = (i: number): Slot[] => {
    const at = i * L;
    const base = enter(posOf(i));
    const arriving = travels && posOf(i) !== posOf(i - 1);
    if (arriving) return shiftCell(cellA, base, at); // the motif, a position up
    switch (hard.development) {
      case "repeat":
        return shiftCell(cellA, base, at);
      case "answer":
        return i % 2 === 1 ? retail(cellA, at, base) : shiftCell(cellA, base, at);
      case "develop":
        // A, A moved, A, A with a new tail — then the same again
        return i % 4 === 1
          ? shiftCell(cellA, base + transposeBy(), at)
          : i % 4 === 3
            ? retail(cellA, at, base)
            : shiftCell(cellA, base, at);
      case "phrase":
      default: {
        // A call and an answer, each two bars: A, A moved, a new idea B, A
        // moved again. The answer replays the call's plan with B varied, so
        // the riff has one idea to hold on to and one to contrast with it —
        // and the hard part is playing that idea from different places.
        const step = i % 4;
        if (step === 2) {
          if (!cellB) {
            const made = makeCell(rhythm(at), at, nearestChord(firstIdx + base + transposeBy(), 1, melodyLo), true);
            cellB = { rhythm: made.map((x) => (x.rest ? -x.duration : x.duration)), slots: made };
            return made;
          }
          // The answer brings B back too, moved like the motif was
          return shiftCell(cellB.slots, base + phraseMoves[0], at);
        }
        if (step === 0) return shiftCell(cellA, base, at);
        return shiftCell(cellA, base + (step === 1 ? phraseMoves[0] : phraseMoves[1]), at);
      }
    }
  };

  // ── The ending ──
  // Every riff finishes on a root that lands on a beat and is held long enough
  // to hear: either a half note on beat 3, or a quarter on beat 4 approached
  // stepwise through beat 3. A bar-long motif keeps its opening first, so the
  // ending sounds like the motif coming home.
  const ending = (at: number, prevIdx: number): Slot[] => {
    const out: Slot[] = [];
    const tailStart = at + L - Q * 2;
    const base = enter(positions.length - 1);
    if (L > Q * 2) {
      const prefix = shiftCell(cellA, base + (hard.development === "repeat" ? 0 : rng() < 0.5 ? 0 : transposeBy()), at);
      for (const s of prefix) {
        if (s.start >= tailStart) break;
        out.push({ ...s, duration: Math.min(s.duration, tailStart - s.start) });
      }
      const last = [...out].reverse().find((s) => !s.rest);
      if (last) prevIdx = last.idx;
    }
    // The final root has to be one this position can reach
    const reachable = roots.filter((i) => i >= bandLo && i <= bandHi);
    const finalIdx = usePedal
      ? pedalIdx
      : (reachable.length > 0 ? reachable : roots).reduce((b, i) => (Math.abs(i - prevIdx) < Math.abs(b - prevIdx) ? i : b));
    if (rng() < 0.4) {
      out.push({ start: tailStart, duration: Q * 2, rest: false, idx: finalIdx, pedal: usePedal });
      return out;
    }
    const pickup = buildRhythm(feel, rng, hard.subdivide * 0.5, Q, cells, hard.busyness).map((d) => Math.abs(d));
    let dir = prevIdx >= finalIdx ? 1 : -1;
    if (finalIdx + dir * pickup.length > bandHi || finalIdx + dir * pickup.length < Math.max(melodyLo, bandLo)) dir = -dir;
    let t = tailStart;
    pickup.forEach((d, k) => {
      out.push({ start: t, duration: d, rest: false, idx: clamp(finalIdx + dir * (pickup.length - k), melodyLo), pedal: false });
      t += d;
    });
    out.push({ start: tailStart + Q, duration: Q, rest: false, idx: finalIdx, pedal: usePedal });
    return out;
  };

  const slots: Slot[] = [...cellA];
  for (let i = 1; i < nCells - 1; i += 1) slots.push(...middle(i));
  const before = [...slots].reverse().find((s) => !s.rest);
  slots.push(...ending((nCells - 1) * L, before ? before.idx : home));
  for (const sl of slots) sl.pos = posOf(Math.min(nCells - 1, Math.floor(sl.start / L)));

  // ── Breaths ──
  // A phrase ends on a held note and a rest before the next one starts. A
  // riff that runs straight on until its final note sounds like an exercise;
  // the gaps are what make it sound like phrases. Breathe after the call in a
  // four-bar riff, sometimes at the end of a bar, and wherever a travelling
  // riff moves to its next position — which also gives the hand time to go.
  const total_ = nCells * L;
  const boundaries: Array<{ at: number; chance: number }> = [];
  for (let t = TICKS_PER_BAR; t < total_ - L / 2; t += TICKS_PER_BAR) {
    const midRiff = bars >= 4 && t === (bars / 2) * TICKS_PER_BAR;
    boundaries.push({ at: t, chance: midRiff ? 0.85 : bars >= 4 ? 0.3 : 0.6 });
  }
  if (travels) {
    for (let i = 1; i < nCells; i += 1) {
      if (posOf(i) !== posOf(i - 1) && !boundaries.some((b) => b.at === i * L)) {
        boundaries.push({ at: i * L, chance: 0.7 });
      }
    }
  }
  for (const { at, chance } of boundaries) {
    if (rng() >= chance) continue;
    const breath = hard.level <= 2 || rng() < 0.5 ? Q : Q / 2;
    const cut = at - breath;
    // The phrase's last note: the first one in the beat before the breath,
    // held up to it, so the phrase lands rather than stops mid-run
    const beatStart = Math.max(0, cut - Q / 2);
    const before = slots.filter((x) => !x.rest && x.start < cut);
    if (before.length < 3) continue;
    const landing = before.find((x) => x.start >= beatStart) ?? before[before.length - 1];
    const keep = slots.filter((x) => x.start < cut && (x.start <= landing.start || x.start < beatStart));
    const after = slots.filter((x) => x.start >= at);
    landing.duration = cut - landing.start;
    // Land the phrase on the chord
    if (!landing.pedal) {
      enter(landing.pos ?? 0);
      if (!isChord(landing.idx)) landing.idx = nearestChord(landing.idx, -1, Math.max(melodyLo, bandLo), bandHi, 2);
    }
    const rest: Slot = { start: cut, duration: breath, rest: true, idx: 0, pedal: false, pos: landing.pos };
    slots.splice(0, slots.length, ...keep.map((x) => (x.start + x.duration > cut ? { ...x, duration: cut - x.start } : x)), rest, ...after);
  }

  // One pass over the whole riff for trills. The melody avoids them within a
  // cell, but they also form where cells meet and where a copied motif lands
  // on the edge of its range. A-B-A-B: the fourth note carries on instead.
  {
    const tune = slots.filter((x) => !x.rest && !x.pedal);
    // The last note is the closing root and is never moved
    for (let k = 3; k < tune.length - 1; k += 1) {
      const [a, b, c, d] = [tune[k - 3].idx, tune[k - 2].idx, tune[k - 1].idx, tune[k].idx];
      if (d === b && c === a && a !== b) {
        const [lo, top] = bands[tune[k].pos ?? 0];
        const floor = Math.max(melodyLo, lo);
        const away = Math.sign(c - d) || 1;
        let next = c + away;
        if (next > top || next < floor) next = c - 2 * away;
        tune[k].idx = Math.max(floor, Math.min(top, next));
      }
    }
  }

  // ── Chromatic approach notes ──
  // A note a half step from a strong-beat target, played just before it on a
  // weak one, so it always resolves. That is what makes an outside note sound
  // intended. They are only taken where the approach pitch is outside the
  // scale — a "chromatic" note that is really in the key is just a scale tone.
  const sounded = slots.filter((s) => !s.rest);
  // Never the riff's first note, which states the key
  for (let j = 2; j < sounded.length; j += 1) {
    const target = sounded[j];
    const prev = sounded[j - 1];
    if (hard.chromaticChance <= 0 || prev.pedal || target.pedal) continue;
    if (prev.chromatic !== undefined || (j >= 2 && sounded[j - 2].chromatic !== undefined)) continue;
    if (prev.start + prev.duration !== target.start) continue;
    if (beatStrength(target.start) < 1 || beatStrength(prev.start) > 0 || prev.duration > Q / 2) continue;
    if (rng() >= hard.chromaticChance) continue;
    const goal = pitches[target.idx].midi;
    const from = rng() < 0.7 ? goal - 1 : goal + 1;
    if (scaleSemis.has(semisOf(from))) continue;
    if (placesFor(from, allStrings, Math.max(0, lowFret - 2), highFret + 2).length === 0) continue;
    prev.chromatic = from;
  }

  // ── Fingering ──
  // Choose a string and fret for every note at once, the cheapest path through
  // all the possibilities. Cheap means: inside the box, on the feel's strings,
  // crossing to the next string rather than sliding along one, moving the hand
  // only when there is time to, and taking a repeated pitch in the same place.
  const midiOf = (s: Slot) => s.chromatic ?? pitches[s.idx].midi;
  const reach = hard.handSpan - 1;
  const options = sounded.map((s) => {
    const midi = midiOf(s);
    let c = placesFor(midi, allStrings, lowFret, highFret);
    if (c.length === 0) c = placesFor(midi, allStrings, Math.max(0, lowFret - 2), highFret + 2);
    if (c.length === 0) c = placesFor(midi, allStrings, 0, FRET_COUNT);
    // Off the end of the neck altogether: should not happen, since every
    // pitch comes from the window, but never leave a note unplaceable
    if (c.length === 0) c = [{ stringIndex: 5, fret: Math.max(0, Math.min(FRET_COUNT, midi - OPEN_STRING_MIDI[5])) }];
    return c;
  });
  const nodeCost = (s: Slot, c: Candidate): number => {
    let cost = register.includes(c.stringIndex) ? 0 : 1.5;
    const b = positions[s.pos ?? 0] ?? box;
    const outside = c.fret === 0 ? 0 : c.fret < b.start ? b.start - c.fret : c.fret > b.end ? c.fret - b.end : 0;
    // A travelling riff is meant to leave each box for the next; it is held
    // to the current one, but less firmly
    cost += outside * (travels ? Math.max(hard.outsideBoxCost, 1.5) : hard.outsideBoxCost);
    if (s.pedal) cost += c.stringIndex * 0.8; // the pedal chugs on the lowest string it can
    return cost;
  };
  const moveCost = (a: Slot, ca: Candidate, b: Slot, cb: Candidate): number => {
    const dt = b.start - a.start;
    const df = ca.fret === 0 || cb.fret === 0 ? 0 : Math.abs(ca.fret - cb.fret);
    const timeFactor = dt >= Q * 2 ? 0.4 : dt >= Q ? 0.8 : dt >= Q / 2 ? 1.6 : 3;
    let cost = Math.max(0, df - reach) * 3 * timeFactor + df * 0.12;
    const ds = Math.abs(ca.stringIndex - cb.stringIndex);
    if (!a.pedal && !b.pedal && ds >= 2) cost += (ds - 1) * 0.5;
    // Along a string beyond the hand's reach: the shape that turns a
    // position into one string's worth of sliding up and down. Within reach it
    // costs nothing — two notes three frets apart on one string is how a
    // pentatonic box is built, and charging for it pushed notes out of the
    // box (B5 to B8 taken as G9 to B8, a stretch for an E already under the
    // hand).
    if (ca.stringIndex === cb.stringIndex && df > reach) cost += 2 + (df - reach) * 1.5;
    if (midiOf(a) === midiOf(b) && (ca.stringIndex !== cb.stringIndex || ca.fret !== cb.fret)) cost += 2;
    // Two low-E notes running at the hard levels: the line is sinking into
    // the rumble the register was lifted out of
    if (liftOffLowE && ca.stringIndex === 0 && cb.stringIndex === 0) cost += 2.5;
    return cost;
  };
  // Looking at three notes at a time catches the line that creeps along one
  // string in small steps — 8, 10, 12, 13 — none of them a stretch on its
  // own, but together a slide up the neck rather than a position.
  const creepCost = (a: Candidate, b: Candidate, c: Candidate): number => {
    if (a.stringIndex !== b.stringIndex || b.stringIndex !== c.stringIndex) return 0;
    const frets = [a.fret, b.fret, c.fret].filter((f) => f > 0);
    if (frets.length < 3) return 0;
    const span = Math.max(...frets) - Math.min(...frets);
    return span > reach ? 3 + (span - reach) * 1.5 : 0;
  };
  // best[j] maps "previous option, this option" to the cheapest cost of
  // reaching note j that way, and where it came from
  type Entry = { cost: number; from: string | null };
  const solve = (extra: (j: number, c: Candidate) => number): Candidate[] => {
  const best: Array<Map<string, Entry>> = [];
  options.forEach((opts, j) => {
    const row = new Map<string, Entry>();
    opts.forEach((c, k) => {
      const own = nodeCost(sounded[j], c) + extra(j, c);
      if (j === 0) {
        row.set(`-1,${k}`, { cost: own, from: null });
        return;
      }
      options[j - 1].forEach((p, pk) => {
        const step = moveCost(sounded[j - 1], p, sounded[j], c);
        let bestEntry: Entry | null = null;
        for (const [stateKey, prev] of best[j - 1]) {
          const [qk, pk2] = stateKey.split(",").map(Number);
          if (pk2 !== pk) continue;
          const creep = j >= 2 && qk >= 0 ? creepCost(options[j - 2][qk], p, c) : 0;
          const cost = prev.cost + step + creep + own;
          if (!bestEntry || cost < bestEntry.cost) bestEntry = { cost, from: stateKey };
        }
        if (bestEntry) row.set(`${pk},${k}`, bestEntry);
      });
    });
    best.push(row);
  });
  const chosen: Candidate[] = new Array(sounded.length);
  if (sounded.length > 0) {
    let stateKey: string | null = null;
    let lowest = Infinity;
    for (const [key, e] of best[sounded.length - 1]) {
      if (e.cost < lowest) {
        lowest = e.cost;
        stateKey = key;
      }
    }
    for (let j = sounded.length - 1; j >= 0 && stateKey !== null; j -= 1) {
      const k = Number(stateKey.split(",")[1]);
      chosen[j] = options[j][k];
      stateKey = best[j].get(stateKey)!.from;
    }
  }
  return chosen;
  };

  // Twice. The first pass finds the cheapest path; the second asks each
  // pitch to stay where the riff mostly plays it. A player who has been
  // taking E on the B string's 5th fret keeps taking it there, rather than
  // reaching for the same E on the G string because one note was nearer.
  const firstPass = solve(() => 0);
  const usual = new Map<number, Map<string, number>>();
  sounded.forEach((x, j) => {
    const midi = midiOf(x);
    const spot = `${firstPass[j].stringIndex}:${firstPass[j].fret}`;
    const counts = usual.get(midi) ?? new Map<string, number>();
    counts.set(spot, (counts.get(spot) ?? 0) + 1);
    usual.set(midi, counts);
  });
  const homeSpot = new Map<number, string>();
  for (const [midi, counts] of usual) {
    homeSpot.set(midi, [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  }
  const chosen = solve((j, c) => {
    const home = homeSpot.get(midiOf(sounded[j]));
    // Travelling riffs play the same pitch in different boxes on purpose
    if (!home || travels) return 0;
    return home === `${c.stringIndex}:${c.fret}` ? 0 : 1.2;
  });


  // ── Events ──
  const placed = new Map<Slot, RiffNote>();
  sounded.forEach((s, j) => {
    const midi = midiOf(s);
    placed.set(s, {
      stringIndex: chosen[j].stringIndex,
      fret: chosen[j].fret,
      midi,
      interval: s.chromatic !== undefined ? "ch" : pitches[s.idx].label,
    });
  });
  const events: RiffEvent[] = slots.map((s) => ({
    start: s.start,
    duration: s.duration,
    rest: s.rest,
    notes: s.rest ? [] : [placed.get(s)!],
  }));

  // ── Decorations ──
  // Chosen last, from the notes as they will actually be fingered, so every
  // mark is one a hand can make: a slur or slide needs the very next event to
  // be a note on the same string, close enough to reach.
  const lastSounded = events.map((e) => !e.rest).lastIndexOf(true);
  for (let i = 0; i < events.length; i += 1) {
    const e = events[i];
    if (e.rest) continue;
    const slot = slots[i];
    const n = e.notes[0];
    if (i === lastSounded) {
      e.technique = "vibrato"; // let the last note ring
      continue;
    }
    const next = events[i + 1];
    const nextSlot = slots[i + 1];
    // Bends: on the thinner strings, against a fret, on a note long enough to
    // reach pitch, and only up to another scale tone. Never on the pedal.
    const bendable =
      !slot.pedal &&
      n.interval !== "ch" &&
      n.stringIndex >= (feel.id === "blues" ? 2 : 3) &&
      n.fret >= 3 &&
      e.duration >= Q / 2;
    if (bendable) {
      const semis = semisOf(n.midi);
      const targets = BEND_TARGETS.filter((b) => b.from === semis && scaleSemis.has((semis + b.semis) % 12));
      const weight = beatStrength(e.start) >= 1 ? 1.3 : 0.7;
      if (targets.length > 0 && rng() < feel.bendChance * hard.techniqueScale * weight) {
        e.technique = "bend";
        e.bendAmount = pick(rng, targets).semis === 2 ? "full" : "half";
        const following = next !== undefined && !next.rest && e.start + e.duration === next.start;
        e.bendRelease =
          (following && next.notes[0].stringIndex === n.stringIndex) || rng() < (e.duration >= Q ? 0.5 : 0.3);
        continue;
      }
    }
    const joined = next !== undefined && !next.rest && e.start + e.duration === next.start;
    if (joined && !(slot.pedal && nextSlot.pedal)) {
      const to = next.notes[0];
      const df = to.fret - n.fret;
      // Moving to the next position along the string is what a slide is for:
      // the hand travels with the note instead of jumping
      const shifting = travels && slot.pos !== nextSlot.pos;
      if (to.stringIndex === n.stringIndex && df !== 0 && shifting && Math.abs(df) <= 7 && n.fret > 0 && to.fret > 0 && rng() < 0.75) {
        e.technique = "slide";
      } else if (to.stringIndex === n.stringIndex && df !== 0) {
        if (Math.abs(df) <= reach && rng() < feel.slurChance * hard.techniqueScale) {
          e.technique = df > 0 ? "hammer" : "pull";
        } else if (
          Math.abs(df) >= 2 &&
          Math.abs(df) <= 5 &&
          n.fret > 0 &&
          to.fret > 0 &&
          rng() < feel.slideChance * hard.techniqueScale
        ) {
          e.technique = "slide";
        }
      }
    }
    // Singing feels let their long notes shake
    if (!e.technique && feel.id === "melodic" && e.duration >= Q * 2 && rng() < 0.5) e.technique = "vibrato";
  }

  // The frets the riff covers: the box, widened to any note played outside it
  const frets = [...placed.values()].map((n) => n.fret).filter((f) => f > 0);
  const startFret = Math.min(box.start, ...frets);
  const endFret = Math.max(lastBox.end, ...frets);
  return { scale, key, boxNumber, span: positions.length, startFret, endFret, feel, bars, complexity, events };
}

// The riff of the day, seeded from the date the same way the chord chart is
export function riffSeed(dateISO: string, variant: number): number {
  return hashStringToInt(`${dateISO}:riff`) + variant * 7919;
}
