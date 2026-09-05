import { ChordQuality } from "../music/chords";

// Human-readable names used by the chord quality cyclers.
export const QUALITY_NAMES: Record<ChordQuality, string> = {
  maj: "Major",
  min: "Minor",
  add9: "add9",
  "7": "7th",
  maj7: "maj7",
  m7: "m7",
  m7b5: "m7♭5",
  dim7: "dim7",
  aug: "Augmented",
  aug7: "7♯5",
};
