import { useEffect, useMemo, useRef, useState } from "react";
import { getRiffSynth, RiffTone } from "../audio/riffSynth";
import { ChartKey } from "../music/chords";
import {
  generateRiff,
  RIFF_COMPLEXITY,
  RIFF_FEELS,
  RiffComplexity,
  riffSeed,
  TICKS_PER_QUARTER,
} from "../music/riffs";
import { buildScaleDiagram, ScaleDef } from "../music/scales";
import { TabStaff } from "./TabStaff";
import { fromSaved, SavedRiff, useRiffFavorites } from "../hooks/useRiffFavorites";
import { positionLabel, RiffFavoritesList } from "./RiffFavoritesList";

type RiffPanelProps = {
  scale: ScaleDef;
  chartKey: ChartKey;
  dateISO: string;
  // When the app owns the tempo (so the click and the riff share one BPM) it
  // passes it down; standalone use falls back to local state.
  tempoBpm?: number;
  onTempoChange?: (bpm: number) => void;
  // Audio-clock time of the next metronome beat, or null when it is not
  // running. Used to start the riff exactly on a click.
  getNextBeat?: () => number | null;
  // Bring up a favourite's scale and key in the page's pickers
  onSelectScale?: (scaleId: string, keyLabel: string) => void;
};

const TECHNIQUE_KEY: Array<[string, string]> = [
  ["H / P", "hammer-on and pull-off"],
  ["/", "slide"],
  ["↗ full", "bend a whole step"],
  ["↗ ½", "bend a half step"],
  ["↗↘", "bend and release"],
  // vibrato is drawn, not typed — see below
];

// The sine-wave character is missing from many system fonts, so the legend
// draws the same squiggle the staff does.
function VibratoMark(): JSX.Element {
  return (
    <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden="true" className="tab-key-glyph">
      <path
        d="M 1 6 q 2 -4 4 0 q 2 4 4 0 q 2 -4 4 0 q 2 4 4 0"
        fill="none"
        stroke="#1b5c98"
        strokeWidth="1.4"
      />
    </svg>
  );
}

