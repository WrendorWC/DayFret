import { Tuning } from "../types";
import { AccidentalPreference } from "./keys";

const NOTE_NAMES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_NAMES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

export function midiForStringFret(tuning: Tuning, string: 1 | 2 | 3 | 4 | 5 | 6, fret: number): number {
  const idx = 6 - string; // 6->0, 1->5
  return tuning.openStringMidi[idx] + fret;
}

export function midiToPitch(midi: number): { note: string; octave: number } {
  const note = NOTE_NAMES_SHARP[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return { note, octave };
}

export function pitchKeyForVexflow(
  midi: number,
  accidentalPreference: AccidentalPreference,
): { key: string; accidental: "#" | "b" | null } {
  const noteNames = accidentalPreference === "flat" ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  const note = noteNames[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  const letter = note[0].toLowerCase();
  const accidental = note.includes("#") ? "#" : note.includes("b") ? "b" : null;
  return {
    key: accidental ? `${letter}${accidental}/${octave}` : `${letter}/${octave}`,
    accidental,
  };
}

export function noteNameToPitchClass(noteName: string): number {
  const idx = NOTE_NAMES_SHARP.indexOf(noteName);
  return idx >= 0 ? idx : 0;
}
