import { ChartKey, spellInterval } from "./chords";
import { FRET_COUNT, ScaleDef, ScaleDiagram, ScaleNotePos, SCALES } from "./scales";
import { OPEN_STRING_MIDI } from "./tuning";

// ── Chord dictionary ──────────────────────────────────────────────────────────
// Any chord type on any root, voiced by searching the neck rather than from a
// hand-written shape list. The progression charts keep their curated library;
// this is the "look up any chord" reference.

type StringArray<T> = [T, T, T, T, T, T];

export type FinderTone = {
  semis: number; // semitones above the root
  degree: number; // scale degree used to spell the note (9 → 2, 11 → 4, 13 → 6)
  label: string; // "R", "b3", "#11", ...
  // Tones a guitarist routinely leaves out when there aren't enough fingers or
  // strings: the plain 5th almost always, and the 9th/11th under a 13th.
  optional?: boolean;
};

export type ChordCategory =
  | "Common"
  | "Triad"
  | "Fifth"
  | "Suspended"
  | "Added tone"
  | "Sixth"
  | "Seventh"
  | "Ninth"
  | "Eleventh"
  | "Thirteenth";

export type FinderChordType = {
  id: string;
  category: Exclude<ChordCategory, "Common">;
  suffix: string; // appended to the root: "m7b5"
  name: string; // spoken name: "half-diminished seventh"
  tones: FinderTone[];
};

const t = (semis: number, degree: number, label: string, optional = false): FinderTone => ({
  semis,
  degree,
  label,
  optional,
});

const R = t(0, 1, "R");
const b3 = t(3, 3, "b3");
const M3 = t(4, 3, "3");
const P5 = t(7, 5, "5", true); // the 5th adds little colour, so it may be dropped
const P5req = t(7, 5, "5");
const b5 = t(6, 5, "b5");
const s5 = t(8, 5, "#5");
const b7 = t(10, 7, "b7");
const M7 = t(11, 7, "7");
const M6 = t(9, 6, "6");

