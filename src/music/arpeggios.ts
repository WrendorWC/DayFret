import { ChartKey, spellInterval } from "./chords";
import { FRET_COUNT, ScaleDef } from "./scales";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ArpeggioSize = 3 | 4;

export type ArpeggioType = {
  id: string;
  suffix: string; // appended to the root for the display name
  name: string; // spoken name, e.g. "Half-diminished"
  tones: number[]; // semitones above the root
  size: ArpeggioSize;
};

export type ArpeggioNote = {
  stringIndex: number; // 0 = low E .. 5 = high E
  fret: number;
  interval: string;
  note: string;
  isRoot: boolean;
};

// One place on the neck where a shape sits. The same shape usually fits twice —
// once low and again an octave up — and both are worth showing.
export type ArpeggioBox = {
  rootFret: number;
  startFret: number; // may sit below baseStart where the hand stretches back
  endFret: number; // may sit above baseEnd where the pinky reaches
  baseStart: number; // the four frets the hand is actually centred on
  baseEnd: number;
  stretched: boolean;
};

// A playing position: the root taken on a chosen string with a chosen finger,
// which fixes a four-fret window (one finger per fret) around it.
export type ArpeggioPosition = {
  rootString: 6 | 5 | 4 | 3;
  finger: 1 | 2 | 3 | 4;
  boxes: ArpeggioBox[]; // every octave of this shape that fits on the neck
  // The lowest box, kept flat for convenience
  rootFret: number;
  startFret: number;
  endFret: number;
  baseStart: number;
  baseEnd: number;
  stretched: boolean;
  // Fingering across every box, keyed "stringIndex:fret"
  fingers: Map<string, number>;
};

export type ArpeggioEntry = {
  romanBase: string;
  rootPc: number;
  rootName: string;
  type: ArpeggioType;
  name: string; // "Cmaj7"
  notes: ArpeggioNote[]; // every occurrence across the whole neck
  positions: ArpeggioPosition[]; // the 12 root-string × finger combinations
};

// ── Arpeggio catalogue ────────────────────────────────────────────────────────
// Ordered by preference: the first type whose tones all exist in the scale at a
// given degree is the one that degree arpeggiates.

const TRIADS: ArpeggioType[] = [
  { id: "maj", suffix: "", name: "Major triad", tones: [0, 4, 7], size: 3 },
  { id: "min", suffix: "m", name: "Minor triad", tones: [0, 3, 7], size: 3 },
  { id: "dim", suffix: "dim", name: "Diminished triad", tones: [0, 3, 6], size: 3 },
  { id: "aug", suffix: "aug", name: "Augmented triad", tones: [0, 4, 8], size: 3 },
];

const SEVENTHS: ArpeggioType[] = [
  { id: "maj7", suffix: "maj7", name: "Major 7th", tones: [0, 4, 7, 11], size: 4 },
  { id: "7", suffix: "7", name: "Dominant 7th", tones: [0, 4, 7, 10], size: 4 },
  { id: "m7", suffix: "m7", name: "Minor 7th", tones: [0, 3, 7, 10], size: 4 },
  { id: "mMaj7", suffix: "mMaj7", name: "Minor-major 7th", tones: [0, 3, 7, 11], size: 4 },
  { id: "m7b5", suffix: "m7♭5", name: "Half-diminished", tones: [0, 3, 6, 10], size: 4 },
  { id: "dim7", suffix: "dim7", name: "Diminished 7th", tones: [0, 3, 6, 9], size: 4 },
  { id: "aug7", suffix: "7♯5", name: "Augmented 7th", tones: [0, 4, 8, 10], size: 4 },
  { id: "augMaj7", suffix: "maj7♯5", name: "Augmented major 7th", tones: [0, 4, 8, 11], size: 4 },
  { id: "6", suffix: "6", name: "Major 6th", tones: [0, 4, 7, 9], size: 4 },
  { id: "m6", suffix: "m6", name: "Minor 6th", tones: [0, 3, 7, 9], size: 4 },
];

