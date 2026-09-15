import { MAX_FRET, MIN_FRET, STANDARD_TUNING } from "./constants";
import { ExerciseDefinition, PositionPattern } from "../types";

type ScaleTemplate = {
  id: string;
  name: string;
  intervals: number[];
  description: string;
};

const SCALE_POSITION_BASE_FRETS = [1, 4, 7, 10, 13];
const POSITION_CORE_WIDTH = 4;
const POSITION_STRETCH = 1;

function normalizePitchClass(n: number): number {
  return ((n % 12) + 12) % 12;
}

type CandidateNote = {
  string: 1 | 2 | 3 | 4 | 5 | 6;
  fret: number;
  midi: number;
  pitchClass: number;
  inCore: boolean;
};

function buildTargetSemitones(intervals: number[]): number[] {
  const targets: number[] = [0];
  for (let octave = 0; octave <= 1; octave += 1) {
    intervals.forEach((interval) => {
      const semitone = interval + octave * 12;
      if (!targets.includes(semitone)) {
        targets.push(semitone);
      }
    });
  }
  if (!targets.includes(24)) {
    targets.push(24);
  }
  return targets.sort((a, b) => a - b);
}

function scoreCandidate(
  candidate: CandidateNote,
  desiredMidi: number,
  previous: CandidateNote | null,
): number {
  const desiredDistance = Math.abs(candidate.midi - desiredMidi) * 2;
  const corePenalty = candidate.inCore ? 0 : 3;
  const openPenalty = candidate.fret === 0 ? 2 : 0;

  if (!previous) {
    return desiredDistance + corePenalty + openPenalty;
  }

  const stringLeap = Math.abs(candidate.string - previous.string) * 1.4;
  const fretLeap = Math.abs(candidate.fret - previous.fret) * 0.6;
  const backwardStringPenalty = candidate.string > previous.string ? 8 : 0;

  return desiredDistance + corePenalty + openPenalty + stringLeap + fretLeap + backwardStringPenalty;
}

function buildScalePosition(intervals: number[], positionIndex: number, lowFret: number): PositionPattern {
  const highFret = lowFret + POSITION_CORE_WIDTH - 1;
  const allowedLow = Math.max(MIN_FRET, lowFret - POSITION_STRETCH);
  const allowedHigh = Math.min(MAX_FRET, highFret + POSITION_STRETCH);
  const scalePitchClasses = new Set(intervals.map((interval) => normalizePitchClass(interval)));
  const candidates: CandidateNote[] = [];

  ([6, 5, 4, 3, 2, 1] as const).forEach((string) => {
    const openMidi = STANDARD_TUNING.openStringMidi[6 - string];
    for (let fret = allowedLow; fret <= allowedHigh; fret += 1) {
      const midi = openMidi + fret;
      const pitchClass = normalizePitchClass(midi);
      if (scalePitchClasses.has(pitchClass)) {
        candidates.push({
          string,
          fret,
          midi,
          pitchClass,
          inCore: fret >= lowFret && fret <= highFret,
        });
      }
    }
  });

  const rootCandidates = candidates
    .filter((candidate) => candidate.pitchClass === 0)
    .sort((a, b) => {
      if (a.inCore !== b.inCore) return a.inCore ? -1 : 1;
      if (a.fret !== b.fret) return a.fret - b.fret;
      return b.string - a.string;
    });

  const startRoot = rootCandidates[0] ?? candidates[0];
  const targetSemitones = buildTargetSemitones(intervals);
  const chosen: CandidateNote[] = [startRoot];
  let previous = startRoot;

  targetSemitones.slice(1).forEach((targetSemi) => {
    const desiredMidi = startRoot.midi + targetSemi;
    const desiredPitchClass = normalizePitchClass(desiredMidi);

    const options = candidates
      .filter((candidate) => candidate.pitchClass === desiredPitchClass && candidate.midi > previous.midi)
      .sort((a, b) => scoreCandidate(a, desiredMidi, previous) - scoreCandidate(b, desiredMidi, previous));

    const selected = options[0];
    if (!selected) return;

    chosen.push(selected);
    previous = selected;
  });

  const asc = chosen.map((note) => ({ string: note.string, fret: note.fret }));

  return {
    positionId: `pos${positionIndex + 1}`,
    label: `Position ${positionIndex + 1} (Core ${lowFret}-${highFret})`,
    fretSpan: { low: lowFret, high: highFret },
    asc,
  };
}

function createScaleExercise(template: ScaleTemplate): ExerciseDefinition {
  const positions = SCALE_POSITION_BASE_FRETS.map((lowFret, idx) =>
    buildScalePosition(template.intervals, idx, lowFret),
  );

  return {
    id: template.id,
    name: template.name,
    practiceType: "scale",
    description: `${template.description} Five linked positions with a 4-fret core and ±1-fret stretch.`,
    rootNote: "C",
    positions,
  };
}

