import {
  ChartKey,
  ChordQuality,
  MAJOR_CHART_KEYS,
  Progression,
  ProgressionChord,
  rootNameForDegree,
  spellInterval,
} from "./chords";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ScaleTone = {
  semis: number; // semitones above the root
  degree: number; // scale degree (1-7) used for note spelling
  label: string; // interval label shown in "Intervals" mode ("R", "b3", "#4", ...)
};

export type ScaleDef = {
  id: string;
  name: string;
  description: string;
  tones: ScaleTone[];
};

export type ScaleNotePos = {
  stringIndex: number; // 0 = low E (string 6) .. 5 = high E (string 1)
  fret: number; // 0 = open
  interval: string;
  note: string;
  isRoot: boolean;
};

export type ScaleBox = { number: number; start: number; end: number }; // fret window

export type ScaleDiagram = {
  scale: ScaleDef;
  key: ChartKey;
  notes: ScaleNotePos[];
  boxes: ScaleBox[];
  boxNumbers: number[]; // distinct box numbers in order
};

export const FRET_COUNT = 21;

// Scales can start on any of the 12 roots; reuse the major-key spellings.
export const SCALE_KEYS: ChartKey[] = MAJOR_CHART_KEYS;

// ── Scale library ─────────────────────────────────────────────────────────────

const T = (semis: number, degree: number, label: string): ScaleTone => ({ semis, degree, label });

