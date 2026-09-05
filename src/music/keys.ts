export type AccidentalPreference = "sharp" | "flat";

export type KeyOption = {
  id: string;
  label: string;
  pitchClass: number;
  accidentalPreference: AccidentalPreference;
  keySignature: string;
};

export const KEY_OPTIONS: KeyOption[] = [
  { id: "c", label: "C", pitchClass: 0, accidentalPreference: "sharp", keySignature: "C" },
  { id: "g", label: "G", pitchClass: 7, accidentalPreference: "sharp", keySignature: "G" },
  { id: "d", label: "D", pitchClass: 2, accidentalPreference: "sharp", keySignature: "D" },
  { id: "a", label: "A", pitchClass: 9, accidentalPreference: "sharp", keySignature: "A" },
  { id: "e", label: "E", pitchClass: 4, accidentalPreference: "sharp", keySignature: "E" },
  { id: "b", label: "B", pitchClass: 11, accidentalPreference: "sharp", keySignature: "B" },
  { id: "f_sharp", label: "F#", pitchClass: 6, accidentalPreference: "sharp", keySignature: "F#" },
  { id: "d_flat", label: "Db", pitchClass: 1, accidentalPreference: "flat", keySignature: "Db" },
  { id: "a_flat", label: "Ab", pitchClass: 8, accidentalPreference: "flat", keySignature: "Ab" },
  { id: "e_flat", label: "Eb", pitchClass: 3, accidentalPreference: "flat", keySignature: "Eb" },
  { id: "b_flat", label: "Bb", pitchClass: 10, accidentalPreference: "flat", keySignature: "Bb" },
  { id: "f", label: "F", pitchClass: 5, accidentalPreference: "flat", keySignature: "F" },
];

export function getKeyOptionById(id: string): KeyOption {
  return KEY_OPTIONS.find((option) => option.id === id) ?? KEY_OPTIONS[0];
}
