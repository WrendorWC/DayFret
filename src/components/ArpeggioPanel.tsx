import { useEffect, useMemo, useState } from "react";
import {
  ArpeggioSize,
  buildArpeggios,
  ROOT_FINGERS,
  ROOT_STRINGS,
  STRING_ORDINAL,
} from "../music/arpeggios";
import { ChartKey } from "../music/chords";
import { buildScaleDiagram, ScaleDef } from "../music/scales";
import { chooseRun, noteAt, upAndDown } from "../music/runs";
import { midiFor } from "../music/tuning";
import { usePlayback } from "../hooks/usePlayback";
import { ArpeggioNeck } from "./ArpeggioNeck";

type ArpeggioPanelProps = {
  scale: ScaleDef;
  chartKey: ChartKey;
  tempoBpm?: number;
};

export function ArpeggioPanel({
  scale,
  chartKey,
  tempoBpm = 90,
}: ArpeggioPanelProps): JSX.Element {
  const [size, setSize] = useState<ArpeggioSize>(3);
  const [labelMode, setLabelMode] = useState<"intervals" | "notes">("intervals");
  const [degreeIndex, setDegreeIndex] = useState(0);
  const [rootString, setRootString] = useState<6 | 5 | 4 | 3>(6);
  const [finger, setFinger] = useState<1 | 2 | 3 | 4>(1);
  const [boxIndex, setBoxIndex] = useState(0);
  const { playing, activeNote, playSequence, stop } = usePlayback(tempoBpm);

  const scaleDiagram = useMemo(() => buildScaleDiagram(scale, chartKey), [scale, chartKey]);
  const entries = useMemo(() => buildArpeggios(scale, chartKey, size), [scale, chartKey, size]);

  // Keep the selected degree in range when the scale or size changes
  useEffect(() => {
    setDegreeIndex((i) => (i < entries.length ? i : 0));
  }, [entries]);

  useEffect(() => {
    setBoxIndex(0);
  }, [entries, rootString, finger]);

  if (entries.length === 0) {
    return (
      <section className="card chords-panel">
        <div className="chords-panel-header">
          <div className="viewer-book">Arpeggios in this scale</div>
          <h2 className="chords-title">
            {scale.name} <span className="chords-key">in {chartKey.label}</span>
          </h2>
        </div>
        <div className="chords-legend">
          This scale contains no complete {size === 3 ? "triads" : "seventh chords"}.
          <button type="button" className="swap-button" onClick={() => setSize(size === 3 ? 4 : 3)}>
            Try {size === 3 ? "4-note" : "3-note"} instead
          </button>
        </div>
      </section>
    );
  }

  const entry = entries[Math.min(degreeIndex, entries.length - 1)];
  const position =
    entry.positions.find((p) => p.rootString === rootString && p.finger === finger) ??
    entry.positions[0];

  // Playback stays inside one box. A shape that fits twice on the neck is the
  // same shape an octave apart, so running across both would mean shifting the
  // hand mid-phrase — the point of a position is that you do not.
  const activeBox = position.boxes[Math.min(boxIndex, position.boxes.length - 1)];
  const rootMidi = midiFor(6 - position.rootString, activeBox.rootFret);
  const arpCandidates = entry.notes
    .filter((n) => n.fret >= activeBox.startFret && n.fret <= activeBox.endFret)
    .map((n) => noteAt(n.stringIndex, n.fret))
    .filter((n) => n.midi >= rootMidi);
  const { run: arpAscending, shadowed: arpShadowed } = chooseRun(arpCandidates, {
    baseStart: activeBox.baseStart,
    baseEnd: activeBox.baseEnd,
  });
  const arpRun = upAndDown(arpAscending);

  return (
    <section className="card chords-panel">
      <div className="chords-panel-header">
        <div className="viewer-book">Arpeggios in this scale</div>
        <h2 className="chords-title">
          {entry.name} <span className="chords-key">— {entry.romanBase} of {chartKey.label} {scale.name}</span>
        </h2>
        <p className="chords-description">
          The whole scale is shown greyed out; the {entry.type.name.toLowerCase()} on this degree is
          picked out in colour, with the notes inside the position box filled in and fingered.
          Take the root on the {STRING_ORDINAL[position.rootString]} string with finger{" "}
          {position.finger}: the hand sits over frets {position.baseStart}–{position.baseEnd}, one
          finger per fret.{" "}
          {position.stretched
            ? `The box widens to ${position.startFret}–${position.endFret} because the run needs a note outside that hand position — reach back with the index or forward with the pinky, so no chord tone gets skipped.`
            : "Every chord tone of the run falls inside that box."}{" "}
          Start on the root and run upward — anything lower than it is drawn hollow, since it sits
          below where the arpeggio begins.
        </p>
      </div>

      <div className="label-toggle-row">
        <span className="label-toggle-caption">Arpeggio:</span>
        <div className="segmented">
          <button type="button" className={`segment${size === 3 ? " active" : ""}`} onClick={() => setSize(3)}>
            3-note
          </button>
          <button type="button" className={`segment${size === 4 ? " active" : ""}`} onClick={() => setSize(4)}>
            4-note
          </button>
        </div>

        <span className="label-toggle-caption">Labels:</span>
        <div className="segmented">
          <button type="button" className={`segment${labelMode === "intervals" ? " active" : ""}`} onClick={() => setLabelMode("intervals")}>
            Intervals
          </button>
          <button type="button" className={`segment${labelMode === "notes" ? " active" : ""}`} onClick={() => setLabelMode("notes")}>
            Notes
          </button>
        </div>
      </div>

      <div className="label-toggle-row">
        <span className="label-toggle-caption">Degree:</span>
        <div className="segmented degree-strip">
          {entries.map((e, i) => (
            <button
              key={e.name}
              type="button"
              className={`segment${i === degreeIndex ? " active" : ""}`}
              onClick={() => setDegreeIndex(i)}
            >
              {e.romanBase}
              <span className="degree-chip-name">{e.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="label-toggle-row">
        <span className="label-toggle-caption">Root on:</span>
        <div className="segmented">
          {ROOT_STRINGS.map((s) => (
            <button
              key={s}
              type="button"
              className={`segment${rootString === s ? " active" : ""}`}
              onClick={() => setRootString(s)}
              disabled={!entry.positions.some((p) => p.rootString === s)}
            >
              {STRING_ORDINAL[s]} string
            </button>
          ))}
        </div>

        <span className="label-toggle-caption">with finger:</span>
        <div className="segmented">
          {ROOT_FINGERS.map((f) => (
            <button
              key={f}
              type="button"
              className={`segment${finger === f ? " active" : ""}`}
              onClick={() => setFinger(f)}
              disabled={!entry.positions.some((p) => p.rootString === rootString && p.finger === f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {position.boxes.length > 1 && (
        <div className="label-toggle-row">
          <span className="label-toggle-caption">Play box:</span>
          <div className="segmented">
            {position.boxes.map((b, i) => (
              <button
                key={`${b.startFret}-${b.endFret}`}
                type="button"
                className={`segment${i === Math.min(boxIndex, position.boxes.length - 1) ? " active" : ""}`}
                onClick={() => setBoxIndex(i)}
              >
                frets {b.startFret}–{b.endFret}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="label-toggle-row">
        <button
          type="button"
          className="play-button"
          onClick={() => (playing ? stop() : void playSequence(arpRun))}
        >
          {playing ? "■ Stop" : "▶ Play arpeggio"}
        </button>
      </div>

      <div className="fretboard-wrap">
        <ArpeggioNeck
          scaleDiagram={scaleDiagram}
          entry={entry}
          position={position}
          labelMode={labelMode}
          activeNote={activeNote}
          shadowed={arpShadowed}
          playBox={activeBox}
        />
      </div>

      <div className="chords-legend">
        Rust = root · blue = the other arpeggio tones · grey = the rest of the scale · hollow =
        below the starting root, so outside the run. Numbers above the dots are the suggested
        fingers (1 index … 4 pinky). Sixteen positions per arpeggio: the root on the 6th, 5th,
        4th, or 3rd string, taken with each of the four fingers.
      </div>
    </section>
  );
}
