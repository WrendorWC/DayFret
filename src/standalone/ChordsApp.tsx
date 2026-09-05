import { useEffect, useMemo, useState } from "react";
import { ChordChartPanel } from "../components/ChordChartPanel";
import { ScalePanel } from "../components/ScalePanel";
import { ScaleChordsPanel } from "../components/ScaleChordsPanel";
import { ArpeggioPanel } from "../components/ArpeggioPanel";
import { RiffPanel } from "../components/RiffPanel";
import { useChordChart } from "../hooks/useChordChart";
import { useScaleView } from "../hooks/useScaleView";
import { getDateISOInTimeZone } from "../music/daily";

// The standalone app is shared with other people, so unlike the main DayFret
// app it uses the viewer's local timezone rather than pinning to Eastern.
type TimePeriod = "morning" | "afternoon" | "evening";

function getTimePeriod(): TimePeriod {
  const hour = new Date().getHours();
  return hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
}

function dateLabelForHeader(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function ChordsApp(): JSX.Element {
  const dateISO = useMemo(
    () => getDateISOInTimeZone(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone),
    [],
  );
  const period = useMemo(() => getTimePeriod(), []);
  const dateLabel = useMemo(() => dateLabelForHeader(), []);

  useEffect(() => {
    document.body.dataset.period = period;
    return () => { delete document.body.dataset.period; };
  }, [period]);

  const {
    chart,
    isDailyChart,
    heading,
    keysForChart,
    progressions,
    onPickProgression,
    onPickKey,
    onSurpriseMe,
    onNewVoicings,
    onBackToToday,
  } = useChordChart(dateISO);

  const scaleView = useScaleView();
  const [view, setView] = useState<"chords" | "scales" | "riffs">("chords");

  // The swap button flips the Scales view between the fretboard and a chart of
  // every chord the scale harmonizes to, in the same key.
  const [scaleMode, setScaleMode] = useState<"fretboard" | "chords" | "arpeggios">("fretboard");

  return (
    <div className="app-shell chords-app">
      <header className="app-header chords-app-header">
        <h1>DayFret Chords &amp; Scales</h1>
        <p className="app-greeting">Good {period}. Are you ready to play?</p>
        <p className="app-date">{dateLabel}</p>
      </header>

      <div className="tab-bar">
        <div className="segmented">
          <button
            type="button"
            className={`segment${view === "chords" ? " active" : ""}`}
            onClick={() => setView("chords")}
          >
            Chord Charts
          </button>
          <button
            type="button"
            className={`segment${view === "scales" ? " active" : ""}`}
            onClick={() => setView("scales")}
          >
            Scales
          </button>
          <button
            type="button"
            className={`segment${view === "riffs" ? " active" : ""}`}
            onClick={() => setView("riffs")}
          >
            Riffs
          </button>
        </div>
      </div>

      {view === "riffs" && (
        <>
          <section className="card controls-card chords-app-controls">
            <div className="chords-picker-row">
              <div className="chords-picker">
                <label className="field-label" htmlFor="riff-scale-select">
                  Scale
                </label>
                <select
                  id="riff-scale-select"
                  className="menu-select"
                  value={scaleView.diagram.scale.id}
                  onChange={(event) => scaleView.onPickScale(event.target.value)}
                >
                  {scaleView.scales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="chords-picker">
                <label className="field-label" htmlFor="riff-key-select">
                  Key
                </label>
                <select
                  id="riff-key-select"
                  className="menu-select"
                  value={scaleView.diagram.key.label}
                  onChange={(event) => scaleView.onPickKey(event.target.value)}
                >
                  {scaleView.keys.map((k) => (
                    <option key={k.label} value={k.label}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>
          <RiffPanel
            scale={scaleView.diagram.scale}
            chartKey={scaleView.diagram.key}
            dateISO={dateISO}
          />
        </>
      )}

      {view === "scales" && (
        <>
          <section className="card controls-card chords-app-controls">
            <div className="chords-picker-row">
              <div className="chords-picker">
                <label className="field-label" htmlFor="scale-select">
                  Scale
                </label>
                <select
                  id="scale-select"
                  className="menu-select"
                  value={scaleView.diagram.scale.id}
                  onChange={(event) => scaleView.onPickScale(event.target.value)}
                >
                  {scaleView.scales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="chords-picker">
                <label className="field-label" htmlFor="scale-key-select">
                  Key
                </label>
                <select
                  id="scale-key-select"
                  className="menu-select"
                  value={scaleView.diagram.key.label}
                  onChange={(event) => scaleView.onPickKey(event.target.value)}
                >
                  {scaleView.keys.map((k) => (
                    <option key={k.label} value={k.label}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="chords-picker chords-picker-buttons">
                <div className="segmented">
                  <button
                    type="button"
                    className={`segment${scaleMode === "fretboard" ? " active" : ""}`}
                    onClick={() => setScaleMode("fretboard")}
                  >
                    Scale
                  </button>
                  <button
                    type="button"
                    className={`segment${scaleMode === "chords" ? " active" : ""}`}
                    onClick={() => setScaleMode("chords")}
                  >
                    Chords
                  </button>
                  <button
                    type="button"
                    className={`segment${scaleMode === "arpeggios" ? " active" : ""}`}
                    onClick={() => setScaleMode("arpeggios")}
                  >
                    Arpeggios
                  </button>
                </div>
              </div>
            </div>
          </section>

          {scaleMode === "chords" ? (
            <ScaleChordsPanel
              scale={scaleView.diagram.scale}
              chartKey={scaleView.diagram.key}
              onSwap={() => setScaleMode("fretboard")}
            />
          ) : scaleMode === "arpeggios" ? (
            <ArpeggioPanel scale={scaleView.diagram.scale} chartKey={scaleView.diagram.key} />
          ) : (
            <ScalePanel diagram={scaleView.diagram} onSwap={() => setScaleMode("chords")} />
          )}
        </>
      )}

      {view === "chords" && (
      <>
      <section className="card controls-card chords-app-controls">
        <div className="chords-picker-row">
          <div className="chords-picker">
            <label className="field-label" htmlFor="progression-select">
              Progression
            </label>
            <select
              id="progression-select"
              className="menu-select"
              value={chart.progression.id}
              onChange={(event) => onPickProgression(event.target.value)}
            >
              {progressions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="chords-picker">
            <label className="field-label" htmlFor="key-select">
              Key
            </label>
            <select
              id="key-select"
              className="menu-select"
              value={chart.key.label}
              onChange={(event) => onPickKey(event.target.value)}
              disabled={chart.progression.keyless}
            >
              {chart.progression.keyless ? (
                <option value={chart.key.label}>Open position</option>
              ) : (
                keysForChart.map((k) => (
                  <option key={k.label} value={k.label}>
                    {k.label} {chart.progression.mode}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="chords-picker chords-picker-buttons">
            <button type="button" className="primary-button" onClick={onSurpriseMe}>
              Surprise Me
            </button>
            <button type="button" className="segment" onClick={onNewVoicings}>
              New Voicings
            </button>
            <button
              type="button"
              className="segment"
              onClick={onBackToToday}
              disabled={isDailyChart}
            >
              Today
            </button>
          </div>
        </div>
      </section>

      <ChordChartPanel chart={chart} heading={heading} />
      </>
      )}
    </div>
  );
}