export function RiffPanel({
  scale,
  chartKey,
  dateISO,
  tempoBpm,
  onTempoChange,
  getNextBeat,
  onSelectScale,
}: RiffPanelProps): JSX.Element {
  const [feelId, setFeelId] = useState(RIFF_FEELS[0].id);
  const [boxNumber, setBoxNumber] = useState(1);
  // How many positions the riff travels through, starting from boxNumber
  const [span, setSpan] = useState(1);
  const [variant, setVariant] = useState(0);
  const [complexity, setComplexity] = useState<RiffComplexity>(2);
  const [localBpm, setLocalBpm] = useState(92);
  const [loop, setLoop] = useState(true);
  const [tone, setTone] = useState<RiffTone>("clean");
  const [riffVolume, setRiffVolume] = useState(75);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState<number | null>(null);

  // A single tempo keeps the riff and the click in step
  const bpm = tempoBpm ?? localBpm;
  const setBpm = (v: number): void => {
    if (onTempoChange) onTempoChange(v);
    else setLocalBpm(v);
  };

  const synthRef = useRef(getRiffSynth());
  const rafRef = useRef<number | null>(null);

  const diagram = useMemo(() => buildScaleDiagram(scale, chartKey), [scale, chartKey]);
  const boxNumbers = diagram.boxNumbers;
  const feel = RIFF_FEELS.find((f) => f.id === feelId) ?? RIFF_FEELS[0];

  const level = RIFF_COMPLEXITY.find((c) => c.level === complexity) ?? RIFF_COMPLEXITY[1];
  const generated = useMemo(
    () => generateRiff(scale, chartKey, boxNumber, feel, riffSeed(dateISO, variant), undefined, complexity, span),
    [scale, chartKey, boxNumber, feel, dateISO, variant, complexity, span],
  );

  // A favourite, when one is open, replaces the generated riff until any
  // setting is changed
  const favorites = useRiffFavorites();
  const [loaded, setLoaded] = useState<SavedRiff | null>(null);
  const riff = useMemo(() => (loaded ? fromSaved(loaded) : generated), [loaded, generated]);
  const savedAs = favorites.find(riff);

  // Picking another scale or key in the page toolbar leaves the favourite
  useEffect(() => {
    if (loaded && (loaded.scaleId !== scale.id || loaded.keyLabel !== chartKey.label)) setLoaded(null);
  }, [loaded, scale.id, chartKey.label]);

  const openFavorite = (f: SavedRiff): void => {
    setFeelId(f.feelId);
    setComplexity(f.complexity);
    setBoxNumber(f.boxNumber);
    setSpan(f.span ?? 1);
    onSelectScale?.(f.scaleId, f.keyLabel);
    setLoaded(f);
  };
  // Any setting change goes back to generated riffs
  const leaving = <T,>(set: (v: T) => void) => (v: T) => {
    setLoaded(null);
    set(v);
  };

  const isRiffOfTheDay = variant === 0 && !loaded;

  // Stop playback whenever the riff itself changes
  useEffect(() => {
    synthRef.current.stop();
    setPlaying(false);
    setPlayhead(null);
  }, [riff]);

  useEffect(() => () => synthRef.current.stop(), []);

  useEffect(() => {
    synthRef.current.setTone(tone);
  }, [tone]);

  // The riff player has its own level so it can be balanced against the
  // metronome, which has a separate volume of its own.
  useEffect(() => {
    synthRef.current.setVolume(riffVolume / 100);
  }, [riffVolume]);

  const stop = (): void => {
    synthRef.current.stop();
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setPlaying(false);
    setPlayhead(null);
  };

  const play = async (): Promise<void> => {
    const synth = synthRef.current;
    await synth.resume();
    // If the metronome is running, come in on the next beat so bar one of the
    // riff lands on a click instead of floating against it.
    const beat = getNextBeat?.() ?? null;
    const { startTime, totalSeconds } = synth.play(riff, bpm, loop, beat ?? undefined);
    setPlaying(true);

    const secPerTick = 60 / bpm / TICKS_PER_QUARTER;
    const totalTicks = riff.events.reduce((s, e) => s + e.duration, 0);

    const tick = (): void => {
      const now = synth.heardTime;
      if (now >= synth.endsAt) {
        stop();
        return;
      }
      const elapsed = Math.max(0, now - startTime);
      const within = loop ? elapsed % totalSeconds : Math.min(elapsed, totalSeconds);
      setPlayhead(Math.min(totalTicks, within / secPerTick));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  return (
    <section className="card chords-panel">
      <div className="chords-panel-header">
        <div className="viewer-book">{loaded ? "Favorite riff" : isRiffOfTheDay ? "Riff of the Day" : "Riff"}</div>
        <h2 className="chords-title">
          {feel.name} riff{" "}
          <span className="chords-key">
            in {chartKey.label} {scale.name} · {positionLabel(riff.boxNumber, riff.span, boxNumbers.length)} (frets {riff.startFret}–
            {riff.endFret})
          </span>
        </h2>
        <p className="chords-description">
          {feel.description} {level.description}{" "}
          {riff.bars > level.bars ? `Stretched to ${riff.bars} bars so it has time to travel. ` : ""}
          {riff.endFret - riff.startFret <= level.handSpan
            ? "It stays inside one position, so you can play it without moving your hand."
            : `The hand ranges over frets ${riff.startFret}–${riff.endFret}, so expect to shift.`}
        </p>
      </div>

      <div className="label-toggle-row">
        <span className="label-toggle-caption">Feel:</span>
        <div className="segmented">
          {RIFF_FEELS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`segment${f.id === feelId ? " active" : ""}`}
              onClick={() => leaving(setFeelId)(f.id)}
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>

      <div className="label-toggle-row">
        <span className="label-toggle-caption">Difficulty:</span>
        <div className="segmented">
          {RIFF_COMPLEXITY.map((c) => (
            <button
              key={c.level}
              type="button"
              className={`segment${c.level === complexity ? " active" : ""}`}
              onClick={() => leaving(setComplexity)(c.level)}
              title={c.description}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="label-toggle-row">
        <span className="label-toggle-caption">Position:</span>
        <div className="segmented">
          {boxNumbers.map((n) => (
            <button
              key={n}
              type="button"
              className={`segment${n === boxNumber ? " active" : ""}`}
              onClick={() => leaving(setBoxNumber)(n)}
            >
              {n}
            </button>
          ))}
        </div>

        {/* Travel up the neck: the riff starts in the chosen position and
            climbs through the next one or two */}
        <span className="label-toggle-caption">Span:</span>
        <div className="segmented" title="Play the riff across one, two or three positions, climbing up the neck">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              className={`segment${n === span ? " active" : ""}`}
              onClick={() => leaving(setSpan)(n)}
            >
              {n === 1 ? "1 position" : `${n} positions`}
            </button>
          ))}
        </div>

        <button
          type="button"
          className={`riff-save${savedAs ? " saved" : ""}`}
          onClick={() => (savedAs ? favorites.remove(savedAs.id) : favorites.save(riff))}
          title={savedAs ? "Remove from favorites" : "Save this riff to your favorites"}
        >
          {savedAs ? "★ Saved" : "☆ Save"}
        </button>
        <button
          type="button"
          className="primary-button riff-new"
          onClick={() => {
            setLoaded(null);
            setVariant((v) => v + 1);
          }}
        >
          New riff
        </button>
        {(!isRiffOfTheDay || loaded) && (
          <button
            type="button"
            className="segment"
            onClick={() => {
              setLoaded(null);
              setVariant(0);
            }}
          >
            Today&apos;s
          </button>
        )}
      </div>

      <div className="tab-wrap">
        <TabStaff riff={riff} playheadTick={playhead} />
      </div>

      <div className="label-toggle-row riff-transport">
        <button
          type="button"
          className="primary-button"
          onClick={() => (playing ? stop() : void play())}
        >
          {playing ? "Stop" : "Play"}
        </button>

        <label className="riff-tempo">
          Tempo: {bpm} BPM
          <input
            type="range"
            min={50}
            max={180}
            value={bpm}
            onChange={(e) => {
              setBpm(Number(e.target.value));
              if (playing) stop();
            }}
            className="tempo-slider"
            aria-label="Riff tempo"
          />
        </label>

        <label className="riff-tempo">
          Guitar volume: {riffVolume}%
          <input
            type="range"
            min={0}
            max={100}
            value={riffVolume}
            onChange={(e) => setRiffVolume(Number(e.target.value))}
            className="tempo-slider"
            aria-label="Riff guitar volume"
          />
        </label>

        <label className="loop-toggle">
          <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
          Loop
        </label>

        <span className="label-toggle-caption">Tone:</span>
        <div className="segmented">
          <button
            type="button"
            className={`segment${tone === "clean" ? " active" : ""}`}
            onClick={() => setTone("clean")}
          >
            Clean
          </button>
          <button
            type="button"
            className={`segment${tone === "driven" ? " active" : ""}`}
            onClick={() => setTone("driven")}
          >
            Driven
          </button>
        </div>
      </div>

      <div className="chords-legend">
        {TECHNIQUE_KEY.map(([sym, meaning]) => (
          <span key={sym} className="tab-key-item">
            <strong>{sym}</strong> {meaning}
          </span>
        ))}
        <span className="tab-key-item">
          <VibratoMark /> vibrato
        </span>
        · rust fret numbers are the root
      </div>

      <RiffFavoritesList
        favorites={favorites.favorites}
        activeId={loaded?.id ?? null}
        onOpen={openFavorite}
        onRemove={(f) => {
          if (loaded?.id === f.id) setLoaded(null);
          favorites.remove(f.id);
        }}
      />
    </section>
  );
}
