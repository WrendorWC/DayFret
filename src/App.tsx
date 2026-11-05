import { useEffect, useMemo, useRef, useState } from "react";
import { Metronome } from "./audio/metronome";
import { getAudioContext } from "./audio/audioContext";
import { PdfPageCanvas } from "./components/PdfPageCanvas";
import { ChordChartPanel } from "./components/ChordChartPanel";
import { ScalePanel } from "./components/ScalePanel";
import { ScaleChordsPanel } from "./components/ScaleChordsPanel";
import { ArpeggioPanel } from "./components/ArpeggioPanel";
import { RiffPanel } from "./components/RiffPanel";
import { ChordFinderPanel } from "./components/ChordFinderPanel";
import { ChordToolbar, ProgressionToolbar, ScaleToolbar } from "./components/PageToolbars";
import { ScaleChordShape, ScaleView, ScaleViewRow } from "./components/ScaleViewRow";
import { useChordChart } from "./hooks/useChordChart";
import { useReference } from "./hooks/useReference";
import {
  findBook,
  findKey,
  findSection,
  getDateISOInTimeZone,
  getDailyPracticeKeys,
  PDF_BOOKS,
} from "./pdf/catalog";

// All date/time logic is anchored to Eastern Time so the daily practice
// set and the greeting period stay consistent for the user regardless of
// which timezone the browser reports.
const TIME_ZONE = "America/New_York";

type TimePeriod = "morning" | "afternoon" | "evening";

type Tab = "daily" | "browse" | "progressions" | "riffs" | "chords" | "scales";

const PRACTICE_TABS: Array<{ id: Tab; label: string }> = [
  { id: "daily", label: "Today" },
  { id: "browse", label: "Books" },
  { id: "progressions", label: "Progressions" },
  { id: "riffs", label: "Riffs" },
];

const REFERENCE_TABS: Array<{ id: Tab; label: string }> = [
  { id: "chords", label: "Chords" },
  { id: "scales", label: "Scales" },
];

// Returns one of three named periods based on the local hour in TIME_ZONE.
// Morning: before noon  |  Afternoon: noon–4 pm  |  Evening: 5 pm onward
function getTimePeriod(timeZone: string): TimePeriod {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "12", 10);
  return hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
}

function getGreeting(period: TimePeriod): string {
  return `Good ${period}. Are you ready to play?`;
}

function dateLabelForHeader(dateISO: string): string {
  const [year, month, day] = dateISO.split("-").map(Number);
  // Construct a UTC instant at 05:00 on the given calendar date.  When
  // formatted back via TIME_ZONE, that safely lands on the correct local day
  // regardless of DST offset (ET is always UTC-4 or UTC-5, so 05:00 UTC is
  // never ambiguous).
  const anchor = new Date(Date.UTC(year, month - 1, day, 5, 0, 0));

  return anchor.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: TIME_ZONE,
  });
}

