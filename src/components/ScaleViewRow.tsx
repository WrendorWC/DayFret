import { ViewSwitch } from "./PageToolbars";

export type ScaleView = "positions" | "chords";
export type ScaleChordShape = "grips" | "arpeggios";

// The Scales page has two views: the scale itself, by position, and the
// chords it harmonizes. Those chords can be shown as grips or as arpeggios.
// They were two separate views before, but they are the same seven chords
// either way, and the same degree strip.
export function ScaleViewRow({
  view,
  onView,
  shape,
  onShape,
  onRiffs,
}: {
  view: ScaleView;
  onView: (v: ScaleView) => void;
  shape: ScaleChordShape;
  onShape: (s: ScaleChordShape) => void;
  onRiffs?: () => void;
}): JSX.Element {
  return (
    <>
      <ViewSwitch
        value={view}
        onChange={onView}
        options={[
          { id: "positions", label: "Positions" },
          { id: "chords", label: "Chords in this scale" },
        ]}
      />
      {view === "chords" && (
        <ViewSwitch
          caption="As:"
          value={shape}
          onChange={onShape}
          options={[
            { id: "grips", label: "Grips" },
            { id: "arpeggios", label: "Arpeggios" },
          ]}
        />
      )}
      {onRiffs && (
        <button type="button" className="swap-button toolbar-link" onClick={onRiffs}>
          Riffs in this scale ›
        </button>
      )}
    </>
  );
}