export const SCALES: ScaleDef[] = [
  {
    id: "major", name: "Major (Ionian)",
    description: "The home base of Western music — do re mi, resolved and bright.",
    tones: [T(0,1,"R"), T(2,2,"2"), T(4,3,"3"), T(5,4,"4"), T(7,5,"5"), T(9,6,"6"), T(11,7,"7")],
  },
  {
    id: "natural-minor", name: "Natural Minor (Aeolian)",
    description: "The relative minor — same notes as major, gravity shifted to the sixth degree.",
    tones: [T(0,1,"R"), T(2,2,"2"), T(3,3,"b3"), T(5,4,"4"), T(7,5,"5"), T(8,6,"b6"), T(10,7,"b7")],
  },
  {
    id: "major-pentatonic", name: "Major Pentatonic",
    description: "Major minus the tension tones — country, folk, and happy solos live here.",
    tones: [T(0,1,"R"), T(2,2,"2"), T(4,3,"3"), T(7,5,"5"), T(9,6,"6")],
  },
  {
    id: "minor-pentatonic", name: "Minor Pentatonic",
    description: "The five-note workhorse of rock and blues. Learn all five boxes and the neck is yours.",
    tones: [T(0,1,"R"), T(3,3,"b3"), T(5,4,"4"), T(7,5,"5"), T(10,7,"b7")],
  },
  {
    id: "blues", name: "Blues Scale",
    description: "Minor pentatonic plus the b5 'blue note' — pure attitude between 4 and 5.",
    tones: [T(0,1,"R"), T(3,3,"b3"), T(5,4,"4"), T(6,5,"b5"), T(7,5,"5"), T(10,7,"b7")],
  },
  {
    id: "major-blues", name: "Major Blues Scale",
    description: "Major pentatonic with a sly b3 slide — the sweet-and-dirty country-blues sound.",
    tones: [T(0,1,"R"), T(2,2,"2"), T(3,3,"b3"), T(4,3,"3"), T(7,5,"5"), T(9,6,"6")],
  },
  {
    id: "dorian", name: "Dorian",
    description: "Minor with a bright natural 6 — Santana, funk, and modal jazz jams.",
    tones: [T(0,1,"R"), T(2,2,"2"), T(3,3,"b3"), T(5,4,"4"), T(7,5,"5"), T(9,6,"6"), T(10,7,"b7")],
  },
  {
    id: "phrygian", name: "Phrygian",
    description: "The b2 gives it a dark Spanish-metal edge right from the second note.",
    tones: [T(0,1,"R"), T(1,2,"b2"), T(3,3,"b3"), T(5,4,"4"), T(7,5,"5"), T(8,6,"b6"), T(10,7,"b7")],
  },
  {
    id: "lydian", name: "Lydian",
    description: "Major with a raised 4 — floating, cinematic, permanently airborne.",
    tones: [T(0,1,"R"), T(2,2,"2"), T(4,3,"3"), T(6,4,"#4"), T(7,5,"5"), T(9,6,"6"), T(11,7,"7")],
  },
  {
    id: "mixolydian", name: "Mixolydian",
    description: "Major with a b7 — the sound of dominant chords, rock jams, and jam bands.",
    tones: [T(0,1,"R"), T(2,2,"2"), T(4,3,"3"), T(5,4,"4"), T(7,5,"5"), T(9,6,"6"), T(10,7,"b7")],
  },
  {
    id: "locrian", name: "Locrian",
    description: "The darkest mode — b2 and b5. Home scale of the half-diminished chord.",
    tones: [T(0,1,"R"), T(1,2,"b2"), T(3,3,"b3"), T(5,4,"4"), T(6,5,"b5"), T(8,6,"b6"), T(10,7,"b7")],
  },
  {
    id: "harmonic-minor", name: "Harmonic Minor",
    description: "Natural minor with a raised 7 — that exotic step-and-a-half leap to the leading tone.",
    tones: [T(0,1,"R"), T(2,2,"2"), T(3,3,"b3"), T(5,4,"4"), T(7,5,"5"), T(8,6,"b6"), T(11,7,"7")],
  },
  {
    id: "melodic-minor", name: "Melodic Minor",
    description: "Minor with a major top half — the gateway to modern jazz harmony.",
    tones: [T(0,1,"R"), T(2,2,"2"), T(3,3,"b3"), T(5,4,"4"), T(7,5,"5"), T(9,6,"6"), T(11,7,"7")],
  },
  {
    id: "phrygian-dominant", name: "Phrygian Dominant",
    description: "Fifth mode of harmonic minor — flamenco, klezmer, and metal's favorite exotic dominant.",
    tones: [T(0,1,"R"), T(1,2,"b2"), T(4,3,"3"), T(5,4,"4"), T(7,5,"5"), T(8,6,"b6"), T(10,7,"b7")],
  },
  {
    id: "lydian-dominant", name: "Lydian Dominant",
    description: "Mixolydian with a #4 — the go-to color for tritone-sub and bII7 chords.",
    tones: [T(0,1,"R"), T(2,2,"2"), T(4,3,"3"), T(6,4,"#4"), T(7,5,"5"), T(9,6,"6"), T(10,7,"b7")],
  },
  {
    id: "altered", name: "Altered (Super Locrian)",
    description: "Every tension a V7 can carry — b9, #9, b5, #5 — resolving hard to the I.",
    tones: [T(0,1,"R"), T(1,2,"b9"), T(3,2,"#9"), T(4,3,"3"), T(6,5,"b5"), T(8,6,"#5"), T(10,7,"b7")],
  },
  {
    id: "whole-tone", name: "Whole Tone",
    description: "Six evenly spaced notes — dreamy, rootless, the classic 'dream sequence' blur.",
    tones: [T(0,1,"R"), T(2,2,"2"), T(4,3,"3"), T(6,4,"#4"), T(8,5,"#5"), T(10,7,"b7")],
  },
  {
    id: "dim-wh", name: "Diminished (Whole-Half)",
    description: "Alternating whole and half steps — the symmetric scale for diminished chords.",
    tones: [T(0,1,"R"), T(2,2,"2"), T(3,3,"b3"), T(5,4,"4"), T(6,5,"b5"), T(8,6,"b6"), T(9,6,"6"), T(11,7,"7")],
  },
  {
    id: "dim-hw", name: "Diminished (Half-Whole)",
    description: "Half-whole over a dominant chord: b9 and #9 with a natural 13 — spicy but sweet.",
    tones: [T(0,1,"R"), T(1,2,"b9"), T(3,2,"#9"), T(4,3,"3"), T(6,4,"#11"), T(7,5,"5"), T(9,6,"13"), T(10,7,"b7")],
  },
  {
    id: "hungarian-minor", name: "Hungarian Minor",
    description: "Harmonic minor with a #4 — two exotic gaps, maximum drama.",
    tones: [T(0,1,"R"), T(2,2,"2"), T(3,3,"b3"), T(6,4,"#4"), T(7,5,"5"), T(8,6,"b6"), T(11,7,"7")],
  },
  {
    id: "double-harmonic", name: "Double Harmonic",
    description: "b2 and natural 7 around a major 3rd — the 'Misirlou' surf-exotic sound.",
    tones: [T(0,1,"R"), T(1,2,"b2"), T(4,3,"3"), T(5,4,"4"), T(7,5,"5"), T(8,6,"b6"), T(11,7,"7")],
  },
  {
    id: "bebop-dominant", name: "Bebop Dominant",
    description: "Mixolydian plus a passing natural 7 so eighth-note lines land chord tones on the beat.",
    tones: [T(0,1,"R"), T(2,2,"2"), T(4,3,"3"), T(5,4,"4"), T(7,5,"5"), T(9,6,"6"), T(10,7,"b7"), T(11,7,"7")],
  },
  {
    id: "bebop-major", name: "Bebop Major",
    description: "Major plus a passing #5 — the swing-era sound of Barry Harris's sixth-diminished world.",
    tones: [T(0,1,"R"), T(2,2,"2"), T(4,3,"3"), T(5,4,"4"), T(7,5,"5"), T(8,5,"#5"), T(9,6,"6"), T(11,7,"7")],
  },
  {
    id: "harmonic-major", name: "Harmonic Major",
    description: "Major with a b6 — the bittersweet 'borrowed iv' color as a full scale.",
    tones: [T(0,1,"R"), T(2,2,"2"), T(4,3,"3"), T(5,4,"4"), T(7,5,"5"), T(8,6,"b6"), T(11,7,"7")],
  },
  {
    id: "hirajoshi", name: "Hirajoshi",
    description: "A Japanese pentatonic — five notes, instant koto. Let the open intervals ring.",
    tones: [T(0,1,"R"), T(2,2,"2"), T(3,3,"b3"), T(7,5,"5"), T(8,6,"b6")],
  },
  {
    id: "egyptian", name: "Egyptian (Suspended Pentatonic)",
    description: "Pentatonic with no 3rd at all — hollow, ancient, neither major nor minor.",
    tones: [T(0,1,"R"), T(2,2,"2"), T(5,4,"4"), T(7,5,"5"), T(10,7,"b7")],
  },
  {
    id: "in-sen", name: "In Sen",
    description: "A Japanese scale with a b2 — dark and delicate at the same time.",
    tones: [T(0,1,"R"), T(1,2,"b2"), T(5,4,"4"), T(7,5,"5"), T(10,7,"b7")],
  },
];