export default function App(): JSX.Element {
  const dateISO = useMemo(() => getDateISOInTimeZone(new Date(), TIME_ZONE), []);
  const dateLabel = useMemo(() => dateLabelForHeader(dateISO), [dateISO]);
  const period = useMemo(() => getTimePeriod(TIME_ZONE), []);
  const greeting = useMemo(() => getGreeting(period), [period]);

  // Stamp the time-of-day period on <body> so CSS can theme the background.
  useEffect(() => {
    document.body.dataset.period = period;
    return () => { delete document.body.dataset.period; };
  }, [period]);

  // ── Tab ────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>("daily");

  // ── Browse state ───────────────────────────────────────────────────────────
  const firstBook = PDF_BOOKS[0];
  const firstSection = firstBook.sections[0];
  const [selectedBookId, setSelectedBookId] = useState(firstBook.id);
  const [selectedSectionId, setSelectedSectionId] = useState(firstSection.id);
  const [selectedKeyId, setSelectedKeyId] = useState(firstSection.keys[0].id);

  const selectedBook = useMemo(() => findBook(selectedBookId), [selectedBookId]);
  const selectedSection = useMemo(
    () => findSection(selectedBook, selectedSectionId),
    [selectedBook, selectedSectionId],
  );
  const selectedKey = useMemo(
    () => findKey(selectedSection, selectedKeyId),
    [selectedSection, selectedKeyId],
  );

  // ── Daily Practice state ───────────────────────────────────────────────────
  const dailyPracticeKeys = useMemo(() => getDailyPracticeKeys(dateISO), [dateISO]);
  const [dailyIndex, setDailyIndex] = useState<number>(0);

  // ── Chord Chart state (shared hook, same behavior as the standalone app) ──
  const chords = useChordChart(dateISO);

  // ── Reference pages: Chords and Scales share one key (Riffs plays from
  // the Scales pick, so it follows too) ──────────────────────────────────────
  const { finder, scaleView } = useReference();
  const [scaleMode, setScaleMode] = useState<ScaleView>("positions");
  const [scaleChordShape, setScaleChordShape] = useState<ScaleChordShape>("grips");

  // Any chord card in the app opens that chord on the Chords page
  const openChord = (rootPc: number, typeId: string, rootName: string): void => {
    finder.openChord(rootPc, typeId, rootName);
    setActiveTab("chords");
  };
  const openScale = (scaleId: string, keyLabel: string): void => {
    scaleView.selectScale(scaleId, keyLabel);
    setScaleMode("positions");
    setActiveTab("scales");
  };

  // ── Active display (driven by whichever tab is open) ──────────────────────
  // dailyKey is always a PracticeKey (has bookId + sectionId); selectedKey is PdfKeyEntry.
  const dailyKey      = dailyPracticeKeys[dailyIndex];
  const activeKey     = activeTab === "browse" ? selectedKey  : dailyKey;
  const activeBook    = activeTab === "browse" ? selectedBook : findBook(dailyKey.bookId);
  const activeSection = activeTab === "browse" ? selectedSection : findSection(activeBook, dailyKey.sectionId);
  const activePage    = activeKey.page;

  // ── Metronome ──────────────────────────────────────────────────────────────
  const [tempoBpm, setTempoBpm] = useState<number>(90);
  const [volumeLevel, setVolumeLevel] = useState<number>(75);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const metronomeRef = useRef<Metronome | null>(null);
  if (!metronomeRef.current) metronomeRef.current = new Metronome();

  // ── Practice Timer ─────────────────────────────────────────────────────────
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  // Simple 1-second interval; no drift correction needed for a display timer.
  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => setTimerSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  // Beat grid, scheduled on the audio clock.
  //
  // The previous version compared performance.now() against an expected time
  // and skipped any tick that ran late. setInterval always fires a little late,
  // so that error accumulated until every tick was being skipped — the
  // metronome went quiet after a minute or two, sooner when the page was busy.
  // Instead a short timer looks ahead and books clicks at exact audio-clock
  // times, which is also the clock the riff player uses, so the two line up.
  const nextBeatRef = useRef<number>(0);

  useEffect(() => {
    if (!isPlaying) {
      nextBeatRef.current = 0;
      return;
    }

    const ctx = getAudioContext();
    const LOOKAHEAD = 0.12; // seconds of beats booked in advance

    if (nextBeatRef.current < ctx.currentTime) {
      nextBeatRef.current = ctx.currentTime + 0.08;
    }

    const schedule = (): void => {
      const secondsPerBeat = 60 / tempoBpm;
      while (nextBeatRef.current < ctx.currentTime + LOOKAHEAD) {
        metronomeRef.current!.clickAt(nextBeatRef.current);
        nextBeatRef.current += secondsPerBeat;
      }
    };

    schedule();
    const intervalId = window.setInterval(schedule, 25);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [isPlaying, tempoBpm]);

  // Where the next click lands, so the riff can start on the beat instead of
  // wherever the Play button happened to be pressed.
  const getNextBeat = (): number | null =>
    isPlaying && nextBeatRef.current > 0 ? nextBeatRef.current : null;

  const onTogglePlayback = async (): Promise<void> => {
    if (!isPlaying) {
      // The beat-grid effect books the first click as soon as it runs, so
      // firing one here as well produced a flam on every start.
      await metronomeRef.current!.resume();
    }
    setIsPlaying((prev) => !prev);
  };

  // ── Browse key navigation ──────────────────────────────────────────────────
  const currentKeyIndex = selectedSection.keys.findIndex((k) => k.id === selectedKeyId);
  const hasPrevKey = currentKeyIndex > 0;
  const hasNextKey = currentKeyIndex < selectedSection.keys.length - 1;

  const goToPrevKey = (): void => {
    if (!hasPrevKey) return;
    setSelectedKeyId(selectedSection.keys[currentKeyIndex - 1].id);
  };

  const goToNextKey = (): void => {
    if (!hasNextKey) return;
    setSelectedKeyId(selectedSection.keys[currentKeyIndex + 1].id);
  };

  // ── Daily navigation (wraps around) ───────────────────────────────────────
  const totalDaily = dailyPracticeKeys.length;
  const goPrevDaily = (): void =>
    setDailyIndex((i) => (i - 1 + totalDaily) % totalDaily);
  const goNextDaily = (): void =>
    setDailyIndex((i) => (i + 1) % totalDaily);

  // Format elapsed seconds as MM:SS.
  // tabular-nums in CSS keeps the display from shifting width as digits change.
  const formatTimer = (s: number): string => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="app-shell">
      <main className="pdf-layout">
        <aside className="sidebar-stack">

          <header className="app-header">
            <h1>
              <img src="/dayfret-icon.svg" alt="" className="app-title-icon" />
              DayFret
            </h1>
            <p className="app-greeting">{greeting}</p>
            <p className="app-date">{dateLabel}</p>
          </header>

          {/* Navigation: things you play, then things you look up */}
          <nav className="side-nav" aria-label="Sections">
            <div className="nav-caption">Practice</div>
            <div className="segmented nav-grid">
              {PRACTICE_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`segment${activeTab === t.id ? " active" : ""}`}
                  onClick={() => setActiveTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="nav-caption">Reference</div>
            <div className="segmented nav-grid">
              {REFERENCE_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`segment${activeTab === t.id ? " active" : ""}`}
                  onClick={() => setActiveTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </nav>

          {/* ── Metronome (always visible) ── */}
          <section className="card controls-grid">
            <div className="card-label">Metronome</div>

            <div>
              <div className="section-heading">Tempo: {tempoBpm} BPM</div>
              <input
                type="range"
                min={40}
                max={200}
                value={tempoBpm}
                onChange={(event) => setTempoBpm(Number(event.target.value))}
                className="tempo-slider"
                aria-label="Tempo"
              />
            </div>

            <div>
              <div className="section-heading">Volume: {volumeLevel}%</div>
              <input
                type="range"
                min={0}
                max={100}
                value={volumeLevel}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setVolumeLevel(next);
                  metronomeRef.current!.setVolume(next / 100);
                }}
                className="tempo-slider"
                aria-label="Volume"
              />
            </div>

            <div className="transport-row">
              <button type="button" className="primary-button" onClick={() => void onTogglePlayback()}>
                {isPlaying ? "Stop" : "Play"}
              </button>
            </div>
          </section>

          {/* ── Practice Timer (always visible) ── */}
          <section className="card controls-grid">
            <div className="card-label">Practice Timer</div>

            <div className="timer-display">{formatTimer(timerSeconds)}</div>

            <div className="pager-row">
              <button
                type="button"
                className="segment"
                onClick={() => setTimerRunning((r) => !r)}
              >
                {timerRunning ? "Pause" : "Start"}
              </button>
              <button
                type="button"
                className="segment"
                onClick={() => { setTimerRunning(false); setTimerSeconds(0); }}
              >
                Reset
              </button>
            </div>
          </section>

          {/* ── App icon — fills sidebar width, sits at the bottom ── */}
          <img
            src="/dayfret-icon.svg"
            alt="DayFret"
            className="sidebar-icon"
          />
        </aside>

        <div className="page-column">
          {activeTab === "daily" && (
            <section className="card page-toolbar">
              <div className="label-toggle-row finder-row">
                <span className="daily-counter toolbar-counter">
                  {dailyIndex + 1} <span>/ {dailyPracticeKeys.length}</span>
                </span>
                <span className="toolbar-summary">
                  <strong>{activeSection.title}</strong> · {activeKey.label}
                  <span className="toolbar-summary-book"> — {activeBook.title}</span>
                </span>
                <div className="segmented toolbar-actions">
                  <button type="button" className="segment" onClick={goPrevDaily}>
                    Prev
                  </button>
                  <button type="button" className="segment" onClick={goNextDaily}>
                    Next
                  </button>
                </div>
              </div>
            </section>
          )}

          {activeTab === "browse" && (
            <section className="card page-toolbar">
              <div className="label-toggle-row finder-row">
                <label className="label-toggle-caption" htmlFor="book-select">
                  Book:
                </label>
                <select
                  id="book-select"
                  className="menu-select toolbar-select"
                  value={selectedBook.id}
                  onChange={(event) => {
                    const nextBook = findBook(event.target.value as (typeof PDF_BOOKS)[number]["id"]);
                    const nextFirstSection = nextBook.sections[0];
                    setSelectedBookId(nextBook.id);
                    setSelectedSectionId(nextFirstSection.id);
                    setSelectedKeyId(nextFirstSection.keys[0].id);
                  }}
                >
                  {PDF_BOOKS.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.title}
                    </option>
                  ))}
                </select>

                <label className="label-toggle-caption" htmlFor="section-select">
                  Section:
                </label>
                <select
                  id="section-select"
                  className="menu-select toolbar-select"
                  value={selectedSection.id}
                  onChange={(event) => {
                    const nextSection = selectedBook.sections.find((s) => s.id === event.target.value);
                    if (!nextSection) return;
                    setSelectedSectionId(nextSection.id);
                    setSelectedKeyId(nextSection.keys[0].id);
                  }}
                >
                  {selectedBook.sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.title}
                    </option>
                  ))}
                </select>

                <label className="label-toggle-caption" htmlFor="key-select">
                  Key:
                </label>
                <select
                  id="key-select"
                  className="menu-select toolbar-select toolbar-select-narrow"
                  value={selectedKeyId}
                  onChange={(event) => setSelectedKeyId(event.target.value)}
                >
                  {selectedSection.keys.map((key) => (
                    <option key={key.id} value={key.id}>
                      {key.label}
                    </option>
                  ))}
                </select>

                <div className="segmented toolbar-actions">
                  <button type="button" className="segment" onClick={goToPrevKey} disabled={!hasPrevKey}>
                    Prev
                  </button>
                  <button type="button" className="segment" onClick={goToNextKey} disabled={!hasNextKey}>
                    Next
                  </button>
                </div>
              </div>
            </section>
          )}

          {activeTab === "progressions" && (
            <>
              <ProgressionToolbar chords={chords} />
              <ChordChartPanel
                chart={chords.chart}
                heading={chords.heading}
                tempoBpm={tempoBpm}
                onOpenChord={openChord}
              />
            </>
          )}

          {activeTab === "riffs" && (
            <>
              <ScaleToolbar scaleView={scaleView} />
              <RiffPanel
                scale={scaleView.diagram.scale}
                chartKey={scaleView.diagram.key}
                dateISO={dateISO}
                tempoBpm={tempoBpm}
                onTempoChange={setTempoBpm}
                getNextBeat={getNextBeat}
                onSelectScale={scaleView.selectScale}
              />
            </>
          )}

          {activeTab === "chords" && (
            <>
              <ChordToolbar finder={finder} />
              <ChordFinderPanel finder={finder} tempoBpm={tempoBpm} onOpenScale={openScale} />
            </>
          )}

          {activeTab === "scales" && (
            <>
              <ScaleToolbar scaleView={scaleView}>
                <ScaleViewRow
                  view={scaleMode}
                  onView={setScaleMode}
                  shape={scaleChordShape}
                  onShape={setScaleChordShape}
                  onRiffs={() => setActiveTab("riffs")}
                />
              </ScaleToolbar>
              {scaleMode === "positions" ? (
                <ScalePanel diagram={scaleView.diagram} tempoBpm={tempoBpm} />
              ) : scaleChordShape === "grips" ? (
                <ScaleChordsPanel
                  scale={scaleView.diagram.scale}
                  chartKey={scaleView.diagram.key}
                  tempoBpm={tempoBpm}
                  onOpenChord={openChord}
                />
              ) : (
                <ArpeggioPanel
                  scale={scaleView.diagram.scale}
                  chartKey={scaleView.diagram.key}
                  tempoBpm={tempoBpm}
                  onOpenChord={openChord}
                />
              )}
            </>
          )}

          {(activeTab === "daily" || activeTab === "browse") && (
            <PdfPageCanvas file={activeBook.file} page={activePage} />
          )}
        </div>
      </main>
    </div>
  );
}
