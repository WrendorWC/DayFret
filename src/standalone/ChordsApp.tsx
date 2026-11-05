import { useEffect, useMemo, useState } from "react";
import { ChordChartPanel } from "../components/ChordChartPanel";
import { ScalePanel } from "../components/ScalePanel";
import { ScaleChordsPanel } from "../components/ScaleChordsPanel";
import { ArpeggioPanel } from "../components/ArpeggioPanel";
import { RiffPanel } from "../components/RiffPanel";
import { ChordFinderPanel } from "../components/ChordFinderPanel";
import { ChordToolbar, ProgressionToolbar, ScaleToolbar } from "../components/PageToolbars";
import { ScaleChordShape, ScaleView, ScaleViewRow } from "../components/ScaleViewRow";
import { useChordChart } from "../hooks/useChordChart";
import { useReference } from "../hooks/useReference";
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

type View = "progressions" | "riffs" | "chords" | "scales";

// Same layout as the main app, minus the PDF books: things you play, then
// things you look up.
const NAV: Array<{ caption: string; tabs: Array<{ id: View; label: string }> }> = [
  { caption: "Practice", tabs: [{ id: "progressions", label: "Progressions" }, { id: "riffs", label: "Riffs" }] },
  { caption: "Reference", tabs: [{ id: "chords", label: "Chords" }, { id: "scales", label: "Scales" }] },
];

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

  const chords = useChordChart(dateISO);
  const { finder, scaleView } = useReference();
  const [view, setView] = useState<View>("progressions");
  const [scaleMode, setScaleMode] = useState<ScaleView>("positions");
  const [scaleChordShape, setScaleChordShape] = useState<ScaleChordShape>("grips");

  const openChord = (rootPc: number, typeId: string, rootName: string): void => {
    finder.openChord(rootPc, typeId, rootName);
    setView("chords");
  };
  const openScale = (scaleId: string, keyLabel: string): void => {
    scaleView.selectScale(scaleId, keyLabel);
    setScaleMode("positions");
    setView("scales");
  };

  return (
    <div className="app-shell chords-app">
      <header className="app-header chords-app-header">
        <h1>DayFret Chords &amp; Scales</h1>
        <p className="app-greeting">Good {period}. Are you ready to play?</p>
        <p className="app-date">{dateLabel}</p>
      </header>

      <nav className="top-nav" aria-label="Sections">
        {NAV.map((group) => (
          <div className="top-nav-group" key={group.caption}>
            <span className="nav-caption">{group.caption}</span>
            <div className="segmented">
              {group.tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`segment${view === t.id ? " active" : ""}`}
                  onClick={() => setView(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="page-column">
        {view === "progressions" && (
          <>
            <ProgressionToolbar chords={chords} />
            <ChordChartPanel chart={chords.chart} heading={chords.heading} onOpenChord={openChord} />
          </>
        )}

        {view === "riffs" && (
          <>
            <ScaleToolbar scaleView={scaleView} />
            <RiffPanel
              scale={scaleView.diagram.scale}
              chartKey={scaleView.diagram.key}
              dateISO={dateISO}
              onSelectScale={scaleView.selectScale}
            />
          </>
        )}

        {view === "chords" && (
          <>
            <ChordToolbar finder={finder} />
            <ChordFinderPanel finder={finder} onOpenScale={openScale} />
          </>
        )}

        {view === "scales" && (
          <>
            <ScaleToolbar scaleView={scaleView}>
              <ScaleViewRow
                view={scaleMode}
                onView={setScaleMode}
                shape={scaleChordShape}
                onShape={setScaleChordShape}
                onRiffs={() => setView("riffs")}
              />
            </ScaleToolbar>
            {scaleMode === "positions" ? (
              <ScalePanel diagram={scaleView.diagram} />
            ) : scaleChordShape === "grips" ? (
              <ScaleChordsPanel
                scale={scaleView.diagram.scale}
                chartKey={scaleView.diagram.key}
                onOpenChord={openChord}
              />
            ) : (
              <ArpeggioPanel
                scale={scaleView.diagram.scale}
                chartKey={scaleView.diagram.key}
                onOpenChord={openChord}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
