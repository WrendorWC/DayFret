import { useEffect, useMemo, useState } from "react";
import { ChartKey, voicingsForChord } from "../music/chords";
import { romanFor, ScaleDef, scaleChordDegrees } from "../music/scales";
import { midiFor } from "../music/tuning";
import { usePlayback } from "../hooks/usePlayback";
import { ChordDiagram } from "./ChordDiagram";
import { CyclerRow } from "./CyclerRow";
import { QUALITY_NAMES } from "./qualityNames";

type ScaleChordsPanelProps = {
  scale: ScaleDef;
  chartKey: ChartKey;
  onSwap: () => void;
  tempoBpm?: number;
};

type CellState = { qualityIndex: number; voicingIndex: number };

export function ScaleChordsPanel({
  scale,
  chartKey,
  onSwap,
  tempoBpm = 90,
}: ScaleChordsPanelProps): JSX.Element {
  const [labelMode, setLabelMode] = useState<"intervals" | "notes">("intervals");
  const { playing, activeIndex, playChord, playChords, stop } = usePlayback(tempoBpm);
  const midisOf = (frets: Array<number | null>) =>
    frets
      .map((f, i) => (f === null ? null : { midi: midiFor(i, f), stringIndex: i }))
      .filter((n): n is { midi: number; stringIndex: number } => n !== null);

  const degrees = useMemo(() => scaleChordDegrees(scale, chartKey), [scale, chartKey]);

  const [cells, setCells] = useState<CellState[]>(() =>
    degrees.map((d) => ({ qualityIndex: d.defaultQualityIndex, voicingIndex: 0 })),
  );

  // Reset every cell when the scale or key changes
  useEffect(() => {
    setCells(degrees.map((d) => ({ qualityIndex: d.defaultQualityIndex, voicingIndex: 0 })));
  }, [degrees]);

  const step = (i: number, field: keyof CellState, delta: number, count: number): void => {
    setCells((prev) =>
      prev.map((c, idx) => {
        if (idx !== i) return c;
        const next = { ...c, [field]: (c[field] + delta + count) % count };
        // Changing quality invalidates the voicing index
        if (field === "qualityIndex") next.voicingIndex = 0;
        return next;
      }),
    );
  };

  // Resolve each degree once, so the diagrams and the playback agree
  const resolved = degrees.map((degree, i) => {
    const cell = cells[i] ?? { qualityIndex: degree.defaultQualityIndex, voicingIndex: 0 };
    const quality = degree.qualities[cell.qualityIndex] ?? degree.qualities[0];
    const restricted = voicingsForChord(quality, degree.rootPc, degree.rootName, {
      allowedSemis: scale.tones.map((t) => t.semis),
      keyPitchClass: chartKey.pitchClass,
    });
    const options =
      restricted.length > 0
        ? restricted
        : voicingsForChord(quality, degree.rootPc, degree.rootName);
    return { degree, cell, quality, options, chord: options[cell.voicingIndex % options.length] };
  });

  return (
    <section className="card chords-panel">
      <div className="chords-panel-header">
        <div className="viewer-book">Chords in this scale</div>
        <h2 className="chords-title">
          {scale.name} <span className="chords-key">in {chartKey.label}</span>
        </h2>
        <p className="chords-description">
          Every chord this scale harmonizes, one per degree. Use ‹ › under each chord to cycle its
          voicing, and the quality row to hear it as a triad, seventh, or richer — only qualities
          the scale actually supports are offered.
        </p>
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
          onClick={() =>
            playing
              ? stop()
              : void playChords(
                  resolved.filter((r) => r.chord).map((r) => midisOf(r.chord.frets)),
                )
          }
        >
          {playing ? "■ Stop" : "▶ Play all"}
        </button>

        <button type="button" className="swap-button" onClick={onSwap}>
          ⇄ Back to the scale
        </button>
      </div>

      <div className="chords-grid">
        {resolved.map(({ degree, cell, quality, options, chord }, i) => {
          if (!chord) return null;

          return (
            <div
              className={`chord-cell scale-chord-cell${activeIndex === i ? " sounding" : ""}`}
              key={`${degree.romanBase}-${i}`}
            >
              <div className="scale-chord-roman">{romanFor(degree.romanBase, quality)}</div>
              <button
                type="button"
                className="chord-name chord-name-play"
                onClick={() => void playChord(midisOf(chord.frets), i)}
                title={`Play ${chord.name}`}
              >
                {chord.name} <span className="chord-play-icon">▶</span>
              </button>

              <ChordDiagram chord={chord} labelMode={labelMode} />

              <div className="chord-voicing-label">{chord.voicingLabel}</div>

              <CyclerRow
                caption={`Voicing ${(cell.voicingIndex % options.length) + 1}/${options.length}`}
                ariaLabel={`voicing for ${chord.name}`}
                count={options.length}
                onStep={(d) => step(i, "voicingIndex", d, options.length)}
              />
              <CyclerRow
                caption={QUALITY_NAMES[quality] ?? quality}
                ariaLabel={`quality for ${chord.name}`}
                count={degree.qualities.length}
                onStep={(d) => step(i, "qualityIndex", d, degree.qualities.length)}
              />
            </div>
          );
        })}
      </div>

      <div className="chords-legend">
        Suggested fingering: 1 index · 2 middle · 3 ring · 4 pinky — repeated numbers mean one
        finger barres those strings
      </div>
    </section>
  );
}
