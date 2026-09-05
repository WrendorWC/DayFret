import { hashStringToInt } from "./daily";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChordQuality =
  | "maj"
  | "min"
  | "7"
  | "maj7"
  | "m7"
  | "m7b5"
  | "dim7"
  | "add9"
  | "aug"
  | "aug7";

// Strings are always listed low-to-high: index 0 = string 6 (low E), index 5 = string 1.
type StringArray<T> = [T, T, T, T, T, T];

export type ChordShape = {
  quality: ChordQuality;
  label: string; // voicing description shown under the diagram
  rootString: 3 | 4 | 5 | 6; // which string carries the root note
  // Fret offsets relative to the root note's fret on rootString; null = muted.
  rel: StringArray<number | null>;
  // Suggested fingering (1=index .. 4=pinky) for the fretted (movable) form.
  // Fingers landing on open strings are dropped and the rest renumbered.
  fingers: StringArray<number | null>;
  // Optional suffix override for extended voicings (e.g. a "7" shape voiced as "13")
  altSuffix?: string;
};

export type ProgressionChord = {
  rn: string; // roman numeral label, e.g. "ii7", "bVII"
  semis: number; // semitones above the key root
  quality: ChordQuality;
};

export type Progression = {
  id: string;
  name: string;
  mode: "major" | "minor";
  description: string;
  chords: ProgressionChord[];
  // A keyless entry is a static reference chart (e.g. Cowboy Chords): the key
  // picker is disabled and the chart's chords come from a fixed list.
  keyless?: boolean;
  // Semitones-above-the-key-root that voicings may use. Set by the scale
  // harmonizer so an extended shape can't introduce a note outside the scale
  // (e.g. an m9 voicing whose 9th is a b9 in that key).
  allowedSemis?: number[];
};

export type ChartKey = {
  label: string;
  pitchClass: number;
  accidentalPreference: "sharp" | "flat";
};

export type PlacedChord = {
  name: string; // "Cmaj9"
  rn: string;
  voicingLabel: string;
  frets: StringArray<number | null>; // absolute frets, null = muted
  baseFret: number; // first fret shown in the diagram window
  numFrets: number; // rows in the diagram window (>= 4)
  intervals: StringArray<string | null>; // "R", "b3", "13", ... per string
  notes: StringArray<string | null>; // actual note names ("Bb", "G#", ...) per string
  fingers: StringArray<number | null>; // suggested fingering, 1=index .. 4=pinky
  // Identity of the chord itself, so the UI can re-voice or re-quality it.
  rootPc: number;
  rootName: string;
  quality: ChordQuality;
};

export type ChordChart = {
  key: ChartKey;
  mode: "major" | "minor";
  progression: Progression;
  chords: PlacedChord[];
};

// ── Note naming ───────────────────────────────────────────────────────────────

const NOTE_NAMES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_NAMES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const QUALITY_SUFFIX: Record<ChordQuality, string> = {
  maj: "",
  min: "m",
  "7": "7",
  maj7: "maj7",
  m7: "m7",
  m7b5: "m7b5",
  dim7: "dim7",
  add9: "add9",
  aug: "aug",
  aug7: "7#5",
};

const INTERVAL_LABELS = ["R", "b9", "9", "b3", "3", "4", "b5", "5", "b6", "13", "b7", "7"];

// Open-string pitch classes, string 6 → 1 (standard tuning E A D G B E)
const OPEN_STRING_PC: StringArray<number> = [4, 9, 2, 7, 11, 4];

// ── Keys ──────────────────────────────────────────────────────────────────────

// All 12 keys in each mode, using the conventional enharmonic spelling for
// each (Db major but C# minor, Ab major but G# minor, and so on).
export const MAJOR_CHART_KEYS: ChartKey[] = [
  { label: "C", pitchClass: 0, accidentalPreference: "sharp" },
  { label: "Db", pitchClass: 1, accidentalPreference: "flat" },
  { label: "D", pitchClass: 2, accidentalPreference: "sharp" },
  { label: "Eb", pitchClass: 3, accidentalPreference: "flat" },
  { label: "E", pitchClass: 4, accidentalPreference: "sharp" },
  { label: "F", pitchClass: 5, accidentalPreference: "flat" },
  { label: "F#", pitchClass: 6, accidentalPreference: "sharp" },
  { label: "G", pitchClass: 7, accidentalPreference: "sharp" },
  { label: "Ab", pitchClass: 8, accidentalPreference: "flat" },
  { label: "A", pitchClass: 9, accidentalPreference: "sharp" },
  { label: "Bb", pitchClass: 10, accidentalPreference: "flat" },
  { label: "B", pitchClass: 11, accidentalPreference: "sharp" },
];

export const MINOR_CHART_KEYS: ChartKey[] = [
  { label: "C", pitchClass: 0, accidentalPreference: "flat" },
  { label: "C#", pitchClass: 1, accidentalPreference: "sharp" },
  { label: "D", pitchClass: 2, accidentalPreference: "flat" },
  { label: "Eb", pitchClass: 3, accidentalPreference: "flat" },
  { label: "E", pitchClass: 4, accidentalPreference: "sharp" },
  { label: "F", pitchClass: 5, accidentalPreference: "flat" },
  { label: "F#", pitchClass: 6, accidentalPreference: "sharp" },
  { label: "G", pitchClass: 7, accidentalPreference: "flat" },
  { label: "G#", pitchClass: 8, accidentalPreference: "sharp" },
  { label: "A", pitchClass: 9, accidentalPreference: "sharp" },
  { label: "Bb", pitchClass: 10, accidentalPreference: "flat" },
  { label: "B", pitchClass: 11, accidentalPreference: "sharp" },
];

// ── Voicing library ───────────────────────────────────────────────────────────
// Movable shapes; the placement code transposes them to the chart key.
// rel values are offsets from the root fret on rootString (null = muted).

