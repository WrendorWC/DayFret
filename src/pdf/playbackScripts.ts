import { SectionScriptId } from "./catalog";

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11, 12];
const NATURAL_MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10, 12];
const HARMONIC_MINOR_SCALE = [0, 2, 3, 5, 7, 8, 11, 12];
const MELODIC_MINOR_SCALE = [0, 2, 3, 5, 7, 9, 11, 12];
const HARMONIC_MAJOR_SCALE = [0, 2, 4, 5, 7, 8, 11, 12];
const DOUBLE_HARMONIC_MAJOR_SCALE = [0, 1, 4, 5, 7, 8, 11, 12];
const MAJOR_PENTATONIC = [0, 2, 4, 7, 9, 12];
const MINOR_PENTATONIC = [0, 3, 5, 7, 10, 12];

function clampMidi(midi: number): number {
  return Math.max(40, Math.min(88, midi));
}

function buildScaleDegrees(intervals: number[], octaves: number): number[] {
  const degrees: number[] = [];

  for (let octave = 0; octave < octaves; octave += 1) {
    intervals.slice(0, -1).forEach((interval) => {
      degrees.push(interval + octave * 12);
    });
  }

  degrees.push(octaves * 12);
  return degrees;
}

function withDescending(sequence: number[]): number[] {
  if (sequence.length <= 1) return sequence;
  return [...sequence, ...[...sequence].reverse().slice(1)];
}

function buildStraightScaleScript(rootMidi: number, intervals: number[], octaves = 2): number[] {
  const degrees = buildScaleDegrees(intervals, octaves);
  return withDescending(degrees.map((offset) => clampMidi(rootMidi + offset)));
}

function buildAscendingScaleScript(rootMidi: number, intervals: number[], octaves = 2): number[] {
  const degrees = buildScaleDegrees(intervals, octaves);
  return degrees.map((offset) => clampMidi(rootMidi + offset));
}

function buildBrokenIntervalScript(
  rootMidi: number,
  intervals: number[],
  leap: number,
  octaves = 2,
): number[] {
  const degrees = buildScaleDegrees(intervals, octaves);
  const asc: number[] = [];

  for (let i = 0; i + leap < degrees.length; i += 1) {
    asc.push(clampMidi(rootMidi + degrees[i]));
    asc.push(clampMidi(rootMidi + degrees[i + leap]));
  }

  return withDescending(asc);
}

function buildArpeggioScript(rootMidi: number, intervals: number[], octaves = 2): number[] {
  const asc: number[] = [];

  for (let octave = 0; octave < octaves; octave += 1) {
    intervals.forEach((interval) => {
      asc.push(clampMidi(rootMidi + interval + octave * 12));
    });
  }

  asc.push(clampMidi(rootMidi + octaves * 12));

  return withDescending(asc);
}

function buildDiatonicSeventhArpeggios(rootMidi: number): number[] {
  const scale = [
    0, 2, 4, 5, 7, 9, 11,
    12, 14, 16, 17, 19, 21, 23,
    24, 26, 28, 29, 31, 33, 35,
  ];

  const sequence: number[] = [];

  for (let degree = 0; degree < 7; degree += 1) {
    const stack = [scale[degree], scale[degree + 2], scale[degree + 4], scale[degree + 6]];
    stack.forEach((offset) => sequence.push(clampMidi(rootMidi + offset)));
    stack.slice(0, -1).reverse().forEach((offset) => sequence.push(clampMidi(rootMidi + offset)));
  }

  return withDescending(sequence);
}

/**
 * Build the MIDI note sequence for a section, transposed to rootMidi.
 * rootMidi should come from the selected PdfKeyEntry (e.g. 48 for C, 43 for G).
 */
export function noteScriptForSection(scriptId: SectionScriptId, rootMidi: number): number[] | null {
  switch (scriptId) {
    case "none":
      return null;
    case "major_scale":
      return buildStraightScaleScript(rootMidi, MAJOR_SCALE);
    case "major_triad_arpeggio":
      return buildArpeggioScript(rootMidi, [0, 4, 7]);
    case "major_pentatonic":
      return buildStraightScaleScript(rootMidi, MAJOR_PENTATONIC);
    case "minor_triad_arpeggio":
      return buildArpeggioScript(rootMidi, [0, 3, 7]);
    case "minor_pentatonic":
      return buildStraightScaleScript(rootMidi, MINOR_PENTATONIC);
    case "major_broken_3":
      return buildBrokenIntervalScript(rootMidi, MAJOR_SCALE, 2);
    case "major_broken_4":
      return buildBrokenIntervalScript(rootMidi, MAJOR_SCALE, 3);
    case "major_broken_5":
      return buildBrokenIntervalScript(rootMidi, MAJOR_SCALE, 4);
    case "major_broken_6":
      return buildBrokenIntervalScript(rootMidi, MAJOR_SCALE, 5);
    case "major_broken_7":
      return buildBrokenIntervalScript(rootMidi, MAJOR_SCALE, 6);
    case "major_broken_8":
      return buildBrokenIntervalScript(rootMidi, MAJOR_SCALE, 7);
    case "major_broken_9":
      return buildBrokenIntervalScript(rootMidi, MAJOR_SCALE, 8);
    case "major_broken_10":
      return buildBrokenIntervalScript(rootMidi, MAJOR_SCALE, 9);
    case "diatonic_seventh_arpeggios":
      return buildDiatonicSeventhArpeggios(rootMidi);
    case "minor_scale":
      return buildStraightScaleScript(rootMidi, NATURAL_MINOR_SCALE);
    case "harmonic_minor_scale":
      return buildStraightScaleScript(rootMidi, HARMONIC_MINOR_SCALE);
    case "melodic_minor_scale":
      return buildStraightScaleScript(rootMidi, MELODIC_MINOR_SCALE);
    case "melodic_minor_ascending":
      return buildAscendingScaleScript(rootMidi, MELODIC_MINOR_SCALE);
    case "harmonic_major_scale":
      return buildStraightScaleScript(rootMidi, HARMONIC_MAJOR_SCALE);
    case "double_harmonic_major":
      return buildStraightScaleScript(rootMidi, DOUBLE_HARMONIC_MAJOR_SCALE);
    case "minor_broken_3":
      return buildBrokenIntervalScript(rootMidi, NATURAL_MINOR_SCALE, 2);
    case "minor_broken_4":
      return buildBrokenIntervalScript(rootMidi, NATURAL_MINOR_SCALE, 3);
    case "minor_broken_5":
      return buildBrokenIntervalScript(rootMidi, NATURAL_MINOR_SCALE, 4);
    case "minor_broken_6":
      return buildBrokenIntervalScript(rootMidi, NATURAL_MINOR_SCALE, 5);
    case "minor_broken_7":
      return buildBrokenIntervalScript(rootMidi, NATURAL_MINOR_SCALE, 6);
    case "minor_broken_8":
      return buildBrokenIntervalScript(rootMidi, NATURAL_MINOR_SCALE, 7);
    case "minor_broken_9":
      return buildBrokenIntervalScript(rootMidi, NATURAL_MINOR_SCALE, 8);
    case "minor_broken_10":
      return buildBrokenIntervalScript(rootMidi, NATURAL_MINOR_SCALE, 9);
    case "diminished_seventh_arpeggios":
      return buildArpeggioScript(rootMidi, [0, 3, 6, 9]);
    case "augmented_arpeggios":
      return buildArpeggioScript(rootMidi, [0, 4, 8]);
    default:
      return null;
  }
}