const TONE_LABEL: Record<number, string> = {
  0: "R", 3: "b3", 4: "3", 6: "b5", 7: "5", 8: "#5", 9: "6", 10: "b7", 11: "7",
};
const TONE_DEGREE: Record<number, number> = {
  0: 1, 3: 3, 4: 3, 6: 5, 7: 5, 8: 5, 9: 6, 10: 7, 11: 7,
};

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
const MINOR_TYPES = new Set(["min", "dim", "m7", "mMaj7", "m7b5", "dim7", "m6"]);

const OPEN_STRING_PC = [4, 9, 2, 7, 11, 4];
const OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64];

export const ROOT_STRINGS: Array<6 | 5 | 4 | 3> = [6, 5, 4, 3];
export const ROOT_FINGERS: Array<1 | 2 | 3 | 4> = [1, 2, 3, 4];

// Spoken name for each root string, used in captions and aria labels
export const STRING_ORDINAL: Record<number, string> = {
  6: "6th", 5: "5th", 4: "4th", 3: "3rd",
};

export const noteKey = (stringIndex: number, fret: number): string => `${stringIndex}:${fret}`;

// ── Positions ─────────────────────────────────────────────────────────────────
// Taking the root on a given string with a given finger fixes the hand: with
// one finger per fret, the window starts (finger - 1) frets below the root.
// Four root strings × four fingers gives the sixteen standard positions.
//
// A strict four-fret box, though, sometimes leaves a string with no chord tone
// at all, which breaks the run: an E minor rooted on the 5th string at fret 7
// taken with the pinky covers frets 4-7, and the top string only offers B —
// the G a third below it sits at fret 3, one fret outside. So the window is
// widened just far enough to give every string a note, with the index finger
// reaching back and the pinky reaching forward.

const MAX_SPAN = 6; // frets from the lowest to the highest note of a shape

// Works out the window for one root fret: the four frets the hand covers, then
// widened until the run has no missing chord tone.
function makeBox(rootFret: number, finger: number, tonePcs: Set<number>): ArpeggioBox {
  const baseStart = rootFret - (finger - 1);
  const baseEnd = baseStart + 3;
  let startFret = baseStart;
  let endFret = baseEnd;

  const playable = (lo: number, hi: number): Set<number> => {
    const out = new Set<number>();
    for (let st = 0; st < 6; st += 1) {
      for (let f = Math.max(0, lo); f <= Math.min(FRET_COUNT, hi); f += 1) {
        const midi = OPEN_STRING_MIDI[st] + f;
        if (tonePcs.has(midi % 12)) out.add(midi);
      }
    }
    return out;
  };

  for (let guard = 0; guard < 8; guard += 1) {
    const have = playable(startFret, endFret);
    if (have.size === 0) break;
    const lo = Math.min(...have);
    const hi = Math.max(...have);

    const holes: number[] = [];
    for (let midi = lo + 1; midi < hi; midi += 1) {
      if (tonePcs.has(midi % 12) && !have.has(midi)) holes.push(midi);
    }
    if (holes.length === 0) break;

    // Where reaching back and reaching forward cost the same, reach back:
    // pulling the index down is an easier shape than pushing the pinky past
    // the box.
    let best: { down: number; up: number } | null = null;
    for (const midi of holes) {
      for (let st = 0; st < 6; st += 1) {
        const f = midi - OPEN_STRING_MIDI[st];
        if (f < 0 || f > FRET_COUNT) continue;
        const down = f < startFret ? startFret - f : 0;
        const up = f > endFret ? f - endFret : 0;
        if (down === 0 && up === 0) continue;
        if (endFret + up - (startFret - down) + 1 > MAX_SPAN) continue;
        const cost = down + up;
        const bestCost = best === null ? Infinity : best.down + best.up;
        if (cost < bestCost || (cost === bestCost && best !== null && down > best.down)) {
          best = { down, up };
        }
      }
    }
    if (best === null) break;
    startFret -= best.down;
    endFret += best.up;
  }

  startFret = Math.max(0, startFret);
  endFret = Math.min(FRET_COUNT, endFret);

  return {
    rootFret,
    startFret,
    endFret,
    baseStart,
    baseEnd,
    stretched: startFret < baseStart || endFret > baseEnd,
  };
}