export const CHORD_SHAPES: ChordShape[] = [
  // maj
  { quality: "maj", label: "E-shape barre", rootString: 6, rel: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1] },
  { quality: "maj", label: "A-shape barre", rootString: 5, rel: [null, 0, 2, 2, 2, 0], fingers: [null, 1, 2, 3, 4, 1] },
  { quality: "maj", label: "D-shape triad · top strings", rootString: 4, rel: [null, null, 0, 2, 3, 2], fingers: [null, null, 1, 2, 4, 3] },

  // min
  { quality: "min", label: "Em-shape barre", rootString: 6, rel: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1] },
  { quality: "min", label: "Am-shape barre", rootString: 5, rel: [null, 0, 2, 2, 1, 0], fingers: [null, 1, 3, 4, 2, 1] },
  { quality: "min", label: "Dm-shape triad · top strings", rootString: 4, rel: [null, null, 0, 2, 3, 1], fingers: [null, null, 1, 3, 4, 2] },

  // dominant 7
  { quality: "7", label: "Jazz shell · root on 6th", rootString: 6, rel: [0, null, 0, 1, 0, null], fingers: [1, null, 2, 4, 3, null] },
  { quality: "7", label: "A7-shape barre", rootString: 5, rel: [null, 0, 2, 0, 2, 0], fingers: [null, 1, 3, 1, 4, 1] },
  { quality: "7", label: "Funk ninth", rootString: 5, rel: [null, 0, -1, 0, 0, null], altSuffix: "9", fingers: [null, 2, 1, 3, 4, null] },
  { quality: "7", label: "Dominant thirteenth", rootString: 6, rel: [0, null, 0, 1, 2, null], altSuffix: "13", fingers: [1, null, 2, 3, 4, null] },

  // maj7
  { quality: "maj7", label: "Jazz shell · root on 6th", rootString: 6, rel: [0, null, 1, 1, 0, null], fingers: [1, null, 3, 4, 2, null] },
  { quality: "maj7", label: "A-shape maj7", rootString: 5, rel: [null, 0, 2, 1, 2, 0], fingers: [null, 1, 3, 2, 4, 1] },
  { quality: "maj7", label: "Drop 2 · top strings", rootString: 4, rel: [null, null, 0, -1, -2, -3], fingers: [null, null, 4, 3, 2, 1] },
  { quality: "maj7", label: "Major ninth · no 5th", rootString: 5, rel: [null, 0, -1, 1, 0, null], altSuffix: "maj9", fingers: [null, 2, 1, 4, 3, null] },

  // m7
  { quality: "m7", label: "Jazz shell · root on 6th", rootString: 6, rel: [0, null, 0, 0, 0, null], fingers: [1, null, 3, 3, 3, null] },
  { quality: "m7", label: "Am7-shape barre", rootString: 5, rel: [null, 0, 2, 0, 1, 0], fingers: [null, 1, 3, 1, 2, 1] },
  { quality: "m7", label: "Compact · top strings", rootString: 4, rel: [null, null, 0, 2, 1, 1], fingers: [null, null, 1, 3, 2, 2] },
  { quality: "m7", label: "Neo-soul minor ninth", rootString: 5, rel: [null, 0, -2, 0, 0, null], altSuffix: "m9", fingers: [null, 2, 1, 3, 4, null] },

  // m7b5
  { quality: "m7b5", label: "Root on 5th string", rootString: 5, rel: [null, 0, 1, 0, 1, null], fingers: [null, 1, 3, 2, 4, null] },
  { quality: "m7b5", label: "Root on 6th string", rootString: 6, rel: [0, null, 0, 0, -1, null], fingers: [2, null, 3, 4, 1, null] },

  // dim7
  { quality: "dim7", label: "Root on 5th string", rootString: 5, rel: [null, 0, 1, -1, 1, null], fingers: [null, 2, 3, 1, 4, null] },
  { quality: "dim7", label: "Root on 4th string", rootString: 4, rel: [null, null, 0, 1, 0, 1], fingers: [null, null, 1, 3, 2, 4] },

  // add9
  { quality: "add9", label: "Wide add9", rootString: 5, rel: [null, 0, 2, 4, 2, 0], fingers: [null, 1, 2, 4, 3, 1] },
  { quality: "add9", label: "Sus2 color · no 3rd", rootString: 5, rel: [null, 0, 2, 2, 0, 0], fingers: [null, 1, 3, 4, 1, 1] },

  // augmented (symmetrical — every shape repeats every 4 frets)
  { quality: "aug", label: "Root on 5th string", rootString: 5, rel: [null, 0, -1, -2, -2, -3], fingers: [null, 4, 3, 2, 2, 1] },
  { quality: "aug", label: "Compact · top strings", rootString: 4, rel: [null, null, 0, 3, 3, 2], fingers: [null, null, 1, 3, 4, 2] },

  // augmented seventh (7#5)
  { quality: "aug7", label: "Jazz shell · root on 6th", rootString: 6, rel: [0, null, 0, 1, 1, null], fingers: [1, null, 2, 3, 4, null] },
  { quality: "aug7", label: "Root on 5th string", rootString: 5, rel: [null, 0, 3, 0, 2, null], fingers: [null, 1, 4, 1, 3, null] },
];

// ── Progression library ───────────────────────────────────────────────────────

