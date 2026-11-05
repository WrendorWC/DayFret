import { useState } from "react";
import { ChordCategory, findChordType, typesInCategory } from "../music/chordFinder";

export type FinderView = "voicings" | "arpeggio" | "scales";

// Held by the app shell rather than the panel, so switching tabs and coming
// back finds the same chord still up.
export type ChordFinderState = {
  rootPc: number;
  accidentals: "sharp" | "flat";
  category: ChordCategory;
  typeId: string;
  bassPc: number | null; // null = root in the bass
  view: FinderView;
  showAll: boolean;
  setRootPc: (pc: number) => void;
  toggleAccidentals: () => void;
  setAccidentals: (a: "sharp" | "flat") => void;
  // Bring up one chord from elsewhere in the app (a progression card, a scale
  // degree): its root, its type, and the family row that lists it.
  openChord: (rootPc: number, typeId: string, rootName?: string) => void;
  setCategory: (c: ChordCategory) => void;
  setTypeId: (id: string) => void;
  setBassPc: (pc: number | null) => void;
  setView: (v: FinderView) => void;
  setShowAll: (all: boolean) => void;
};

export function useChordFinder(): ChordFinderState {
  const [rootPc, setRoot] = useState(0);
  const [accidentals, setAccidentals] = useState<"sharp" | "flat">("flat");
  const [category, setCat] = useState<ChordCategory>("Common");
  const [typeId, setType] = useState("maj");
  const [bassPc, setBassPc] = useState<number | null>(null);
  const [view, setView] = useState<FinderView>("voicings");
  const [showAll, setShowAll] = useState(false);

  return {
    rootPc,
    accidentals,
    category,
    typeId,
    bassPc,
    view,
    showAll,
    // A new root or chord type makes an old slash bass meaningless
    setRootPc: (pc) => {
      setRoot(pc);
      setBassPc(null);
    },
    toggleAccidentals: () => setAccidentals((a) => (a === "sharp" ? "flat" : "sharp")),
    setAccidentals,
    openChord: (pc, id, rootName) => {
      const chordType = findChordType(id);
      setRoot(((pc % 12) + 12) % 12);
      setType(chordType.id);
      setBassPc(null);
      setView("voicings");
      // Name the root the way the chart that sent it did: F♯ stays F♯
      if (rootName && rootName.length > 1) setAccidentals(rootName.includes("#") ? "sharp" : "flat");
      // Keep the family row on screen if it already lists the chord
      if (!typesInCategory(category).some((t) => t.id === chordType.id)) {
        setCat(typesInCategory("Common").some((t) => t.id === chordType.id) ? "Common" : chordType.category);
      }
    },
    setCategory: (c) => {
      setCat(c);
      // Keep the current chord if the new category lists it, else take its first
      const types = typesInCategory(c);
      if (!types.some((t) => t.id === typeId)) {
        setType(types[0].id);
        setBassPc(null);
      }
    },
    setTypeId: (id) => {
      setType(findChordType(id).id);
      setBassPc(null);
    },
    setBassPc,
    setView,
    setShowAll,
  };
}