export const FINDER_CHORD_TYPES: FinderChordType[] = [
  // Triads — three notes, nothing to omit
  { id: "maj", category: "Triad", suffix: "", name: "major", tones: [R, M3, P5req] },
  { id: "min", category: "Triad", suffix: "m", name: "minor", tones: [R, b3, P5req] },
  { id: "dim", category: "Triad", suffix: "dim", name: "diminished", tones: [R, b3, b5] },
  { id: "aug", category: "Triad", suffix: "aug", name: "augmented", tones: [R, M3, s5] },

  { id: "5", category: "Fifth", suffix: "5", name: "power chord", tones: [R, P5req] },

  { id: "sus2", category: "Suspended", suffix: "sus2", name: "suspended second", tones: [R, t(2, 2, "2"), P5req] },
  { id: "sus4", category: "Suspended", suffix: "sus4", name: "suspended fourth", tones: [R, t(5, 4, "4"), P5req] },
  { id: "7sus4", category: "Suspended", suffix: "7sus4", name: "seventh, suspended fourth", tones: [R, t(5, 4, "4"), P5, b7] },
  { id: "9sus4", category: "Suspended", suffix: "9sus4", name: "ninth, suspended fourth", tones: [R, t(5, 4, "4"), P5, b7, t(2, 2, "9")] },

  { id: "add9", category: "Added tone", suffix: "add9", name: "major, added ninth", tones: [R, M3, P5, t(2, 2, "9")] },
  { id: "madd9", category: "Added tone", suffix: "m(add9)", name: "minor, added ninth", tones: [R, b3, P5, t(2, 2, "9")] },
  { id: "add11", category: "Added tone", suffix: "add11", name: "major, added eleventh", tones: [R, M3, P5, t(5, 4, "11")] },
  { id: "madd11", category: "Added tone", suffix: "m(add11)", name: "minor, added eleventh", tones: [R, b3, P5, t(5, 4, "11")] },

  { id: "6", category: "Sixth", suffix: "6", name: "major sixth", tones: [R, M3, P5, M6] },
  { id: "m6", category: "Sixth", suffix: "m6", name: "minor sixth", tones: [R, b3, P5, M6] },
  { id: "69", category: "Sixth", suffix: "6/9", name: "six-nine", tones: [R, M3, P5, M6, t(2, 2, "9")] },
  { id: "m69", category: "Sixth", suffix: "m6/9", name: "minor six-nine", tones: [R, b3, P5, M6, t(2, 2, "9")] },

  { id: "maj7", category: "Seventh", suffix: "maj7", name: "major seventh", tones: [R, M3, P5, M7] },
  { id: "7", category: "Seventh", suffix: "7", name: "dominant seventh", tones: [R, M3, P5, b7] },
  { id: "m7", category: "Seventh", suffix: "m7", name: "minor seventh", tones: [R, b3, P5, b7] },
  { id: "mMaj7", category: "Seventh", suffix: "m(maj7)", name: "minor-major seventh", tones: [R, b3, P5, M7] },
  { id: "m7b5", category: "Seventh", suffix: "m7♭5", name: "half-diminished seventh", tones: [R, b3, b5, b7] },
  // The diminished seventh is a double-flat 7th, which sounds like a 6th
  { id: "dim7", category: "Seventh", suffix: "dim7", name: "diminished seventh", tones: [R, b3, b5, t(9, 7, "bb7")] },
  { id: "7#5", category: "Seventh", suffix: "7♯5", name: "augmented seventh", tones: [R, M3, s5, b7] },
  { id: "7b5", category: "Seventh", suffix: "7♭5", name: "seventh, flat five", tones: [R, M3, b5, b7] },
  { id: "maj7#5", category: "Seventh", suffix: "maj7♯5", name: "augmented major seventh", tones: [R, M3, s5, M7] },

  { id: "maj9", category: "Ninth", suffix: "maj9", name: "major ninth", tones: [R, M3, P5, M7, t(2, 2, "9")] },
  { id: "9", category: "Ninth", suffix: "9", name: "dominant ninth", tones: [R, M3, P5, b7, t(2, 2, "9")] },
  { id: "m9", category: "Ninth", suffix: "m9", name: "minor ninth", tones: [R, b3, P5, b7, t(2, 2, "9")] },
  { id: "7b9", category: "Ninth", suffix: "7♭9", name: "seventh, flat nine", tones: [R, M3, P5, b7, t(1, 2, "b9")] },
  { id: "7#9", category: "Ninth", suffix: "7♯9", name: "seventh, sharp nine", tones: [R, M3, P5, b7, t(3, 2, "#9")] },

  // An eleventh chord's 3rd clashes with the 11th a half step away, so the
  // dominant 11 is usually played without it (it then sounds like 9sus4).
  { id: "11", category: "Eleventh", suffix: "11", name: "dominant eleventh", tones: [R, t(4, 3, "3", true), P5, b7, t(2, 2, "9", true), t(5, 4, "11")] },
  { id: "m11", category: "Eleventh", suffix: "m11", name: "minor eleventh", tones: [R, b3, P5, b7, t(2, 2, "9", true), t(5, 4, "11")] },
  { id: "maj7#11", category: "Eleventh", suffix: "maj7♯11", name: "major seventh, sharp eleven", tones: [R, M3, P5, M7, t(6, 4, "#11")] },
  { id: "7#11", category: "Eleventh", suffix: "7♯11", name: "seventh, sharp eleven", tones: [R, M3, P5, b7, t(6, 4, "#11")] },

  // Thirteenths keep R, 3, b7 and the 13th; the 5th and 9th are optional and
  // the 11th is left out altogether, as it is in practice.
  { id: "13", category: "Thirteenth", suffix: "13", name: "dominant thirteenth", tones: [R, M3, P5, b7, t(2, 2, "9", true), t(9, 6, "13")] },
  { id: "maj13", category: "Thirteenth", suffix: "maj13", name: "major thirteenth", tones: [R, M3, P5, M7, t(2, 2, "9", true), t(9, 6, "13")] },
  { id: "m13", category: "Thirteenth", suffix: "m13", name: "minor thirteenth", tones: [R, b3, P5, b7, t(2, 2, "9", true), t(9, 6, "13")] },
];

