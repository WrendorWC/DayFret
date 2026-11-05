import { useEffect, useState } from "react";
import { RIFF_FEELS, Riff, RiffComplexity, RiffEvent } from "../music/riffs";
import { SCALE_KEYS, SCALES } from "../music/scales";

// A favourite keeps the riff's actual notes, not just the settings that made
// it. The generator is seeded, but it is also still being improved, and a
// change to it would quietly turn a saved riff into a different one. Frozen
// notes play back the same years from now.
export type SavedRiff = {
  id: string;
  savedAt: string; // ISO timestamp
  scaleId: string;
  keyLabel: string;
  boxNumber: number;
  span?: number; // positions travelled; absent in favourites saved before spans existed
  feelId: string;
  complexity: RiffComplexity;
  bars: number;
  startFret: number;
  endFret: number;
  events: RiffEvent[];
};

const STORAGE_KEY = "dayfret.riffFavorites";

function readStored(): SavedRiff[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Two riffs are the same favourite if they play the same notes in the same
// place with the same settings
const fingerprint = (r: Pick<SavedRiff, "scaleId" | "keyLabel" | "feelId" | "complexity" | "events">): string =>
  JSON.stringify([r.scaleId, r.keyLabel, r.feelId, r.complexity, r.events]);

export function toSaved(riff: Riff): SavedRiff {
  return {
    id: `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    savedAt: new Date().toISOString(),
    scaleId: riff.scale.id,
    keyLabel: riff.key.label,
    boxNumber: riff.boxNumber,
    span: riff.span,
    feelId: riff.feel.id,
    complexity: riff.complexity,
    bars: riff.bars,
    startFret: riff.startFret,
    endFret: riff.endFret,
    events: riff.events,
  };
}

// Rebuild a playable Riff from a favourite
export function fromSaved(saved: SavedRiff): Riff {
  return {
    scale: SCALES.find((s) => s.id === saved.scaleId) ?? SCALES[0],
    key: SCALE_KEYS.find((k) => k.label === saved.keyLabel) ?? SCALE_KEYS[0],
    boxNumber: saved.boxNumber,
    span: saved.span ?? 1,
    startFret: saved.startFret,
    endFret: saved.endFret,
    feel: RIFF_FEELS.find((f) => f.id === saved.feelId) ?? RIFF_FEELS[0],
    bars: saved.bars,
    complexity: saved.complexity,
    events: saved.events,
  };
}

export type RiffFavorites = {
  favorites: SavedRiff[];
  find: (riff: Riff) => SavedRiff | undefined;
  save: (riff: Riff) => SavedRiff;
  remove: (id: string) => void;
};

export function useRiffFavorites(): RiffFavorites {
  const [favorites, setFavorites] = useState<SavedRiff[]>(readStored);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      // Storage unavailable: favourites last for the session only
    }
  }, [favorites]);

  const find = (riff: Riff) => {
    const fp = fingerprint(toSaved(riff));
    return favorites.find((f) => fingerprint(f) === fp);
  };

  return {
    favorites,
    find,
    save: (riff) => {
      const existing = find(riff);
      if (existing) return existing;
      const saved = toSaved(riff);
      setFavorites((list) => [saved, ...list]);
      return saved;
    },
    remove: (id) => setFavorites((list) => list.filter((f) => f.id !== id)),
  };
}
