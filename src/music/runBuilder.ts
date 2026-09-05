import { MAX_FRET, MIN_FRET } from "./constants";
import { midiForStringFret } from "./utils";
import { NoteEvent, PositionPattern, RunDirection, Tuning } from "../types";

function mapPositionNotes(tuning: Tuning, pos: PositionPattern): NoteEvent[] {
  return pos.asc
    .filter((n) => n.fret >= MIN_FRET && n.fret <= MAX_FRET)
    .map((n) => ({
      string: n.string,
      fret: n.fret,
      midi: midiForStringFret(tuning, n.string, n.fret),
      duration: "8" as const,
    }));
}

function applyDirection(asc: NoteEvent[], direction: RunDirection): NoteEvent[] {
  const desc = [...asc].reverse();
  const descNoRepeat = desc.slice(1);
  return direction === "asc" ? asc : direction === "desc" ? desc : [...asc, ...descNoRepeat];
}

function anchorRunToRoot(notes: NoteEvent[], rootPitchClass?: number): NoteEvent[] {
  if (rootPitchClass === undefined) return notes;
  const idx = notes.findIndex((note) => note.midi % 12 === rootPitchClass);
  return idx >= 0 ? notes.slice(idx) : notes;
}

export function buildRun(
  tuning: Tuning,
  pos: PositionPattern,
  direction: RunDirection,
  rootPitchClass?: number,
): NoteEvent[] {
  const asc = anchorRunToRoot(mapPositionNotes(tuning, pos), rootPitchClass);
  const directed = applyDirection(asc, direction);
  return anchorRunToRoot(directed, rootPitchClass);
}

export function buildIntervalRun(
  tuning: Tuning,
  pos: PositionPattern,
  direction: RunDirection,
  intervalStep: number,
  rootPitchClass?: number,
): NoteEvent[] {
  let asc = mapPositionNotes(tuning, pos);
  if (asc.length === 0 || intervalStep <= 0 || asc.length <= intervalStep) return [];

  if (rootPitchClass !== undefined) {
    const firstRootIndex = asc.findIndex((note) => note.midi % 12 === rootPitchClass);
    if (firstRootIndex >= 0) {
      asc = asc.slice(firstRootIndex);
    }
    if (asc.length <= intervalStep) return [];
  }

  const intervalAsc: NoteEvent[] = [];
  for (let i = 0; i < asc.length - intervalStep; i += 1) {
    const current = asc[i];
    const target = asc[i + intervalStep];
    // Scale-step interval reading: 1-3, 2-4, 3-5...
    intervalAsc.push(current, target);
  }

  const directed = applyDirection(intervalAsc, direction);
  return anchorRunToRoot(directed, rootPitchClass);
}