const SCALE_TEMPLATES: ScaleTemplate[] = [
  {
    id: "scale_major_ionian",
    name: "Major Scale (Ionian)",
    intervals: [0, 2, 4, 5, 7, 9, 11],
    description: "The foundational major scale used across styles.",
  },
  {
    id: "scale_natural_minor_aeolian",
    name: "Natural Minor Scale (Aeolian)",
    intervals: [0, 2, 3, 5, 7, 8, 10],
    description: "Core minor scale sound for melodic and modal playing.",
  },
  {
    id: "scale_major_pentatonic",
    name: "Major Pentatonic",
    intervals: [0, 2, 4, 7, 9],
    description: "Five-note major scale with strong melodic clarity.",
  },
  {
    id: "scale_minor_pentatonic_single",
    name: "Minor Pentatonic",
    intervals: [0, 3, 5, 7, 10],
    description: "Five-note minor scale used heavily in blues and rock.",
  },
  {
    id: "scale_blues",
    name: "Blues Scale",
    intervals: [0, 3, 5, 6, 7, 10],
    description: "Minor pentatonic plus blue note for blues vocabulary.",
  },
  {
    id: "scale_dorian",
    name: "Dorian Mode",
    intervals: [0, 2, 3, 5, 7, 9, 10],
    description: "Minor mode with a natural 6 for funk, jazz, and fusion.",
  },
  {
    id: "scale_mixolydian",
    name: "Mixolydian Mode",
    intervals: [0, 2, 4, 5, 7, 9, 10],
    description: "Dominant-flavored major mode for blues and rock.",
  },
  {
    id: "scale_lydian",
    name: "Lydian Mode",
    intervals: [0, 2, 4, 6, 7, 9, 11],
    description: "Major mode with a #4 for bright modern harmony.",
  },
  {
    id: "scale_phrygian",
    name: "Phrygian Mode",
    intervals: [0, 1, 3, 5, 7, 8, 10],
    description: "Dark minor mode with a flat 2.",
  },
  {
    id: "scale_locrian",
    name: "Locrian Mode",
    intervals: [0, 1, 3, 5, 6, 8, 10],
    description: "Diminished minor mode with flat 2 and flat 5.",
  },
  {
    id: "scale_harmonic_minor",
    name: "Harmonic Minor",
    intervals: [0, 2, 3, 5, 7, 8, 11],
    description: "Classic minor scale with major 7 for strong dominant pull.",
  },
  {
    id: "scale_melodic_minor",
    name: "Melodic Minor (Jazz)",
    intervals: [0, 2, 3, 5, 7, 9, 11],
    description: "Ascending melodic minor used in modern jazz harmony.",
  },
  {
    id: "scale_harmonic_major",
    name: "Harmonic Major",
    intervals: [0, 2, 4, 5, 7, 8, 11],
    description: "Major scale with a flat 6 for exotic dominant colors.",
  },
  {
    id: "scale_major_bebop",
    name: "Major Bebop",
    intervals: [0, 2, 4, 5, 7, 8, 9, 11],
    description: "Major scale with an added passing tone for bebop lines.",
  },
  {
    id: "scale_dominant_bebop",
    name: "Dominant Bebop",
    intervals: [0, 2, 4, 5, 7, 9, 10, 11],
    description: "Mixolydian with added major 7 for bebop dominant phrasing.",
  },
  {
    id: "scale_minor_bebop",
    name: "Minor Bebop",
    intervals: [0, 2, 3, 5, 7, 8, 10, 11],
    description: "Minor scale variant with an added passing tone.",
  },
  {
    id: "scale_whole_tone",
    name: "Whole Tone Scale",
    intervals: [0, 2, 4, 6, 8, 10],
    description: "Symmetrical six-note scale built entirely of whole steps.",
  },
  {
    id: "scale_diminished_whole_half",
    name: "Diminished (Whole-Half)",
    intervals: [0, 2, 3, 5, 6, 8, 9, 11],
    description: "Symmetrical diminished scale starting with a whole step.",
  },
  {
    id: "scale_diminished_half_whole",
    name: "Diminished (Half-Whole)",
    intervals: [0, 1, 3, 4, 6, 7, 9, 10],
    description: "Symmetrical diminished scale starting with a half step.",
  },
  {
    id: "scale_chromatic",
    name: "Chromatic Scale",
    intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    description: "All 12 notes for full fingerboard coverage and passing tones.",
  },
  {
    id: "scale_double_harmonic",
    name: "Double Harmonic",
    intervals: [0, 1, 4, 5, 7, 8, 11],
    description: "Exotic major scale with flat 2 and flat 6.",
  },
  {
    id: "scale_hungarian_minor",
    name: "Hungarian Minor",
    intervals: [0, 2, 3, 6, 7, 8, 11],
    description: "Minor scale with augmented 4 and major 7.",
  },
  {
    id: "scale_neapolitan_minor",
    name: "Neapolitan Minor",
    intervals: [0, 1, 3, 5, 7, 8, 11],
    description: "Minor scale with a flat 2 and major 7.",
  },
  {
    id: "scale_neapolitan_major",
    name: "Neapolitan Major",
    intervals: [0, 1, 3, 5, 7, 9, 11],
    description: "Major-leaning variation of the Neapolitan family.",
  },
];

