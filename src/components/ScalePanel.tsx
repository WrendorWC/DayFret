import { useEffect, useState } from "react";
import { ScaleDiagram } from "../music/scales";
import { ascendingPath, chooseRun, noteAt, upAndDown } from "../music/runs";
import { usePlayback } from "../hooks/usePlayback";
import { FretboardDiagram } from "./FretboardDiagram";

type ScalePanelProps = {
  diagram: ScaleDiagram;
  onSwap: () => void;
  tempoBpm?: number;
};

export function ScalePanel({ diagram, onSwap, tempoBpm = 90 }: ScalePanelProps): JSX.Element {
  const [labelMode, setLabelMode] = useState<"intervals" | "notes">("intervals");
  const [selectedBox, setSelectedBox] = useState<number | null>(null);
  const [boxIndex, setBoxIndex] = useState(0);
  const { playing, activeNote, playSequence, stop } = usePlayback(tempoBpm);

  // A position usually appears twice on the neck, an octave apart. Playback
  // stays inside whichever one is chosen rather than shifting between them.
  const boxesForPosition = diagram.boxes.filter((b) => b.number === selectedBox);
  const box = boxesForPosition[Math.min(boxIndex, boxesForPosition.length - 1)];
  const candidates = diagram.notes
    .filter((n) => (box ? n.fret >= box.start && n.fret <= box.end : true))
    .map((n) => noteAt(n.stringIndex, n.fret));
  const { run, shadowed } = chooseRun(candidates);

  // Inside a box the run is simply that box's notes. Across the whole neck it
  // needs a path instead: two octaves from the lowest root, moving diagonally
  // up the strings the way the scale is actually played.
  const lowestRoot = diagram.notes
    .filter((n) => n.isRoot)
    .map((n) => noteAt(n.stringIndex, n.fret).midi)
    .sort((a, b) => a - b)[0];
  const ascending = box
    ? run
    : ascendingPath(candidates, {
        startMidi: lowestRoot,
        maxNotes: diagram.scale.tones.length * 2 + 1,
        maxPerString: diagram.scale.tones.length <= 5 ? 2 : 3,
      });
  const runNotes = upAndDown(ascending);

  // Reset the position filter when the scale or key changes
  useEffect(() => {
    setSelectedBox(null);
  }, [diagram.scale.id, diagram.key.label]);

  useEffect(() => {
    setBoxIndex(0);
  }, [selectedBox, diagram.scale.id, diagram.key.label]);

  return (
    <section className="card chords-panel">
      <div className="chords-panel-header">
        <div className="viewer-book">Scale Explorer</div>
        <h2 className="chords-title">
          {diagram.scale.name} <span className="chords-key">in {diagram.key.label}</span>
        </h2>
        <p className="chords-description">{diagram.scale.description}</p>
      </div>

      <div className="label-toggle-row">
        <span className="label-toggle-caption">String labels:</span>
        <div className="segmented">
          <button
            type="button"
            className={`segment${labelMode === "intervals" ? " active" : ""}`}
            onClick={() => setLabelMode("intervals")}
          >
            Intervals
          </button>
          <button
            type="button"
            className={`segment${labelMode === "notes" ? " active" : ""}`}
            onClick={() => setLabelMode("notes")}
          >
            Notes
          </button>
        </div>

        <button
          type="button"
          className="play-button"
          onClick={() => (playing ? stop() : void playSequence(runNotes))}
        >
          {playing ? "■ Stop" : "▶ Play scale"}
        </button>

        <button type="button" className="swap-button" onClick={onSwap}>
          ⇄ Chords in this scale
        </button>
      </div>

      <div className="label-toggle-row">
        <span className="label-toggle-caption">Position:</span>
        <div className="segmented">
          <button
            type="button"
            className={`segment${selectedBox === null ? " active" : ""}`}
            onClick={() => setSelectedBox(null)}
          >
            All
          </button>
          {diagram.boxNumbers.map((n) => (
            <button
              key={n}
              type="button"
              className={`segment${selectedBox === n ? " active" : ""}`}
              onClick={() => setSelectedBox(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {boxesForPosition.length > 1 && (
        <div className="label-toggle-row">
          <span className="label-toggle-caption">Play box:</span>
          <div className="segmented">
            {boxesForPosition.map((b, i) => (
              <button
                key={`${b.start}-${b.end}`}
                type="button"
                className={`segment${i === Math.min(boxIndex, boxesForPosition.length - 1) ? " active" : ""}`}
                onClick={() => setBoxIndex(i)}
              >
                frets {b.start}–{b.end}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="fretboard-wrap">
        <FretboardDiagram
          diagram={diagram}
          labelMode={labelMode}
          selectedBox={selectedBox}
          activeNote={activeNote}
          shadowed={box ? shadowed : undefined}
          playBox={box ? { start: box.start, end: box.end } : undefined}
        />
      </div>

      <div className="chords-legend">
        {selectedBox === null
          ? "Brackets above the neck mark the fingering positions — pick one to zoom in. Position 1 starts at the root on the low E string."
          : `Position ${selectedBox}: play the highlighted window; the same shape repeats an octave up where it fits.`}
      </div>
    </section>
  );
}
