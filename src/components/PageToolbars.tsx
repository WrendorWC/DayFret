import { ReactNode } from "react";
import {
  CHORD_CATEGORIES,
  findChordType,
  prettyNote,
  rootNames,
  spellChord,
  typesInCategory,
} from "../music/chordFinder";
import { ChordFinderState, FinderView } from "../hooks/useChordFinder";
import { ScaleViewState } from "../hooks/useScaleView";
import { ChordChartState } from "../hooks/useChordChart";

// Every page opens with one of these: the pickers that choose *what* is on the
// page, above the card that shows it. The sidebar holds only navigation and
// the tools that work everywhere (metronome, timer).

type Option<T extends string> = { id: T; label: string };

export function ViewSwitch<T extends string>({
  value,
  options,
  onChange,
  caption = "View:",
}: {
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  caption?: string;
}): JSX.Element {
  return (
    <>
      <span className="label-toggle-caption">{caption}</span>
      <div className="segmented">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`segment${value === o.id ? " active" : ""}`}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </>
  );
}

// ── Chords ────────────────────────────────────────────────────────────────────

const CHORD_VIEWS: Option<FinderView>[] = [
  { id: "voicings", label: "Voicings" },
  { id: "arpeggio", label: "Arpeggio" },
  { id: "scales", label: "Scales that fit" },
];

export function ChordToolbar({ finder }: { finder: ChordFinderState }): JSX.Element {
  const names = rootNames(finder.accidentals);
  const rootName = names[finder.rootPc];
  const tones = spellChord(findChordType(finder.typeId), finder.rootPc, rootName);

  return (
    <section className="card page-toolbar">
      <div className="label-toggle-row finder-row">
        <span className="label-toggle-caption toolbar-caption">Root:</span>
        <div className="segmented finder-wrap">
          {names.map((n, pc) => (
            <button
              key={n}
              type="button"
              className={`segment${finder.rootPc === pc ? " active" : ""}`}
              onClick={() => finder.setRootPc(pc)}
            >
              {prettyNote(n)}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="segment"
          onClick={finder.toggleAccidentals}
          title="Name the black keys with sharps or flats"
        >
          {finder.accidentals === "flat" ? "♭ → ♯" : "♯ → ♭"}
        </button>
      </div>

      <div className="label-toggle-row finder-row">
        <span className="label-toggle-caption toolbar-caption">Family:</span>
        <div className="segmented finder-wrap">
          {CHORD_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`segment${finder.category === c ? " active" : ""}`}
              onClick={() => finder.setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="label-toggle-row finder-row">
        <span className="label-toggle-caption toolbar-caption">Chord:</span>
        <div className="segmented finder-wrap">
          {typesInCategory(finder.category).map((t) => (
            <button
              key={t.id}
              type="button"
              className={`segment${finder.typeId === t.id ? " active" : ""}`}
              onClick={() => finder.setTypeId(t.id)}
              title={t.name}
            >
              {t.suffix === "" ? "maj" : t.suffix}
            </button>
          ))}
        </div>
      </div>

      {/* Inversions from the chord's own tones, or any note at all */}
      <div className="label-toggle-row finder-row">
        <span className="label-toggle-caption toolbar-caption">Bass:</span>
        <div className="segmented finder-wrap">
          <button
            type="button"
            className={`segment${finder.bassPc === null ? " active" : ""}`}
            onClick={() => finder.setBassPc(null)}
          >
            Root
          </button>
          {tones
            .filter((x) => x.semis !== 0)
            .map((x) => (
              <button
                key={x.pc}
                type="button"
                className={`segment${finder.bassPc === x.pc ? " active" : ""}`}
                onClick={() => finder.setBassPc(x.pc)}
                title={`${x.label} in the bass`}
              >
                /{prettyNote(x.note)}
              </button>
            ))}
        </div>
        <select
          className="menu-select finder-bass-select"
          aria-label="Any bass note"
          value={finder.bassPc !== null && !tones.some((x) => x.pc === finder.bassPc) ? finder.bassPc : ""}
          onChange={(e) => finder.setBassPc(e.target.value === "" ? null : Number(e.target.value))}
        >
          <option value="">Other bass…</option>
          {names.map((n, pc) =>
            tones.some((x) => x.pc === pc) ? null : (
              <option key={n} value={pc}>
                /{prettyNote(n)}
              </option>
            ),
          )}
        </select>
      </div>

      <div className="label-toggle-row finder-row toolbar-views">
        <ViewSwitch value={finder.view} options={CHORD_VIEWS} onChange={finder.setView} />
      </div>
    </section>
  );
}

// ── Scales (and Riffs, which play from the same pick) ─────────────────────────

export function ScaleToolbar({
  scaleView,
  children,
}: {
  scaleView: ScaleViewState;
  children?: ReactNode; // a view row, when the page has views
}): JSX.Element {
  return (
    <section className="card page-toolbar">
      <div className="label-toggle-row finder-row">
        <span className="label-toggle-caption toolbar-caption">Key:</span>
        <div className="segmented finder-wrap">
          {scaleView.keys.map((k) => (
            <button
              key={k.label}
              type="button"
              className={`segment${scaleView.diagram.key.label === k.label ? " active" : ""}`}
              onClick={() => scaleView.onPickKey(k.label)}
            >
              {prettyNote(k.label)}
            </button>
          ))}
        </div>
      </div>

      <div className="label-toggle-row finder-row">
        <label className="label-toggle-caption toolbar-caption" htmlFor="scale-select">
          Scale:
        </label>
        <select
          id="scale-select"
          className="menu-select toolbar-select"
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

      {children && <div className="label-toggle-row finder-row toolbar-views">{children}</div>}
    </section>
  );
}

// ── Progressions ──────────────────────────────────────────────────────────────

export function ProgressionToolbar({ chords }: { chords: ChordChartState }): JSX.Element {
  const { chart } = chords;
  return (
    <section className="card page-toolbar">
      <div className="label-toggle-row finder-row">
        <label className="label-toggle-caption toolbar-caption" htmlFor="chord-progression-select">
          Progression:
        </label>
        <select
          id="chord-progression-select"
          className="menu-select toolbar-select"
          value={chart.progression.id}
          onChange={(event) => chords.onPickProgression(event.target.value)}
        >
          {chords.progressions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <label className="label-toggle-caption" htmlFor="chord-key-select">
          Key:
        </label>
        <select
          id="chord-key-select"
          className="menu-select toolbar-select toolbar-select-narrow"
          value={chart.key.label}
          onChange={(event) => chords.onPickKey(event.target.value)}
          disabled={chart.progression.keyless}
        >
          {chart.progression.keyless ? (
            <option value={chart.key.label}>Open position</option>
          ) : (
            chords.keysForChart.map((k) => (
              <option key={k.label} value={k.label}>
                {prettyNote(k.label)} {chart.progression.mode}
              </option>
            ))
          )}
        </select>

        <div className="toolbar-actions">
          <button type="button" className="primary-button toolbar-button" onClick={chords.onSurpriseMe}>
            Surprise Me
          </button>
          <div className="segmented">
            <button type="button" className="segment" onClick={chords.onNewVoicings}>
              New Voicings
            </button>
            <button
              type="button"
              className="segment"
              onClick={chords.onBackToToday}
              disabled={chords.isDailyChart}
            >
              Today
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