// The everyday shortlist, in the order a player reaches for them.
const COMMON_IDS = ["maj", "min", "7", "maj7", "m7", "5", "sus2", "sus4", "7sus4", "add9", "6", "m6", "9", "dim", "aug", "m7b5", "dim7"];

export const CHORD_CATEGORIES: ChordCategory[] = [
  "Common",
  "Triad",
  "Fifth",
  "Suspended",
  "Added tone",
  "Sixth",
  "Seventh",
  "Ninth",
  "Eleventh",
  "Thirteenth",
];

export function typesInCategory(category: ChordCategory): FinderChordType[] {
  if (category === "Common") {
    return COMMON_IDS.map((id) => FINDER_CHORD_TYPES.find((c) => c.id === id)!);
  }
  return FINDER_CHORD_TYPES.filter((c) => c.category === category);
}

export function findChordType(id: string): FinderChordType {
  return FINDER_CHORD_TYPES.find((c) => c.id === id) ?? FINDER_CHORD_TYPES[0];
}

// ── Roots ─────────────────────────────────────────────────────────────────────

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

export function rootNames(accidentals: "sharp" | "flat"): string[] {
  return accidentals === "sharp" ? SHARP_NAMES : FLAT_NAMES;
}

// Pretty accidentals for a note name: "Bb" → "B♭", "F#" → "F♯"
export const prettyNote = (s: string): string =>
  s.length > 1 ? s[0] + s.slice(1).replace(/#/g, "♯").replace(/b/g, "♭") : s;

// ── Spelling ──────────────────────────────────────────────────────────────────

export type SpelledTone = FinderTone & { note: string; pc: number };

export function spellChord(type: FinderChordType, rootPc: number, rootName: string): SpelledTone[] {
  return type.tones.map((tone) => ({
    ...tone,
    pc: (rootPc + tone.semis) % 12,
    note: spellInterval(rootName, rootPc, tone.semis, tone.degree),
  }));
}

// Interval names for a bass note that isn't in the chord (C/D, C/F#, ...)
const GENERIC_LABELS = ["R", "b9", "9", "b3", "3", "11", "#11", "5", "b13", "13", "b7", "7"];
const GENERIC_DEGREES = [1, 2, 2, 3, 3, 4, 4, 5, 6, 6, 7, 7];

// ── Voicing search ────────────────────────────────────────────────────────────

export type FinderVoicing = {
  name: string; // "Cmaj7/E"
  frets: StringArray<number | null>;
  fingers: StringArray<number | null>;
  intervals: StringArray<string | null>;
  notes: StringArray<string | null>;
  baseFret: number;
  numFrets: number;
  score: number; // lower is easier
  position: number; // lowest fretted note, for ordering along the neck
  barre: boolean;
};

const MAX_FRET = 15; // past here the frets get too narrow for chord grips
const MAX_SPAN = 3; // four frets under the hand, one per finger

// Fingers for a grip, or null if it needs more than four. A grip with more
// fretted notes than fingers is only possible with a barre: the index lies
// across every string at the lowest fret, provided nothing between the
// outermost of those strings is open or muted (the barre would sound it).
// Failing that, a ring- or pinky-finger partial barre across adjacent strings
// at the same fret (the A-shape's 2-2-2) takes the rest.
function fingerGrip(frets: StringArray<number | null>): { fingers: StringArray<number | null>; barre: boolean } | null {
  const fretted = frets
    .map((f, s) => ({ f, s }))
    .filter((n): n is { f: number; s: number } => n.f !== null && n.f > 0);
  const fingers: StringArray<number | null> = [null, null, null, null, null, null];
  if (fretted.length === 0) return { fingers, barre: false };

  const minF = Math.min(...fretted.map((n) => n.f));

  type Unit = { fret: number; strings: number[] };
  let units: Unit[] = fretted.map((n) => ({ fret: n.f, strings: [n.s] }));
  let barre = false;

  if (units.length > 4) {
    const atMin = fretted.filter((n) => n.f === minF).map((n) => n.s);
    const lo = Math.min(...atMin);
    const hi = Math.max(...atMin);
    let ok = atMin.length >= 2;
    for (let s = lo; s <= hi && ok; s += 1) {
      const f = frets[s];
      if (f === null || f < minF) ok = false;
    }
    if (ok) {
      barre = true;
      units = [
        { fret: minF, strings: atMin },
        ...fretted.filter((n) => n.f !== minF).map((n) => ({ fret: n.f, strings: [n.s] })),
      ];
    }
  }

  if (units.length > 4) {
    // Merge runs of adjacent strings stopped at the same higher fret
    const merged: Unit[] = [];
    for (const u of [...units].sort((a, b) => a.fret - b.fret || a.strings[0] - b.strings[0])) {
      const last = merged[merged.length - 1];
      if (
        last &&
        last.fret === u.fret &&
        u.strings[0] === last.strings[last.strings.length - 1] + 1
      ) {
        last.strings.push(...u.strings);
      } else {
        merged.push({ fret: u.fret, strings: [...u.strings] });
      }
    }
    units = merged;
  }

  if (units.length > 4) return null;

  // Three separate fingers side by side on one fret, with a fourth reaching
  // past them, means the fingers have to cross — not a real grip.
  const perFret = new Map<number, number>();
  for (const u of units) perFret.set(u.fret, (perFret.get(u.fret) ?? 0) + 1);
  if ([...perFret.values()].some((n) => n >= 3) && units.length === 4) return null;

  // Fingers rise with the frets; each finger sits on or behind its natural
  // fret (index on the lowest fret, middle one fret up, and so on).
  units.sort((a, b) => a.fret - b.fret || a.strings[0] - b.strings[0]);
  let prev = 0;
  for (const u of units) {
    let finger = Math.max(prev + 1, 1 + (u.fret - minF));
    if (finger > 4) finger = prev + 1;
    if (finger > 4) return null;
    for (const s of u.strings) fingers[s] = finger;
    prev = finger;
  }

  return { fingers, barre: barre || units.some((u) => u.strings.length > 1) };
}

export function findVoicings(
  type: FinderChordType,
  rootPc: number,
  rootName: string,
  bassPc: number | null = null, // null = root in the bass
  bassName?: string,
): FinderVoicing[] {
  const tones = spellChord(type, rootPc, rootName);
  const chordPcs = new Set(tones.map((x) => x.pc));
  const requiredPcs = new Set(tones.filter((x) => !x.optional).map((x) => x.pc));
  const bass = bassPc ?? rootPc;
  const minStrings = type.tones.length === 2 ? 2 : 3;

  const labelFor = (pc: number): { label: string; note: string } => {
    const tone = tones.find((x) => x.pc === pc);
    if (tone) return { label: tone.label, note: tone.note };
    const semis = (pc - rootPc + 12) % 12;
    return {
      label: GENERIC_LABELS[semis],
      note: bassName ?? spellInterval(rootName, rootPc, semis, GENERIC_DEGREES[semis]),
    };
  };

  const results = new Map<string, FinderVoicing>();
  const frets: StringArray<number | null> = [null, null, null, null, null, null];

  const consider = (): void => {
    const sounding = frets.map((f, s) => ({ f, s })).filter((n): n is { f: number; s: number } => n.f !== null);
    if (sounding.length < minStrings) return;

    const have = new Set(sounding.map((n) => (OPEN_STRING_MIDI[n.s] + n.f) % 12));
    for (const pc of requiredPcs) if (!have.has(pc)) return;

    // Chords that reach no higher than the D string sound muddy; keep the
    // grips where the treble strings carry part of the chord.
    const top = sounding[sounding.length - 1].s;
    if (type.tones.length > 2 && top < 4) return;

    // A muted string inside the grip has to be damped by a neighbouring
    // finger; one is routine (jazz shells), two is asking a lot.
    const low = sounding[0].s;
    let inner = 0;
    for (let s = low; s <= top; s += 1) if (frets[s] === null) inner += 1;
    if (inner > 1) return;

    const grip = fingerGrip(frets);
    if (!grip) return;

    const fretted = sounding.filter((n) => n.f > 0).map((n) => n.f);
    const opens = sounding.length - fretted.length;
    const minF = fretted.length ? Math.min(...fretted) : 0;
    const maxF = fretted.length ? Math.max(...fretted) : 0;
    const span = fretted.length ? maxF - minF : 0;
    const fingersUsed = new Set(grip.fingers.filter((f) => f !== null)).size;

    // Easier and fuller is better. Open strings help in first position and
    // are a stretch of the ear (and the hand) once the grip moves up the neck.
    let score = span * 1.4 + inner * 2.5 + fingersUsed * 0.5 - sounding.length * 1.1;
    score += minF > 5 ? opens * 2 : -opens * 0.6;
    if (minF > 9) score += 1;
    // Standard grips put only the index on the lowest fret (alone or as a
    // barre); a second finger crowded onto that fret is a contortion.
    const lowFingers = new Set(sounding.filter((n) => n.f === minF && n.f > 0).map((n) => grip.fingers[n.s]));
    score += Math.max(0, lowFingers.size - 1) * 1.3;
    if (grip.barre) score += 0.6;

    const intervals = frets.map((f, s) => (f === null ? null : labelFor((OPEN_STRING_MIDI[s] + f) % 12).label)) as StringArray<string | null>;
    const notes = frets.map((f, s) => (f === null ? null : labelFor((OPEN_STRING_MIDI[s] + f) % 12).note)) as StringArray<string | null>;

    // Show from the nut when the whole grip fits in the first five frets
    const baseFret = fretted.length === 0 || maxF <= 5 ? 1 : minF;
    const numFrets = Math.max(4, maxF - baseFret + 1);

    const key = frets.join(",");
    results.set(key, {
      name: "",
      frets: [...frets] as StringArray<number | null>,
      fingers: grip.fingers,
      intervals,
      notes,
      baseFret,
      numFrets,
      score,
      position: fretted.length ? minF : 0,
      barre: grip.barre,
    });
  };

  // The lowest sounding string carries the bass; everything below it is muted.
  // Each string above may be muted or take any chord tone that keeps the
  // fretted notes inside a four-fret hand.
  const walk = (s: number, lo: number, hi: number): void => {
    if (s === 6) {
      consider();
      return;
    }
    frets[s] = null;
    walk(s + 1, lo, hi);
    for (let f = 0; f <= MAX_FRET; f += 1) {
      if (!chordPcs.has((OPEN_STRING_MIDI[s] + f) % 12)) continue;
      if (f > 0) {
        const nlo = Math.min(lo, f);
        const nhi = Math.max(hi, f);
        if (nhi - nlo > MAX_SPAN) continue;
        frets[s] = f;
        walk(s + 1, nlo, nhi);
      } else {
        frets[s] = 0;
        walk(s + 1, lo, hi);
      }
    }
    frets[s] = null;
  };

  for (let low = 0; low <= 3; low += 1) {
    for (let f = 0; f <= MAX_FRET; f += 1) {
      if ((OPEN_STRING_MIDI[low] + f) % 12 !== bass) continue;
      for (let s = 0; s < 6; s += 1) frets[s] = null;
      frets[low] = f;
      walk(low + 1, f > 0 ? f : Infinity, f > 0 ? f : -Infinity);
    }
  }

  const name = `${rootName}${type.suffix}${bassPc !== null && bassPc !== rootPc ? `/${bassName ?? labelFor(bassPc).note}` : ""}`;
  return [...results.values()].map((v) => ({ ...v, name }));
}

// The handful worth learning first: the easiest grips, spread along the neck
// so the list isn't six near-identical shapes at the same fret.
export function commonVoicings(all: FinderVoicing[], limit = 16): FinderVoicing[] {
  const ranked = [...all].sort((a, b) => a.score - b.score);
  // Grips much harder than the easiest one aren't "common", however few
  // there are; they stay in the full list.
  const ceiling = Math.max((ranked[0]?.score ?? 0) + 6, 2);
  const picked: FinderVoicing[] = [];
  const perBucket = new Map<string, number>();
  for (const v of ranked) {
    if (v.score > ceiling && picked.length >= 6) break;
    // The same grip with a string left out adds nothing to the shortlist
    if (picked.some((p) => v.frets.every((f, s) => f === null || f === p.frets[s]))) continue;
    const lowString = v.frets.findIndex((f) => f !== null);
    const bucket = `${lowString}:${Math.floor(v.position / 3)}`;
    const n = perBucket.get(bucket) ?? 0;
    if (n >= 3) continue;
    perBucket.set(bucket, n + 1);
    picked.push(v);
    if (picked.length >= limit) break;
  }
  return byPosition(picked);
}

export function allVoicings(all: FinderVoicing[], limit = 60): FinderVoicing[] {
  return byPosition([...all].sort((a, b) => a.score - b.score).slice(0, limit));
}

function byPosition(list: FinderVoicing[]): FinderVoicing[] {
  return [...list].sort(
    (a, b) =>
      a.position - b.position ||
      a.frets.findIndex((f) => f !== null) - b.frets.findIndex((f) => f !== null) ||
      a.score - b.score,
  );
}

// ── Chord tones across the neck ───────────────────────────────────────────────
// Shaped as a ScaleDiagram so the existing fretboard can draw it.

export function chordNeck(
  type: FinderChordType,
  rootPc: number,
  rootName: string,
  key: ChartKey,
): ScaleDiagram {
  const tones = spellChord(type, rootPc, rootName);
  const byPc = new Map(tones.map((x) => [x.pc, x]));
  const notes: ScaleNotePos[] = [];
  for (let s = 0; s < 6; s += 1) {
    for (let fret = 0; fret <= FRET_COUNT; fret += 1) {
      const tone = byPc.get((OPEN_STRING_MIDI[s] + fret) % 12);
      if (!tone) continue;
      notes.push({ stringIndex: s, fret, interval: tone.label, note: tone.note, isRoot: tone.semis === 0 });
    }
  }
  const scale: ScaleDef = {
    id: `chord-${type.id}`,
    name: `${rootName}${type.suffix}`,
    description: "",
    tones: tones.map((x) => ({ semis: x.semis, degree: x.degree, label: x.label })),
  };
  return { scale, key, notes, boxes: [], boxNumbers: [] };
}

// ── Matching scales ───────────────────────────────────────────────────────────
// Every scale in the library, on every root, that contains all of the chord's
// tones — what you can solo with over it. Scales on the chord's own root come
// first, since those are the ones that treat it as home.

export type ScaleMatch = { scale: ScaleDef; rootPc: number; onChordRoot: boolean };

export function matchingScales(type: FinderChordType, rootPc: number): ScaleMatch[] {
  const need = type.tones.map((x) => (rootPc + x.semis) % 12);
  const out: ScaleMatch[] = [];
  for (let offset = 0; offset < 12; offset += 1) {
    const scaleRoot = (rootPc + offset) % 12;
    for (const scale of SCALES) {
      const pcs = new Set(scale.tones.map((x) => (scaleRoot + x.semis) % 12));
      if (need.every((pc) => pcs.has(pc))) {
        out.push({ scale, rootPc: scaleRoot, onChordRoot: offset === 0 });
      }
    }
  }
  return out;
}

// ── Links from the rest of the app ────────────────────────────────────────────

// The progression charts and scale harmonizer name chords by their own
// quality ids. All but one are the dictionary's ids too; their "aug7" is the
// augmented seventh, which the dictionary spells 7♯5.
export function finderTypeForQuality(quality: string): string {
  if (quality === "aug7") return "7#5";
  return FINDER_CHORD_TYPES.some((c) => c.id === quality) ? quality : "maj";
}