export const SCALE_MINOR_PENT_BOXES_A: ExerciseDefinition = {
  id: "scale_minor_pent_boxes",
  name: "Minor Pentatonic Boxes (1–5)",
  practiceType: "scale",
  description: "Five connected minor pentatonic positions across the neck. Practice each box ascending and descending.",
  rootNote: "A",
  positions: [
    {
      positionId: "pos1",
      label: "Position 1 (Box 1)",
      fretSpan: { low: 5, high: 8 },
      asc: [
        { string: 6, fret: 5 }, { string: 6, fret: 8 },
        { string: 5, fret: 5 }, { string: 5, fret: 7 },
        { string: 4, fret: 5 }, { string: 4, fret: 7 },
        { string: 3, fret: 5 }, { string: 3, fret: 7 },
        { string: 2, fret: 5 }, { string: 2, fret: 8 },
        { string: 1, fret: 5 }, { string: 1, fret: 8 },
      ],
    },
    {
      positionId: "pos2",
      label: "Position 2 (Box 2)",
      fretSpan: { low: 7, high: 10 },
      asc: [
        { string: 6, fret: 8 }, { string: 6, fret: 10 },
        { string: 5, fret: 7 }, { string: 5, fret: 10 },
        { string: 4, fret: 7 }, { string: 4, fret: 10 },
        { string: 3, fret: 7 }, { string: 3, fret: 9 },
        { string: 2, fret: 8 }, { string: 2, fret: 10 },
        { string: 1, fret: 8 }, { string: 1, fret: 10 },
      ],
    },
    {
      positionId: "pos3",
      label: "Position 3 (Box 3)",
      fretSpan: { low: 9, high: 13 },
      asc: [
        { string: 6, fret: 10 }, { string: 6, fret: 12 },
        { string: 5, fret: 10 }, { string: 5, fret: 12 },
        { string: 4, fret: 10 }, { string: 4, fret: 12 },
        { string: 3, fret: 9 }, { string: 3, fret: 12 },
        { string: 2, fret: 10 }, { string: 2, fret: 13 },
        { string: 1, fret: 10 }, { string: 1, fret: 12 },
      ],
    },
    {
      positionId: "pos4",
      label: "Position 4 (Box 4)",
      fretSpan: { low: 12, high: 15 },
      asc: [
        { string: 6, fret: 12 }, { string: 6, fret: 15 },
        { string: 5, fret: 12 }, { string: 5, fret: 15 },
        { string: 4, fret: 12 }, { string: 4, fret: 14 },
        { string: 3, fret: 12 }, { string: 3, fret: 14 },
        { string: 2, fret: 13 }, { string: 2, fret: 15 },
        { string: 1, fret: 12 }, { string: 1, fret: 15 },
      ],
    },
    {
      positionId: "pos5",
      label: "Position 5 (Box 5)",
      fretSpan: { low: 2, high: 5 },
      asc: [
        { string: 6, fret: 3 }, { string: 6, fret: 5 },
        { string: 5, fret: 3 }, { string: 5, fret: 5 },
        { string: 4, fret: 2 }, { string: 4, fret: 5 },
        { string: 3, fret: 2 }, { string: 3, fret: 5 },
        { string: 2, fret: 3 }, { string: 2, fret: 5 },
        { string: 1, fret: 3 }, { string: 1, fret: 5 },
      ],
    },
  ],
};

export const SCALE_LIBRARY: ExerciseDefinition[] = [
  SCALE_MINOR_PENT_BOXES_A,
  ...SCALE_TEMPLATES.map(createScaleExercise),
];

export const ARP_MAJOR_TRIAD_C_POSITIONS: ExerciseDefinition = {
  id: "arp_major_triad_positions",
  name: "Major Triad Arpeggio Positions",
  practiceType: "arpeggio",
  description: "C major triad arpeggio in multiple positions across the neck. Practice each position ascending and descending.",
  rootNote: "C",
  positions: [
    {
      positionId: "pos1",
      label: "Position 1 (Root on 5th string)",
      fretSpan: { low: 3, high: 5 },
      asc: [
        { string: 5, fret: 3 },
        { string: 4, fret: 2 },
        { string: 3, fret: 0 },
        { string: 2, fret: 1 },
        { string: 1, fret: 0 },
      ],
    },
    {
      positionId: "pos2",
      label: "Position 2 (Root on 6th string)",
      fretSpan: { low: 8, high: 12 },
      asc: [
        { string: 6, fret: 8 },
        { string: 5, fret: 7 },
        { string: 4, fret: 5 },
        { string: 3, fret: 5 },
        { string: 2, fret: 5 },
        { string: 1, fret: 3 },
      ],
    },
    {
      positionId: "pos3",
      label: "Position 3 (Higher inversion)",
      fretSpan: { low: 12, high: 17 },
      asc: [
        { string: 5, fret: 15 },
        { string: 4, fret: 14 },
        { string: 3, fret: 12 },
        { string: 2, fret: 13 },
        { string: 1, fret: 12 },
      ],
    },
  ],
};

export const EXERCISE_LIBRARY: ExerciseDefinition[] = [
  ...SCALE_LIBRARY,
  ARP_MAJOR_TRIAD_C_POSITIONS,
];
