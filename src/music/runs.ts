import { midiFor } from "./tuning";

export type RunNote = { stringIndex: number; fret: number; midi: number };

export const posKey = (stringIndex: number, fret: number): string => `${stringIndex}:${fret}`;

// Inside one hand position the same pitch often sits in two places — on
// adjacent strings five frets apart (four across the G and B strings), which
// the widened boxes now routinely contain. Only one of them gets played, so
// this picks the one that is actually easier under the hand and reports the
// other so the diagram can shade it back.
export function chooseRun(
  candidates: RunNote[],
  opts: { baseStart?: number; baseEnd?: number } = {},
): { run: RunNote[]; shadowed: Set<string> } {
  const byPitch = new Map<number, RunNote[]>();
  for (const n of candidates) {
    const list = byPitch.get(n.midi);
    if (list) list.push(n);
    else byPitch.set(n.midi, [n]);
  }

  const inBase = (n: RunNote): boolean =>
    opts.baseStart === undefined ||
    opts.baseEnd === undefined ||
    (n.fret >= opts.baseStart && n.fret <= opts.baseEnd);

  const run: RunNote[] = [];
  const shadowed = new Set<string>();

  for (const [, group] of byPitch) {
    // Prefer whichever one the hand can take most easily: inside the unstretched
    // four frets first, then the lower fret. Picking the lower fret is what stops
    // the run reaching out to, say, the E at the 9th fret of the G string when
    // the same E is already under the index finger on the B string.
    const best = [...group].sort((a, b) => {
      const base = Number(inBase(b)) - Number(inBase(a));
      if (base !== 0) return base;
      if (a.fret !== b.fret) return a.fret - b.fret;
      return a.stringIndex - b.stringIndex;
    })[0];

    run.push(best);
    for (const n of group) {
      if (n !== best) shadowed.add(posKey(n.stringIndex, n.fret));
    }
  }

  run.sort((a, b) => a.midi - b.midi);
  return { run, shadowed };
}

// A path across the whole neck, for when no single position is selected.
//
// Deduping by "lowest fret" is right inside one box but wrong over the whole
// fretboard: every pitch ends up crammed against the nut, and once the low
// frets run out the line has nowhere to go but straight up the top string.
// Guitarists instead move diagonally — a few notes per string, shifting up as
// they go — so each note here is the one nearest the hand's last position,
// never doubling back down a string.
export function ascendingPath(
  candidates: RunNote[],
  opts: { startMidi?: number; maxNotes?: number; maxPerString?: number } = {},
): RunNote[] {
  // Two notes per string for pentatonics, three for seven-note scales, which
  // is how these are actually fingered. Without a cap the line just walks the
  // low E string from end to end, because staying put is always the smallest
  // fret movement.
  const maxPerString = opts.maxPerString ?? 3;
  const byPitch = new Map<number, RunNote[]>();
  for (const n of candidates) {
    const list = byPitch.get(n.midi);
    if (list) list.push(n);
    else byPitch.set(n.midi, [n]);
  }

  let pitches = [...byPitch.keys()].sort((a, b) => a - b);
  if (opts.startMidi !== undefined) pitches = pitches.filter((p) => p >= opts.startMidi!);
  if (opts.maxNotes !== undefined) pitches = pitches.slice(0, opts.maxNotes);
  if (pitches.length === 0) return [];

  // Begin on the thickest string that carries the starting pitch, so the run
  // climbs the neck rather than starting halfway up it.
  const first = [...byPitch.get(pitches[0])!].sort(
    (a, b) => a.stringIndex - b.stringIndex || a.fret - b.fret,
  )[0];
  const path: RunNote[] = [first];
  let onThisString = 1;

  const cost = (n: RunNote, prev: RunNote): number => {
    const sameString = n.stringIndex === prev.stringIndex;
    return (
      Math.abs(n.fret - prev.fret) +
      // A small nudge to stay put, so the hand is not hopping every note
      (sameString ? 0 : 0.5) +
      // Sliding back down the neck mid-climb feels wrong under the hand
      (n.fret < prev.fret ? (prev.fret - n.fret) * 1.5 : 0) +
      // Once the string has had its share of notes, move on
      (sameString && onThisString >= maxPerString ? 100 : 0)
    );
  };

  for (const pitch of pitches.slice(1)) {
    const prev = path[path.length - 1];
    const options = byPitch.get(pitch) ?? [];

    // Only forwards: the same string higher up, or a thinner string.
    const forward = options.filter(
      (n) =>
        n.stringIndex > prev.stringIndex ||
        (n.stringIndex === prev.stringIndex && n.fret > prev.fret),
    );
    const pool = forward.length > 0 ? forward : options;
    if (pool.length === 0) continue;

    const next = [...pool].sort((a, b) => cost(a, prev) - cost(b, prev))[0];
    onThisString = next.stringIndex === prev.stringIndex ? onThisString + 1 : 1;
    path.push(next);
  }

  return path;
}

// Up and back down, without repeating the top note
export function upAndDown(run: RunNote[]): RunNote[] {
  return [...run, ...run.slice(0, -1).reverse()];
}

export const noteAt = (stringIndex: number, fret: number): RunNote => ({
  stringIndex,
  fret,
  midi: midiFor(stringIndex, fret),
});