// ── Diagram building ──────────────────────────────────────────────────────────

// Open-string pitch classes, low E (index 0) to high E (index 5)
const OPEN_STRING_PC_LOW_TO_HIGH = [4, 9, 2, 7, 11, 4];

export function buildScaleDiagram(scale: ScaleDef, key: ChartKey): ScaleDiagram {
  const byPc = new Map<number, ScaleTone>();
  for (const tone of scale.tones) byPc.set((key.pitchClass + tone.semis) % 12, tone);

  const notes: ScaleNotePos[] = [];
  for (let s = 0; s < 6; s += 1) {
    for (let fret = 0; fret <= FRET_COUNT; fret += 1) {
      const pc = (OPEN_STRING_PC_LOW_TO_HIGH[s] + fret) % 12;
      const tone = byPc.get(pc);
      if (!tone) continue;
      notes.push({
        stringIndex: s,
        fret,
        interval: tone.label,
        note: spellInterval(key.label, key.pitchClass, tone.semis, tone.degree),
        isRoot: tone.semis === 0,
      });
    }
  }

  // One position box per scale tone, anchored where that tone sits on the low E
  // string (this is exactly the classic 5-box system for pentatonics). Each box
  // also repeats an octave up when it still fits on the neck.
  //
  // Four frets, one finger per fret. A fifth fret would reach notes that belong
  // to the next position — in A minor pentatonic it pulls in the E at the 9th
  // fret of the G string, which is the same pitch as the E already sitting under
  // the index finger on the B string, so you would never actually stretch for it.
  const boxes: ScaleBox[] = [];
  scale.tones.forEach((tone, idx) => {
    const base = ((key.pitchClass + tone.semis) % 12 - OPEN_STRING_PC_LOW_TO_HIGH[0] + 12) % 12;
    for (const start of [base, base + 12]) {
      if (start + 3 <= FRET_COUNT) boxes.push({ number: idx + 1, start, end: start + 3 });
    }
  });
  boxes.sort((a, b) => a.start - b.start || a.number - b.number);

  return {
    scale,
    key,
    notes,
    boxes,
    boxNumbers: scale.tones.map((_, i) => i + 1),
  };
}

// ── Scale harmonization ───────────────────────────────────────────────────────
// Builds "the chords in this scale": one chord per scale degree, using only
// notes the scale contains, preferring seventh chords. Degrees whose stacked
// tones don't form a chord we can voice (e.g. no third) are skipped.