export const PROGRESSIONS: Progression[] = [
  {
    id: "cowboy-chords",
    name: "Cowboy Chords",
    mode: "major",
    keyless: true,
    description:
      "The essential open-position chords — every shape lives in the first three frets and none needs a barre. ✕ marks a string you don't strum; ○ is an open string.",
    chords: [],
  },
  {
    id: "two-five-one",
    name: "Jazz ii–V–I",
    mode: "major",
    description:
      "The cornerstone of jazz harmony. Listen for how the V7 pulls home to the Imaj7.",
    chords: [
      { rn: "ii7", semis: 2, quality: "m7" },
      { rn: "V7", semis: 7, quality: "7" },
      { rn: "Imaj7", semis: 0, quality: "maj7" },
    ],
  },
  {
    id: "rhythm-turnaround",
    name: "Rhythm Changes Turnaround",
    mode: "major",
    description:
      "I–vi–ii–V: the classic turnaround that loops endlessly. Try cycling it without stopping.",
    chords: [
      { rn: "Imaj7", semis: 0, quality: "maj7" },
      { rn: "vi7", semis: 9, quality: "m7" },
      { rn: "ii7", semis: 2, quality: "m7" },
      { rn: "V7", semis: 7, quality: "7" },
    ],
  },
  {
    id: "axis",
    name: "Axis of Pop",
    mode: "major",
    description:
      "I–V–vi–IV powers countless pop hits. Solid ground for trying fancier voicings on familiar changes.",
    chords: [
      { rn: "I", semis: 0, quality: "maj" },
      { rn: "V", semis: 7, quality: "maj" },
      { rn: "vi", semis: 9, quality: "min" },
      { rn: "IV", semis: 5, quality: "maj" },
    ],
  },
  {
    id: "doo-wop",
    name: "'50s Doo-Wop",
    mode: "major",
    description:
      "I–vi–IV–V, the '50s progression. Swap in seventh-chord voicings to modernize it.",
    chords: [
      { rn: "I", semis: 0, quality: "maj" },
      { rn: "vi", semis: 9, quality: "min" },
      { rn: "IV", semis: 5, quality: "maj" },
      { rn: "V", semis: 7, quality: "maj" },
    ],
  },
  {
    id: "andalusian",
    name: "Andalusian Cadence",
    mode: "minor",
    description:
      "i–bVII–bVI–V: the flamenco descent. The major V at the end gives it that Spanish tension.",
    chords: [
      { rn: "i", semis: 0, quality: "min" },
      { rn: "bVII", semis: 10, quality: "maj" },
      { rn: "bVI", semis: 8, quality: "maj" },
      { rn: "V7", semis: 7, quality: "7" },
    ],
  },
  {
    id: "aeolian",
    name: "Aeolian Anthem",
    mode: "minor",
    description:
      "i–bVI–bIII–bVII: the epic minor loop behind countless rock and film themes.",
    chords: [
      { rn: "i", semis: 0, quality: "min" },
      { rn: "bVI", semis: 8, quality: "maj" },
      { rn: "bIII", semis: 3, quality: "maj" },
      { rn: "bVII", semis: 10, quality: "maj" },
    ],
  },
  {
    id: "royal-road",
    name: "Royal Road",
    mode: "major",
    description:
      "IV–V–iii–vi: beloved in J-pop and anime themes. Starts away from home and never quite lands.",
    chords: [
      { rn: "IVmaj7", semis: 5, quality: "maj7" },
      { rn: "V7", semis: 7, quality: "7" },
      { rn: "iii7", semis: 4, quality: "m7" },
      { rn: "vi7", semis: 9, quality: "m7" },
    ],
  },
  {
    id: "creep",
    name: "Creep Changes",
    mode: "major",
    description:
      "I–III7–IV–iv: the major-third dominant and the minor-iv borrow give this its bittersweet pull.",
    chords: [
      { rn: "I", semis: 0, quality: "maj" },
      { rn: "III7", semis: 4, quality: "7" },
      { rn: "IV", semis: 5, quality: "maj" },
      { rn: "iv", semis: 5, quality: "min" },
    ],
  },
  {
    id: "backdoor",
    name: "Backdoor Resolution",
    mode: "major",
    description:
      "iv7–bVII7 sneaking back to Imaj7 — the 'backdoor' cadence, a favorite soul and jazz move.",
    chords: [
      { rn: "Imaj7", semis: 0, quality: "maj7" },
      { rn: "iv7", semis: 5, quality: "m7" },
      { rn: "bVII7", semis: 10, quality: "7" },
      { rn: "Imaj7", semis: 0, quality: "maj7" },
    ],
  },
  {
    id: "minor-blues",
    name: "Minor Blues Cadence",
    mode: "minor",
    description:
      "i7–iv7–bVI7–V7: the closing lap of a minor blues. Watch the chromatic slide from bVI7 to V7.",
    chords: [
      { rn: "i7", semis: 0, quality: "m7" },
      { rn: "iv7", semis: 5, quality: "m7" },
      { rn: "bVI7", semis: 8, quality: "7" },
      { rn: "V7", semis: 7, quality: "7" },
    ],
  },
  {
    id: "chromatic-climb",
    name: "Chromatic Climb",
    mode: "major",
    description:
      "I–#i°7–ii7–V7: the diminished chord walks the bass up chromatically into the ii–V.",
    chords: [
      { rn: "I", semis: 0, quality: "maj" },
      { rn: "#i°7", semis: 1, quality: "dim7" },
      { rn: "ii7", semis: 2, quality: "m7" },
      { rn: "V7", semis: 7, quality: "7" },
    ],
  },
  {
    id: "circle",
    name: "Circle of Fifths",
    mode: "major",
    description:
      "iii7–vi7–ii7–V7: each root falls a fifth, the strongest motion in harmony.",
    chords: [
      { rn: "iii7", semis: 4, quality: "m7" },
      { rn: "vi7", semis: 9, quality: "m7" },
      { rn: "ii7", semis: 2, quality: "m7" },
      { rn: "V7", semis: 7, quality: "7" },
    ],
  },
  {
    id: "mixo-vamp",
    name: "Mixolydian Jam",
    mode: "major",
    description:
      "I7–bVII–IV: the dominant-I rock vamp. Great for jamming and trying dominant colors.",
    chords: [
      { rn: "I7", semis: 0, quality: "7" },
      { rn: "bVII", semis: 10, quality: "maj" },
      { rn: "IV", semis: 5, quality: "maj" },
    ],
  },
  {
    id: "dream-drift",
    name: "Dream Pop Drift",
    mode: "major",
    description:
      "Imaj7–IVadd9–vi7–V: airy voicings with open color tones. Let every chord ring.",
    chords: [
      { rn: "Imaj7", semis: 0, quality: "maj7" },
      { rn: "IVadd9", semis: 5, quality: "add9" },
      { rn: "vi7", semis: 9, quality: "m7" },
      { rn: "V", semis: 7, quality: "maj" },
    ],
  },
  {
    id: "neo-soul",
    name: "Neo-Soul Stroll",
    mode: "minor",
    description:
      "i7–iv7–bVImaj7–V7: smooth minor changes that love ninth voicings. Keep the dynamics soft.",
    chords: [
      { rn: "i7", semis: 0, quality: "m7" },
      { rn: "iv7", semis: 5, quality: "m7" },
      { rn: "bVImaj7", semis: 8, quality: "maj7" },
      { rn: "V7", semis: 7, quality: "7" },
    ],
  },
  {
    id: "three-chord-rock",
    name: "Three-Chord Rock",
    mode: "major",
    description:
      "I–IV–V: the primal colors of rock, country, and folk. Everything else is decoration.",
    chords: [
      { rn: "I", semis: 0, quality: "maj" },
      { rn: "IV", semis: 5, quality: "maj" },
      { rn: "V", semis: 7, quality: "maj" },
      { rn: "IV", semis: 5, quality: "maj" },
    ],
  },
  {
    id: "blues-essence",
    name: "Twelve-Bar Essence",
    mode: "major",
    description:
      "I7–IV7–I7–V7: the 12-bar blues distilled to its dominant-seventh skeleton.",
    chords: [
      { rn: "I7", semis: 0, quality: "7" },
      { rn: "IV7", semis: 5, quality: "7" },
      { rn: "I7", semis: 0, quality: "7" },
      { rn: "V7", semis: 7, quality: "7" },
    ],
  },
  {
    id: "canon",
    name: "Pachelbel's Canon",
    mode: "major",
    description:
      "I–V–vi–iii–IV–I–IV–V: the famous eight-chord loop behind three centuries of hits.",
    chords: [
      { rn: "I", semis: 0, quality: "maj" },
      { rn: "V", semis: 7, quality: "maj" },
      { rn: "vi", semis: 9, quality: "min" },
      { rn: "iii", semis: 4, quality: "min" },
      { rn: "IV", semis: 5, quality: "maj" },
      { rn: "I", semis: 0, quality: "maj" },
      { rn: "IV", semis: 5, quality: "maj" },
      { rn: "V", semis: 7, quality: "maj" },
    ],
  },
  {
    id: "pop-ballad",
    name: "Pop Ballad Loop",
    mode: "major",
    description:
      "vi–IV–I–V: the Axis progression started from the minor side — instant modern-ballad melancholy.",
    chords: [
      { rn: "vi", semis: 9, quality: "min" },
      { rn: "IV", semis: 5, quality: "maj" },
      { rn: "I", semis: 0, quality: "maj" },
      { rn: "V", semis: 7, quality: "maj" },
    ],
  },
  {
    id: "rising-sun",
    name: "Rising Sun",
    mode: "minor",
    description:
      "i–bIII–IV–bVI: the Dorian major-IV gives this folk-blues climb its haunted shimmer.",
    chords: [
      { rn: "i", semis: 0, quality: "min" },
      { rn: "bIII", semis: 3, quality: "maj" },
      { rn: "IV", semis: 5, quality: "maj" },
      { rn: "bVI", semis: 8, quality: "maj" },
    ],
  },
  {
    id: "dorian-vamp",
    name: "Dorian Vamp",
    mode: "minor",
    description:
      "i7–IV7: two chords, endless groove — the engine of 'Oye Como Va' and countless jams.",
    chords: [
      { rn: "i7", semis: 0, quality: "m7" },
      { rn: "IV7", semis: 5, quality: "7" },
    ],
  },
  {
    id: "minor-two-five",
    name: "Minor ii–V–i",
    mode: "minor",
    description:
      "iiø7–V7–i: the minor-key cousin of the ii–V–I. The half-diminished chord is the tell.",
    chords: [
      { rn: "iiø7", semis: 2, quality: "m7b5" },
      { rn: "V7", semis: 7, quality: "7" },
      { rn: "i", semis: 0, quality: "min" },
    ],
  },
  {
    id: "full-minor-circle",
    name: "Full Minor Circle",
    mode: "minor",
    description:
      "i–iv–bVII–bIII–bVI–iiø–V: every root falls a fifth, disco-anthem style ('I Will Survive').",
    chords: [
      { rn: "i", semis: 0, quality: "min" },
      { rn: "iv", semis: 5, quality: "min" },
      { rn: "bVII7", semis: 10, quality: "7" },
      { rn: "bIIImaj7", semis: 3, quality: "maj7" },
      { rn: "bVImaj7", semis: 8, quality: "maj7" },
      { rn: "iiø7", semis: 2, quality: "m7b5" },
      { rn: "V7", semis: 7, quality: "7" },
    ],
  },
  {
    id: "dominant-chain",
    name: "Ragtime Dominant Chain",
    mode: "major",
    description:
      "III7–VI7–II7–V7: stacked secondary dominants, each pushing to the next — pure ragtime swagger.",
    chords: [
      { rn: "III7", semis: 4, quality: "7" },
      { rn: "VI7", semis: 9, quality: "7" },
      { rn: "II7", semis: 2, quality: "7" },
      { rn: "V7", semis: 7, quality: "7" },
    ],
  },
  {
    id: "spanish-epic",
    name: "Spanish Minor Epic",
    mode: "minor",
    description:
      "i–V7–bVII–IV–bVI–bIII–iv–V7: a long descending-bass story arc in the 'Hotel California' mold.",
    chords: [
      { rn: "i", semis: 0, quality: "min" },
      { rn: "V7", semis: 7, quality: "7" },
      { rn: "bVII", semis: 10, quality: "maj" },
      { rn: "IV", semis: 5, quality: "maj" },
      { rn: "bVI", semis: 8, quality: "maj" },
      { rn: "bIII", semis: 3, quality: "maj" },
      { rn: "iv", semis: 5, quality: "min" },
      { rn: "V7", semis: 7, quality: "7" },
    ],
  },
  {
    id: "minor-plagal",
    name: "Minor Plagal Cadence",
    mode: "major",
    description:
      "I–IV–iv–I: the borrowed minor-iv falling home — the sweetest sad sound in pop.",
    chords: [
      { rn: "I", semis: 0, quality: "maj" },
      { rn: "IV", semis: 5, quality: "maj" },
      { rn: "iv", semis: 5, quality: "min" },
      { rn: "I", semis: 0, quality: "maj" },
    ],
  },
  {
    id: "biii-lift",
    name: "bIII Lift",
    mode: "major",
    description:
      "I–bIII–IV: the blues-rock elevator move — the borrowed bIII shoves you up into IV.",
    chords: [
      { rn: "I", semis: 0, quality: "maj" },
      { rn: "bIII", semis: 3, quality: "maj" },
      { rn: "IV", semis: 5, quality: "maj" },
    ],
  },
  {
    id: "line-cliche",
    name: "Descending Line Cliché",
    mode: "major",
    description:
      "I–Imaj7–I7–IV: one chord, one moving inner voice (root → 7 → b7) that lands you on IV.",
    chords: [
      { rn: "I", semis: 0, quality: "maj" },
      { rn: "Imaj7", semis: 0, quality: "maj7" },
      { rn: "I7", semis: 0, quality: "7" },
      { rn: "IV", semis: 5, quality: "maj" },
    ],
  },
  {
    id: "gospel-walkup",
    name: "Gospel Walk-Up",
    mode: "major",
    description:
      "I–IV–#iv°7–V: the diminished chord walks the bass chromatically from IV up to V — church-certified.",
    chords: [
      { rn: "I", semis: 0, quality: "maj" },
      { rn: "IV", semis: 5, quality: "maj" },
      { rn: "#iv°7", semis: 6, quality: "dim7" },
      { rn: "V7", semis: 7, quality: "7" },
    ],
  },
  {
    id: "ladybird",
    name: "Ladybird Turnaround",
    mode: "major",
    description:
      "Imaj7–bIIImaj7–bVImaj7–bIImaj7: Tadd Dameron's all-major7 turnaround — lush, sliding, modern.",
    chords: [
      { rn: "Imaj7", semis: 0, quality: "maj7" },
      { rn: "bIIImaj7", semis: 3, quality: "maj7" },
      { rn: "bVImaj7", semis: 8, quality: "maj7" },
      { rn: "bIImaj7", semis: 1, quality: "maj7" },
    ],
  },
  {
    id: "bossa-drift",
    name: "Bossa Drift",
    mode: "major",
    description:
      "Imaj7–ii7–iii7–ii7: a gentle diatonic wave up and back — let it sway like a bossa nova.",
    chords: [
      { rn: "Imaj7", semis: 0, quality: "maj7" },
      { rn: "ii7", semis: 2, quality: "m7" },
      { rn: "iii7", semis: 4, quality: "m7" },
      { rn: "ii7", semis: 2, quality: "m7" },
    ],
  },
  {
    id: "mario-cadence",
    name: "Mario Cadence",
    mode: "major",
    description:
      "bVI–bVII–I: the borrowed double-lift that ends video game levels and power anthems alike.",
    chords: [
      { rn: "bVI", semis: 8, quality: "maj" },
      { rn: "bVII", semis: 10, quality: "maj" },
      { rn: "I", semis: 0, quality: "maj" },
    ],
  },
  {
    id: "smooth-rnb",
    name: "Smooth R&B Cycle",
    mode: "major",
    description:
      "IVmaj7–III7–vi7–v7–I7: the 'Just the Two of Us' lap — five chords that never stop moving.",
    chords: [
      { rn: "IVmaj7", semis: 5, quality: "maj7" },
      { rn: "III7", semis: 4, quality: "7" },
      { rn: "vi7", semis: 9, quality: "m7" },
      { rn: "v7", semis: 7, quality: "m7" },
      { rn: "I7", semis: 0, quality: "7" },
    ],
  },
  {
    id: "phrygian-vamp",
    name: "Phrygian Vamp",
    mode: "major",
    description:
      "I–bII: two chords a half-step apart — instant flamenco, surf-noir, and film-score menace.",
    chords: [
      { rn: "I", semis: 0, quality: "maj" },
      { rn: "bII", semis: 1, quality: "maj" },
    ],
  },
  {
    id: "tritone-sub",
    name: "Tritone Substitution",
    mode: "major",
    description:
      "ii7–bII7–Imaj7: the V7 swapped for the dominant a tritone away, so the bass slides down by half-steps.",
    chords: [
      { rn: "ii7", semis: 2, quality: "m7" },
      { rn: "bII7", semis: 1, quality: "7" },
      { rn: "Imaj7", semis: 0, quality: "maj7" },
    ],
  },
  {
    id: "vi-ii-v-i",
    name: "Full Cycle Home",
    mode: "major",
    description:
      "vi7–ii7–V7–Imaj7: 'Fly Me to the Moon' in miniature — falling fifths all the way home.",
    chords: [
      { rn: "vi7", semis: 9, quality: "m7" },
      { rn: "ii7", semis: 2, quality: "m7" },
      { rn: "V7", semis: 7, quality: "7" },
      { rn: "Imaj7", semis: 0, quality: "maj7" },
    ],
  },
  {
    id: "autumn-leaves",
    name: "Autumn Leaves Cycle",
    mode: "minor",
    description:
      "iv7–bVII7–bIIImaj7–bVImaj7–iiø7–V7–i: the classic circle through the relative major and back.",
    chords: [
      { rn: "iv7", semis: 5, quality: "m7" },
      { rn: "bVII7", semis: 10, quality: "7" },
      { rn: "bIIImaj7", semis: 3, quality: "maj7" },
      { rn: "bVImaj7", semis: 8, quality: "maj7" },
      { rn: "iiø7", semis: 2, quality: "m7b5" },
      { rn: "V7", semis: 7, quality: "7" },
      { rn: "i", semis: 0, quality: "min" },
    ],
  },
  {
    id: "lydian-lift",
    name: "Lydian Lift",
    mode: "major",
    description:
      "I–II: two major chords a whole step up — the bright, floating 'flying theme' sound.",
    chords: [
      { rn: "I", semis: 0, quality: "maj" },
      { rn: "II", semis: 2, quality: "maj" },
    ],
  },
  {
    id: "minor-skank",
    name: "Minor Skank",
    mode: "minor",
    description:
      "i–bVII: the two-chord reggae and desert-rock loop. Groove is the whole assignment.",
    chords: [
      { rn: "i", semis: 0, quality: "min" },
      { rn: "bVII", semis: 10, quality: "maj" },
    ],
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

// ── Shape placement ───────────────────────────────────────────────────────────

type Placement = {
  frets: StringArray<number | null>;
  baseFret: number;
  numFrets: number;
  avgFret: number;
};

function placeShape(shape: ChordShape, rootPc: number): Placement {
  const stringIndex = 6 - shape.rootString; // rootString 6 → index 0
  const openPc = OPEN_STRING_PC[stringIndex];
  const rootFret = (rootPc - openPc + 12) % 12;

  let frets = shape.rel.map((r) => (r === null ? null : rootFret + r)) as StringArray<number | null>;
  const played = () => frets.filter((f): f is number => f !== null);

  // Shift up an octave if the transposition produced negative frets.
  if (Math.min(...played()) < 0) {
    frets = frets.map((f) => (f === null ? null : f + 12)) as StringArray<number | null>;
  }

  const fretted = played().filter((f) => f > 0);
  const hasOpen = played().some((f) => f === 0);
  const maxFret = Math.max(...played());
  const baseFret = hasOpen || fretted.length === 0 ? 1 : Math.min(...fretted);
  const numFrets = Math.max(4, maxFret - baseFret + 1);
  const avgFret = fretted.length > 0 ? fretted.reduce((a, b) => a + b, 0) / fretted.length : 0;

  return { frets, baseFret, numFrets, avgFret };
}

// The stored fingering assumes the fretted (movable) form of the shape. When a
// transposition lands notes on open strings, those fingers drop out; the rest
// are renumbered by rank so the hand collapses naturally toward the index
// (e.g. the E-shape barre 1-3-4-2-1-1 becomes open E's standard 0-2-3-1-0-0).
function placedFingers(
  shapeFingers: StringArray<number | null>,
  frets: StringArray<number | null>,
): StringArray<number | null> {
  const fingers = shapeFingers.map((f, i) =>
    f === null || frets[i] === null || frets[i] === 0 ? null : f,
  ) as StringArray<number | null>;

  const droppedAny = shapeFingers.some((f, i) => f !== null && frets[i] === 0);
  if (!droppedAny) return fingers;

  const remaining = Array.from(new Set(fingers.filter((f): f is number => f !== null))).sort(
    (a, b) => a - b,
  );
  const rank = new Map(remaining.map((f, i) => [f, i + 1]));
  return fingers.map((f) => (f === null ? null : rank.get(f)!)) as StringArray<number | null>;
}

function intervalLabels(
  frets: StringArray<number | null>,
  rootPc: number,
  quality: ChordQuality,
): StringArray<string | null> {
  return frets.map((fret, i) => {
    if (fret === null) return null;
    const pc = (OPEN_STRING_PC[i] + fret) % 12;
    const interval = (pc - rootPc + 12) % 12;
    // A diminished seventh (9 semitones) is bb7, not 13
    if (quality === "dim7" && interval === 9) return "bb7";
    // In an augmented chord the 8-semitone tone is a raised 5th, not a b6
    if ((quality === "aug" || quality === "aug7") && interval === 8) return "#5";
    return INTERVAL_LABELS[interval];
  }) as StringArray<string | null>;
}

// ── Note spelling ─────────────────────────────────────────────────────────────
// Spells each fretted note relative to the chord root so accidentals come out
// right (C7's seventh is Bb, not A#; E's third is G#, not Ab). The letter is
// chosen from the interval's scale degree, then the accidental is whatever
// makes that letter land on the correct pitch class.

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// Scale degree (1-based) for each interval in semitones; 9 semitones reads as
// a 6th/13th by default and as a bb7 for dim7 (matching intervalLabels).
const SEMIS_DEGREE = [1, 2, 2, 3, 3, 4, 5, 5, 6, 6, 7, 7];

function spellFromDegree(refName: string, refPc: number, semis: number, degree: number): string {
  const refLetterIndex = LETTERS.indexOf(refName[0]);
  const letter = LETTERS[(refLetterIndex + degree - 1) % 7];
  const targetPc = (refPc + semis) % 12;
  const diff = (targetPc - LETTER_PC[letter] + 12) % 12;
  const accidental =
    diff === 0 ? "" : diff === 1 ? "#" : diff === 11 ? "b" : diff === 2 ? "##" : "bb";
  return `${letter}${accidental}`;
}

// Spell a note a given interval above a root, simplifying double accidentals
// to plain enharmonic names. Shared with the scale engine.
export function spellInterval(rootName: string, rootPc: number, semis: number, degree: number): string {
  const spelled = spellFromDegree(rootName, rootPc, semis, degree);
  if (/##|bb/.test(spelled)) {
    return (rootName.includes("b") ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP)[(rootPc + semis) % 12];
  }
  return spelled;
}

function spellNote(rootName: string, rootPc: number, semis: number, quality: ChordQuality): string {
  // dim7's 9 semitones is a bb7, and an augmented chord's 8 is a #5 (C E G#),
  // so both take a different scale degree than the default table gives.
  let degree = SEMIS_DEGREE[semis];
  if (quality === "dim7" && semis === 9) degree = 7;
  if ((quality === "aug" || quality === "aug7") && semis === 8) degree = 5;
  return spellFromDegree(rootName, rootPc, semis, degree);
}

// Chord roots are spelled from the roman numeral's scale degree so borrowed
// chords come out conventionally (bVII in C is Bb, not A#; bIIImaj7 is Eb).
const ROMAN_DEGREE: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7 };

// Strict degree spelling can produce technically-correct but unreadable names
// (bVI of Db is "Bbb"; bII of Bb is "Cb"). Real charts respell those — chord
// ROOTS with double accidentals or Cb/Fb/E#/B# fall back to the simple
// enharmonic name.
const AWKWARD_ROOTS = new Set(["Cb", "Fb", "E#", "B#"]);

function chordRootName(key: ChartKey, chord: ProgressionChord): string | null {
  const match = chord.rn.match(/^[b#]?([ivIV]+)/);
  if (!match) return null;
  const degree = ROMAN_DEGREE[match[1].toLowerCase()];
  if (degree === undefined || LETTERS.indexOf(key.label[0]) === -1) return null;
  const spelled = spellFromDegree(key.label, key.pitchClass, chord.semis, degree);
  if (/##|bb/.test(spelled) || AWKWARD_ROOTS.has(spelled)) {
    const pc = (key.pitchClass + chord.semis) % 12;
    return (key.accidentalPreference === "flat" ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP)[pc];
  }
  return spelled;
}

function noteLabels(
  frets: StringArray<number | null>,
  rootPc: number,
  rootName: string,
  quality: ChordQuality,
): StringArray<string | null> {
  return frets.map((fret, i) => {
    if (fret === null) return null;
    const pc = (OPEN_STRING_PC[i] + fret) % 12;
    const semis = (pc - rootPc + 12) % 12;
    const spelled = spellNote(rootName, rootPc, semis, quality);
    // Inside a chord, single accidentals like E# are conventional and kept,
    // but double accidentals (F##, Bbb) are simplified for readability.
    if (/##|bb/.test(spelled)) {
      return (rootName.includes("b") ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP)[pc];
    }
    return spelled;
  }) as StringArray<string | null>;
}

// ── Cowboy chords (static open-position chart, no barres) ─────────────────────

type OpenChordDef = {
  name: string;
  rootPc: number;
  quality: ChordQuality;
  frets: StringArray<number | null>;
  fingers: StringArray<number | null>;
  label: string;
};

const OPEN_CHORDS: OpenChordDef[] = [
  { name: "C", rootPc: 0, quality: "maj", frets: [null, 3, 2, 0, 1, 0], fingers: [null, 3, 2, null, 1, null], label: "Campfire classic" },
  { name: "A", rootPc: 9, quality: "maj", frets: [null, 0, 2, 2, 2, 0], fingers: [null, null, 1, 2, 3, null], label: "Three in a row" },
  { name: "G", rootPc: 7, quality: "maj", frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, null, null, null, 3], label: "All six strings ring" },
  { name: "E", rootPc: 4, quality: "maj", frets: [0, 2, 2, 1, 0, 0], fingers: [null, 2, 3, 1, null, null], label: "The full six-string E" },
  { name: "D", rootPc: 2, quality: "maj", frets: [null, null, 0, 2, 3, 2], fingers: [null, null, null, 1, 3, 2], label: "Little triangle" },
  { name: "Am", rootPc: 9, quality: "min", frets: [null, 0, 2, 2, 1, 0], fingers: [null, null, 2, 3, 1, null], label: "Like E, one string over" },
  { name: "Em", rootPc: 4, quality: "min", frets: [0, 2, 2, 0, 0, 0], fingers: [null, 2, 3, null, null, null], label: "Two fingers, six strings" },
  { name: "Dm", rootPc: 2, quality: "min", frets: [null, null, 0, 2, 3, 1], fingers: [null, null, null, 2, 3, 1], label: "First-fret F on top" },
  { name: "E7", rootPc: 4, quality: "7", frets: [0, 2, 0, 1, 0, 0], fingers: [null, 2, null, 1, null, null], label: "E minus one finger" },
  { name: "A7", rootPc: 9, quality: "7", frets: [null, 0, 2, 0, 2, 0], fingers: [null, null, 2, null, 3, null], label: "A with a window" },
  { name: "D7", rootPc: 2, quality: "7", frets: [null, null, 0, 2, 1, 2], fingers: [null, null, null, 2, 1, 3], label: "Triangle flipped" },
  { name: "G7", rootPc: 7, quality: "7", frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, null, null, null, 1], label: "G's bluesy cousin" },
  { name: "C7", rootPc: 0, quality: "7", frets: [null, 3, 2, 3, 1, 0], fingers: [null, 3, 2, 4, 1, null], label: "C plus a pinky" },
  { name: "B7", rootPc: 11, quality: "7", frets: [null, 2, 1, 2, 0, 2], fingers: [null, 2, 1, 3, null, 4], label: "The odd one out" },
  { name: "Fmaj7", rootPc: 5, quality: "maj7", frets: [null, null, 3, 2, 1, 0], fingers: [null, null, 3, 2, 1, null], label: "The no-barre F" },
];

function buildCowboyChart(progression: Progression): ChordChart {
  return {
    key: { label: "Open position", pitchClass: 0, accidentalPreference: "sharp" },
    mode: "major",
    progression,
    chords: OPEN_CHORDS.map((c) => {
      const fretted = c.frets.filter((f): f is number => f !== null && f > 0);
      const maxFret = fretted.length > 0 ? Math.max(...fretted) : 1;
      const rootName =
        c.name.length > 1 && (c.name[1] === "#" || c.name[1] === "b")
          ? c.name.slice(0, 2)
          : c.name[0];
      return {
        name: c.name,
        rn: "",
        voicingLabel: c.label,
        rootPc: c.rootPc,
        rootName,
        quality: c.quality,
        frets: c.frets,
        baseFret: 1,
        numFrets: Math.max(4, maxFret),
        intervals: intervalLabels(c.frets, c.rootPc, c.quality),
        notes: noteLabels(c.frets, c.rootPc, rootName, c.quality),
        fingers: c.fingers,
      };
    }),
  };
}

// ── Chart building ────────────────────────────────────────────────────────────

export function buildChordChart(
  dateISO: string,
  chartIndex: number,
  voicingVariant: number,
): ChordChart {
  const baseSeed = hashStringToInt(`${dateISO}:chords`);
  const chartRng = mulberry32(baseSeed + chartIndex * 7919);

  const progression = PROGRESSIONS[Math.floor(chartRng() * PROGRESSIONS.length)];
  const keys = progression.mode === "major" ? MAJOR_CHART_KEYS : MINOR_CHART_KEYS;
  const key = keys[Math.floor(chartRng() * keys.length)];

  const voicingSeed = baseSeed + chartIndex * 7919 + 104729 * (voicingVariant + 1);
  return assembleChart(progression, key, voicingSeed);
}

// Build a chart for an explicitly chosen progression and key (used by the
// standalone chords app's pickers). Deterministic per selection + variant.
export function buildCustomChart(
  progression: Progression,
  key: ChartKey,
  voicingVariant: number,
): ChordChart {
  const seed = hashStringToInt(`${progression.id}:${key.label}:custom`);
  return assembleChart(progression, key, seed + 104729 * (voicingVariant + 1));
}

// Substitutions offered by the per-chord quality cycler on progression charts.
// Each family keeps the chord's basic character (its third and function) and
// steps from plain triad to richer colors, so a ii7 can become a plain ii but
// never a diminished chord.
export const RELATED_QUALITIES: Record<ChordQuality, ChordQuality[]> = {
  maj: ["maj", "add9", "maj7", "7", "aug"],
  add9: ["maj", "add9", "maj7", "7", "aug"],
  maj7: ["maj", "add9", "maj7", "7", "aug"],
  "7": ["maj", "7", "maj7", "aug7"],
  aug: ["maj", "aug", "aug7", "maj7"],
  aug7: ["7", "aug7", "aug", "maj"],
  min: ["min", "m7"],
  m7: ["min", "m7"],
  m7b5: ["m7b5", "dim7", "min"],
  dim7: ["m7b5", "dim7", "min"],
};

// Every voicing in the library for one chord, optionally restricted to notes a
// scale contains. Used by the scale-chords view, where each chord gets its own
// voicing and quality cyclers. Ordered low on the neck to high.
export function voicingsForChord(
  quality: ChordQuality,
  rootPc: number,
  rootName: string,
  restrict?: { allowedSemis: number[]; keyPitchClass: number },
): PlacedChord[] {
  const allowed = restrict ? new Set(restrict.allowedSemis) : null;

  const out: PlacedChord[] = [];
  for (const shape of CHORD_SHAPES) {
    if (shape.quality !== quality) continue;
    const placement = placeShape(shape, rootPc);

    if (allowed) {
      const fits = placement.frets.every((fret, i) => {
        if (fret === null) return true;
        const rel = ((OPEN_STRING_PC[i] + fret) % 12 - restrict!.keyPitchClass + 12) % 12;
        return allowed.has(rel);
      });
      if (!fits) continue;
    }

    const suffix = shape.altSuffix ?? QUALITY_SUFFIX[shape.quality];
    out.push({
      name: `${rootName}${suffix}`,
      rn: "",
      voicingLabel: shape.label,
      rootPc,
      rootName,
      quality,
      frets: placement.frets,
      baseFret: placement.baseFret,
      numFrets: placement.numFrets,
      intervals: intervalLabels(placement.frets, rootPc, quality),
      notes: noteLabels(placement.frets, rootPc, rootName, quality),
      fingers: placedFingers(shape.fingers, placement.frets),
    });
  }

  return out.sort((a, b) => a.baseFret - b.baseFret);
}

// Spell a chord root from its scale degree within a key (bVII in C is Bb).
export function rootNameForDegree(key: ChartKey, semis: number, degree: number): string {
  const spelled = spellFromDegree(key.label, key.pitchClass, semis, degree);
  const pc = (key.pitchClass + semis) % 12;
  if (/##|bb/.test(spelled) || AWKWARD_ROOTS.has(spelled)) {
    return (key.accidentalPreference === "flat" ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP)[pc];
  }
  return spelled;
}

function assembleChart(progression: Progression, key: ChartKey, voicingSeed: number): ChordChart {
  if (progression.keyless) return buildCowboyChart(progression);

  const noteNames = key.accidentalPreference === "flat" ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  const voicingRng = mulberry32(voicingSeed);

  // Anchor the first chord somewhere on the neck, then favor voicings that stay
  // close to the previous chord (rough voice-leading), with a random nudge so
  // "New voicings" produces genuinely different sets.
  let targetFret = 2 + voicingRng() * 7;
  const placed: PlacedChord[] = [];

  // When the progression is harmonized from a scale, extended voicings may only
  // use notes the scale contains.
  const allowedRel = progression.allowedSemis ? new Set(progression.allowedSemis) : null;
  const fitsScale = (frets: StringArray<number | null>): boolean => {
    if (!allowedRel) return true;
    return frets.every((fret, i) => {
      if (fret === null) return true;
      const rel = ((OPEN_STRING_PC[i] + fret) % 12 - key.pitchClass + 12) % 12;
      return allowedRel.has(rel);
    });
  };

  for (const chord of progression.chords) {
    const rootPc = (key.pitchClass + chord.semis) % 12;
    const candidates = CHORD_SHAPES.filter((s) => s.quality === chord.quality);

    let best: { shape: ChordShape; placement: Placement; score: number } | null = null;
    let fallback: { shape: ChordShape; placement: Placement; score: number } | null = null;
    for (const shape of candidates) {
      const placement = placeShape(shape, rootPc);
      const score = Math.abs(placement.avgFret - targetFret) + voicingRng() * 3;
      if (fallback === null || score < fallback.score) {
        fallback = { shape, placement, score };
      }
      if (!fitsScale(placement.frets)) continue;
      if (best === null || score < best.score) {
        best = { shape, placement, score };
      }
    }
    best = best ?? fallback;
    if (!best) continue; // unreachable: every quality has shapes

    const suffix = best.shape.altSuffix ?? QUALITY_SUFFIX[best.shape.quality];
    const rootName = chordRootName(key, chord) ?? noteNames[rootPc];
    placed.push({
      name: `${rootName}${suffix}`,
      rn: chord.rn,
      voicingLabel: best.shape.label,
      rootPc,
      rootName,
      quality: chord.quality,
      frets: best.placement.frets,
      baseFret: best.placement.baseFret,
      numFrets: best.placement.numFrets,
      intervals: intervalLabels(best.placement.frets, rootPc, chord.quality),
      notes: noteLabels(best.placement.frets, rootPc, rootName, chord.quality),
      fingers: placedFingers(best.shape.fingers, best.placement.frets),
    });

    targetFret = best.placement.avgFret;
  }

  return { key, mode: progression.mode, progression, chords: placed };
}
