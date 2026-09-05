// Standard tuning, low E to high E. Kept in one place because the fretboard,
// the arpeggio engine, the riff generator and the synth all need it.
export const OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64];

// stringIndex 0 is the low E string
export const midiFor = (stringIndex: number, fret: number): number =>
  OPEN_STRING_MIDI[stringIndex] + fret;
