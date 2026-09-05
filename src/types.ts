export type PracticeType = "scale" | "arpeggio";

export type RunDirection = "asc" | "desc" | "asc_desc";
export type PlaybackAudioMode = "metronome" | "metronome_notes" | "notes";
export type SoundfontStatus = "idle" | "loading" | "ready" | "failed";
export type RegisterMode = "acoustic" | "electric";
export type ScaleRepresentation =
  | "straight"
  | "seconds"
  | "thirds"
  | "fourths"
  | "fifths"
  | "sixths"
  | "sevenths";

export type Tuning = {
  name: string;
  // MIDI for open strings, string 6 to 1
  openStringMidi: [number, number, number, number, number, number];
};

export type NoteEvent = {
  string: 1 | 2 | 3 | 4 | 5 | 6; // 1 is high E, 6 is low E
  fret: number; // 0..22
  midi: number; // computed
  duration: "8"; // eighth notes for MVP
};

export type PositionPattern = {
  positionId: string; // "pos1" etc
  label: string; // "Position 1 (Box 1)"
  fretSpan: { low: number; high: number };
  // Ordered notes for ascending run
  asc: Array<{ string: 1 | 2 | 3 | 4 | 5 | 6; fret: number }>;
};

export type ExerciseDefinition = {
  id: string;
  name: string; // "Minor Pentatonic Boxes"
  practiceType: PracticeType; // "scale"
  description: string;
  rootNote: "C" | "C#" | "D" | "D#" | "E" | "F" | "F#" | "G" | "G#" | "A" | "A#" | "B";
  // Patterns represent positions across neck
  positions: PositionPattern[];
};