function buildPositions(rootPc: number, tonePcs: Set<number>): ArpeggioPosition[] {
  const positions: ArpeggioPosition[] = [];

  for (const rootString of ROOT_STRINGS) {
    const stringIndex = 6 - rootString; // 6th string is index 0
    // Open strings are included: a root at fret 0 only produces a window for
    // the index finger (anything higher would need a negative fret), which is
    // exactly right — the open string is played with no finger at all, and the
    // rest of the shape sits in first position.
    const rootFrets: number[] = [];
    for (let fret = 0; fret <= FRET_COUNT; fret += 1) {
      if ((OPEN_STRING_PC[stringIndex] + fret) % 12 === rootPc) rootFrets.push(fret);
    }

    for (const finger of ROOT_FINGERS) {
      // Every root on this string that leaves a whole window on the neck, so a
      // shape that also fits an octave up gets a second box rather than being
      // silently dropped.
      const usable = rootFrets.filter(
        (f) => f - (finger - 1) >= 0 && f - (finger - 1) + 3 <= FRET_COUNT,
      );
      if (usable.length === 0) continue;

      const boxes = usable.map((rootFret) => makeBox(rootFret, finger, tonePcs));

      const fingers = new Map<string, number>();
      for (const box of boxes) {
        for (let st = 0; st < 6; st += 1) {
          for (let fret = box.startFret; fret <= box.endFret; fret += 1) {
            if (fret === 0) continue; // open strings take no finger
            const f =
              fret < box.baseStart ? 1 : fret > box.baseEnd ? 4 : fret - box.baseStart + 1;
            fingers.set(noteKey(st, fret), f);
          }
        }
      }

      const primary = boxes[0];
      positions.push({
        rootString,
        finger,
        boxes,
        rootFret: primary.rootFret,
        startFret: primary.startFret,
        endFret: primary.endFret,
        baseStart: primary.baseStart,
        baseEnd: primary.baseEnd,
        stretched: boxes.some((b) => b.stretched),
        fingers,
      });
    }
  }

  return positions;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function buildArpeggios(
  scale: ScaleDef,
  key: ChartKey,
  size: ArpeggioSize,
): ArpeggioEntry[] {
  const catalogue = size === 3 ? TRIADS : SEVENTHS;
  const entries: ArpeggioEntry[] = [];

  for (const tone of scale.tones) {
    const rel = new Set(scale.tones.map((t) => (t.semis - tone.semis + 12) % 12));
    const type = catalogue.find((c) => c.tones.every((t) => rel.has(t)));
    if (!type) continue;

    const rootPc = (key.pitchClass + tone.semis) % 12;
    const rootName = spellInterval(key.label, key.pitchClass, tone.semis, tone.degree);
    const isDim7 = type.id === "dim7";

    // Every place this arpeggio's tones fall on the neck
    const byPc = new Map<number, number>();
    for (const t of type.tones) byPc.set((rootPc + t) % 12, t);

    const notes: ArpeggioNote[] = [];
    for (let s = 0; s < 6; s += 1) {
      for (let fret = 0; fret <= FRET_COUNT; fret += 1) {
        const semis = byPc.get((OPEN_STRING_PC[s] + fret) % 12);
        if (semis === undefined) continue;
        const degree = isDim7 && semis === 9 ? 7 : TONE_DEGREE[semis];
        notes.push({
          stringIndex: s,
          fret,
          interval: isDim7 && semis === 9 ? "bb7" : TONE_LABEL[semis],
          note: spellInterval(rootName, rootPc, semis, degree),
          isRoot: semis === 0,
        });
      }
    }

    const accidental = tone.label.startsWith("b") ? "b" : tone.label.startsWith("#") ? "#" : "";
    const numeral = ROMAN[tone.degree - 1];
    const cased = MINOR_TYPES.has(type.id) ? numeral.toLowerCase() : numeral;

    entries.push({
      romanBase: `${accidental}${cased}`,
      rootPc,
      rootName,
      type,
      name: `${rootName}${type.suffix}`,
      notes,
      positions: buildPositions(rootPc, new Set(byPc.keys())),
    });
  }

  return entries;
}
