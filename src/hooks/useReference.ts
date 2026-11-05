import { SCALE_KEYS } from "../music/scales";
import { ChordFinderState, useChordFinder } from "./useChordFinder";
import { ScaleViewState, useScaleView } from "./useScaleView";

// The two reference pages, Chords and Scales, plus Riffs (which plays from the
// Scales pick), share one key. Choose A on any of them and the others are in A
// when you get there.
//
// Only the key pickers carry across. The cross-links don't: opening Dm from C
// major's chords shows Dm without moving the scale to D, and opening C major
// from Am7's matching scales leaves the chord on Am7. Following a link is
// looking something up, not changing key.
export function useReference(): { finder: ChordFinderState; scaleView: ScaleViewState } {
  const finder = useChordFinder();
  const scaleView = useScaleView();

  const keyForPc = (pc: number) => SCALE_KEYS.find((k) => k.pitchClass === pc);

  return {
    finder: {
      ...finder,
      setRootPc: (pc) => {
        finder.setRootPc(pc);
        const key = keyForPc(pc);
        if (key) scaleView.onPickKey(key.label);
      },
    },
    scaleView: {
      ...scaleView,
      onPickKey: (label) => {
        scaleView.onPickKey(label);
        const key = SCALE_KEYS.find((k) => k.label === label);
        if (!key) return;
        finder.setRootPc(key.pitchClass);
        if (label.length > 1) finder.setAccidentals(label.includes("#") ? "sharp" : "flat");
      },
    },
  };
}
