import { useEffect, useState } from "react";
import {
  ChordChart,
  ChordQuality,
  PlacedChord,
  RELATED_QUALITIES,
  voicingsForChord,
} from "../music/chords";
import { midiFor } from "../music/tuning";
import { usePlayback } from "../hooks/usePlayback";
import { ChordDiagram } from "./ChordDiagram";
import { CyclerRow } from "./CyclerRow";
import { QUALITY_NAMES } from "./qualityNames";

type ChordChartPanelProps = {
  chart: ChordChart;
  heading: string;
  onSwap?: () => void; // jump to the paired view (e.g. back to the scale)
  swapLabel?: string;
  tempoBpm?: number;
};

// Per-chord tweaks made with the cyclers. Absent means "use the chart's own
// seeded voicing", which is the voice-led choice the generator made.
type Override = { qualityIndex: number; voicingIndex: number };

export function ChordChartPanel({
  chart,
  heading,
  onSwap,
  swapLabel,
  tempoBpm = 90,
}: ChordChartPanelProps): JSX.Element {
  const keyLabel = `${chart.key.label} ${chart.mode}`;
  const isKeyless = chart.progression.keyless === true;
  const [labelMode, setLabelMode] = useState<"intervals" | "notes">("intervals");
  const [overrides, setOverrides] = useState<Record<number, Override>>({});
  const { playing, activeIndex, playChord, playChords, stop } = usePlayback(tempoBpm);

  // Sounding notes of a voicing, carrying the string each is played on so the
  // synth can give it that string's tone.
  const midisOf = (c: PlacedChord) =>
    c.frets
      .map((fret, i) => (fret === null ? null : { midi: midiFor(i, fret), stringIndex: i }))
      .filter((n): n is { midi: number; stringIndex: number } => n !== null);

  // Any change of progression, key, or re-roll clears manual tweaks
  useEffect(() => {
    setOverrides({});
  }, [chart]);

  const restrict = chart.progression.allowedSemis
    ? { allowedSemis: chart.progression.allowedSemis, keyPitchClass: chart.key.pitchClass }
    : undefined;

  // Resolve what to draw for one chord: either the chart's own voicing or,
  // once the user has cycled, the selected quality + voicing.
  const resolve = (
    base: PlacedChord,
    index: number,
  ): { chord: PlacedChord; family: ChordQuality[]; quality: ChordQuality; options: PlacedChord[]; voicingIndex: number } => {
    const family = RELATED_QUALITIES[base.quality] ?? [base.quality];
    const override = overrides[index];
    const quality = override ? family[override.qualityIndex] : base.quality;

    let options = voicingsForChord(quality, base.rootPc, base.rootName, restrict);
    if (options.length === 0) {
      options = voicingsForChord(quality, base.rootPc, base.rootName);
    }
    if (options.length === 0) {
      return { chord: base, family, quality, options: [base], voicingIndex: 0 };
    }

    // With no override, keep the chart's voicing and report where it sits in
    // the list so stepping continues from there rather than jumping to #1.
    if (!override) {
      const at = options.findIndex((o) => o.voicingLabel === base.voicingLabel);
      return { chord: base, family, quality, options, voicingIndex: at >= 0 ? at : 0 };
    }

    const idx = ((override.voicingIndex % options.length) + options.length) % options.length;
    // Library voicings carry no roman numeral; keep the chart's own so the
    // numeral line never disappears and resize the card.
    return {
      chord: { ...options[idx], rn: base.rn },
      family,
      quality,
      options,
      voicingIndex: idx,
    };
  };

  const step = (
    index: number,
    field: keyof Override,
    delta: number,
    count: number,
    current: Override,
  ): void => {
    setOverrides((prev) => {
      const from = prev[index] ?? current;
      const next: Override = { ...from, [field]: (from[field] + delta + count) % count };
      // A new quality invalidates the voicing choice
      if (field === "qualityIndex") next.voicingIndex = 0;
      return { ...prev, [index]: next };
    });
  };

  return (
    <section className="card chords-panel">
      <div className="chords-panel-header">
        <div className="viewer-book">{heading}</div>
        <h2 className="chords-title">
          {chart.progression.name}
          {!isKeyless && <span className="chords-key"> in {keyLabel}</span>}
        </h2>
        <p className="chords-description">{chart.progression.description}</p>
      </div>

      {!isKeyless && (
        <div className="numeral-strip">
          {chart.chords.map((chord, i) => (
            <div className="numeral-step" key={`${chord.rn}-${i}`}>
              {i > 0 && <span className="numeral-arrow">→</span>}
              <span className="numeral-chip">
                {chord.rn}
                <span className="numeral-name">{resolve(chord, i).chord.name}</span>
              </span>
            </div>
          ))}
        </div>
      )}

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
              : void playChords(chart.chords.map((c, i) => midisOf(resolve(c, i).chord)))
          }
        >
          {playing ? "■ Stop" : "▶ Play chart"}
        </button>

        {onSwap && (
          <button type="button" className="swap-button" onClick={onSwap}>
            {swapLabel ?? "⇄ Swap"}
          </button>
        )}
      </div>

      <div className="chords-grid">
        {chart.chords.map((base, i) => {
          const { chord, family, quality, options, voicingIndex } = resolve(base, i);
          const current: Override = {
            qualityIndex: Math.max(0, family.indexOf(quality)),
            voicingIndex,
          };

          return (
            <div
              className={`chord-cell scale-chord-cell${activeIndex === i ? " sounding" : ""}`}
              key={`${base.rn}-${base.name}-${i}`}
            >
              {chord.rn && <div className="scale-chord-roman">{chord.rn}</div>}
              <button
                type="button"
                className="chord-name chord-name-play"
                onClick={() => void playChord(midisOf(chord), i)}
                title={`Play ${chord.name}`}
              >
                {chord.name} <span className="chord-play-icon">▶</span>
              </button>

              <ChordDiagram chord={chord} labelMode={labelMode} />

              <div className="chord-voicing-label">{chord.voicingLabel}</div>

              {!isKeyless && (
                <>
                  <CyclerRow
                    caption={`Voicing ${voicingIndex + 1}/${options.length}`}
                    ariaLabel={`voicing for ${chord.name}`}
                    count={options.length}
                    onStep={(d) => step(i, "voicingIndex", d, options.length, current)}
                  />
                  <CyclerRow
                    caption={QUALITY_NAMES[quality] ?? quality}
                    ariaLabel={`quality for ${chord.name}`}
                    count={family.length}
                    onStep={(d) => step(i, "qualityIndex", d, family.length, current)}
                  />
                </>
              )}
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