// Chord tones each quality needs, as semitones above the chord root. A degree
// can only produce a quality when the scale contains every one of these.
export const CHORD_TONES: Record<ChordQuality, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  "7": [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  m7b5: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
  add9: [0, 2, 4, 7],
  aug: [0, 4, 8],
  aug7: [0, 4, 8, 10],
};

// Ordered simplest → richest so the quality cycler reads naturally.
const QUALITY_ORDER: ChordQuality[] = [
  "maj", "min", "aug", "add9", "7", "maj7", "m7", "m7b5", "dim7", "aug7",
];

// Every quality this degree supports, given the scale tones available above it.
export function qualitiesForDegree(rel: Set<number>): ChordQuality[] {
  return QUALITY_ORDER.filter((q) => CHORD_TONES[q].every((t) => rel.has(t)));
}

// The default chord for a degree: prefer a seventh chord, else a triad.
function qualityForDegree(rel: Set<number>): ChordQuality | null {
  const available = qualitiesForDegree(rel);
  if (available.length === 0) return null;
  const sevenths: ChordQuality[] = ["maj7", "7", "m7", "m7b5", "dim7", "aug7"];
  return available.find((q) => sevenths.includes(q)) ?? available[0];
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
const MINOR_QUALITIES: ChordQuality[] = ["min", "m7", "m7b5", "dim7"];

const QUALITY_RN_SUFFIX: Record<ChordQuality, string> = {
  maj: "", min: "", "7": "7", maj7: "maj7", m7: "7", m7b5: "ø7", dim7: "°7", add9: "add9",
  aug: "+", aug7: "+7",
};

export type ScaleChordDegree = {
  romanBase: string; // "I", "bVII" — casing applied per selected quality
  rootPc: number;
  rootName: string;
  qualities: ChordQuality[]; // every quality this degree supports, simple → rich
  defaultQualityIndex: number;
};

// One entry per scale degree that can form a chord, each carrying the full list
// of qualities available there so the UI can cycle through them.
export function scaleChordDegrees(scale: ScaleDef, key: ChartKey): ScaleChordDegree[] {
  const degrees: ScaleChordDegree[] = [];
  for (const tone of scale.tones) {
    const rel = new Set(scale.tones.map((t) => (t.semis - tone.semis + 12) % 12));
    const qualities = qualitiesForDegree(rel);
    if (qualities.length === 0) continue;

    const accidental = tone.label.startsWith("b") ? "b" : tone.label.startsWith("#") ? "#" : "";
    const preferred = qualityForDegree(rel);
    degrees.push({
      romanBase: `${accidental}${ROMAN[tone.degree - 1]}`,
      rootPc: (key.pitchClass + tone.semis) % 12,
      rootName: rootNameForDegree(key, tone.semis, tone.degree),
      qualities,
      defaultQualityIndex: preferred ? Math.max(0, qualities.indexOf(preferred)) : 0,
    });
  }
  return degrees;
}

// Roman numeral for a degree + quality pair (lowercase for minor qualities).
export function romanFor(romanBase: string, quality: ChordQuality): string {
  const accidental = romanBase.match(/^[b#]/)?.[0] ?? "";
  const numeral = romanBase.slice(accidental.length);
  const cased = MINOR_QUALITIES.includes(quality) ? numeral.toLowerCase() : numeral;
  return `${accidental}${cased}${QUALITY_RN_SUFFIX[quality]}`;
}

export function harmonizeScale(scale: ScaleDef): Progression {
  const chords: ProgressionChord[] = [];
  for (const tone of scale.tones) {
    const rel = new Set(scale.tones.map((t) => (t.semis - tone.semis + 12) % 12));
    const quality = qualityForDegree(rel);
    if (quality === null) continue;
    const accidental = tone.label.startsWith("b") ? "b" : tone.label.startsWith("#") ? "#" : "";
    const numeral = ROMAN[tone.degree - 1];
    const cased = MINOR_QUALITIES.includes(quality) ? numeral.toLowerCase() : numeral;
    chords.push({
      rn: `${accidental}${cased}${QUALITY_RN_SUFFIX[quality]}`,
      semis: tone.semis,
      quality,
    });
  }
  const isMinor = scale.tones.some((t) => t.semis === 3);
  return {
    id: `harmonized-${scale.id}`,
    name: `Chords of ${scale.name}`,
    mode: isMinor ? "minor" : "major",
    description:
      "Every chord this scale contains, built by stacking its own notes on each degree. Degrees that don't form a standard chord are left out.",
    chords,
    allowedSemis: scale.tones.map((t) => t.semis),
  };
}
