import { useEffect, useMemo, useState } from "react";
import {
  allVoicings,
  chordNeck,
  commonVoicings,
  findChordType,
  findVoicings,
  FinderVoicing,
  matchingScales,
  prettyNote,
  rootNames,
  spellChord,
} from "../music/chordFinder";
import { buildChordArpeggio, ROOT_FINGERS, ROOT_STRINGS, STRING_ORDINAL } from "../music/arpeggios";
import { SCALE_KEYS, ScaleDiagram } from "../music/scales";
import { chooseRun, noteAt, posKey, RunNote, upAndDown } from "../music/runs";
import { midiFor } from "../music/tuning";
import { ChordFinderState } from "../hooks/useChordFinder";
import { usePlayback } from "../hooks/usePlayback";
import { LabelMode, LabelToggle, useLabelMode } from "../hooks/useLabelMode";
import { ChordDiagram } from "./ChordDiagram";
import { FretboardDiagram } from "./FretboardDiagram";
import { ArpeggioNeck } from "./ArpeggioNeck";

type ChordFinderPanelProps = {
  finder: ChordFinderState;
  tempoBpm?: number;
  // Jump to the Scales page with this scale and key up
  onOpenScale?: (scaleId: string, keyLabel: string) => void;
};

// Sounding notes of a grip, low string first
const gripNotes = (v: FinderVoicing): RunNote[] =>
  v.frets
    .map((fret, s) => (fret === null ? null : noteAt(s, fret)))
    .filter((n): n is RunNote => n !== null);

export function ChordFinderPanel({ finder, tempoBpm = 90, onOpenScale }: ChordFinderPanelProps): JSX.Element {
  const labelMode = useLabelMode();
  const [selected, setSelected] = useState(0);
  const playback = usePlayback(tempoBpm);
  const { playing, activeIndex, activeNote, playChord, playSequence, stop } = playback;

  const names = rootNames(finder.accidentals);
  const rootName = names[finder.rootPc];
  const type = findChordType(finder.typeId);
  const tones = useMemo(() => spellChord(type, finder.rootPc, rootName), [type, finder.rootPc, rootName]);
  const bassName =
    finder.bassPc === null
      ? undefined
      : (tones.find((x) => x.pc === finder.bassPc)?.note ?? names[finder.bassPc]);

  const found = useMemo(
    () => findVoicings(type, finder.rootPc, rootName, finder.bassPc, bassName),
    [type, finder.rootPc, rootName, finder.bassPc, bassName],
  );
  const voicings = useMemo(
    () => (finder.showAll ? allVoicings(found) : commonVoicings(found)),
    [found, finder.showAll],
  );

  const neck = useMemo(
    () =>
      chordNeck(type, finder.rootPc, rootName, {
        label: rootName,
        pitchClass: finder.rootPc,
        accidentalPreference: finder.accidentals,
      }),
    [type, finder.rootPc, rootName, finder.accidentals],
  );

  // A different chord starts from its first grip
  useEffect(() => {
    setSelected(0);
    stop();
  }, [found, finder.showAll, stop]);

  const current = voicings[Math.min(selected, voicings.length - 1)];
  const chordName = `${prettyNote(rootName)}${type.suffix}${bassName ? `/${prettyNote(bassName)}` : ""}`;
  const strum = (v: FinderVoicing, i: number) => void playChord(gripNotes(v), i);
  // Low to high and back, so you hear every string of the grip on its own
  const arpeggiate = (v: FinderVoicing) => void playSequence(upAndDown(gripNotes(v)));

  return (
    <section className="card chords-panel finder-panel">
      <div className="chords-panel-header">
        <div className="viewer-book">Chords</div>
        <h2 className="chords-title">
          {chordName}{" "}
          <span className="chords-key">
            — {prettyNote(rootName)} {type.name}
            {bassName ? `, ${prettyNote(bassName)} in the bass` : ""}
          </span>
        </h2>
        <div className="finder-tones">
          {tones.map((x) => (
            <span key={x.label} className={`finder-tone${x.semis === 0 ? " root" : ""}${x.optional ? " optional" : ""}`}>
              <span className="finder-tone-note">{prettyNote(x.note)}</span>
              <span className="finder-tone-interval">{x.label}</span>
            </span>
          ))}
          {tones.some((x) => x.optional) && (
            <span className="finder-tone-hint">faded tones are often left out</span>
          )}
        </div>
      </div>

      {finder.view === "voicings" && (
        <>
          <div className="label-toggle-row finder-row">
            <span className="label-toggle-caption">Show:</span>
            <div className="segmented">
              <button
                type="button"
                className={`segment${!finder.showAll ? " active" : ""}`}
                onClick={() => finder.setShowAll(false)}
              >
                Common voicings
              </button>
              <button
                type="button"
                className={`segment${finder.showAll ? " active" : ""}`}
                onClick={() => finder.setShowAll(true)}
              >
                All ({Math.min(found.length, 60)})
              </button>
            </div>
            <LabelToggle />
            {current && (
              <>
                <button type="button" className="play-button" onClick={() => strum(current, selected)}>
                  ▶ Strum
                </button>
                <button
                  type="button"
                  className="play-button"
                  onClick={() => (playing ? stop() : arpeggiate(current))}
                >
                  {playing ? "■ Stop" : "▶ String by string"}
                </button>
              </>
            )}
          </div>

          {voicings.length === 0 ? (
            <div className="chords-legend">
              No playable grip found for {chordName} within four frets. Try another bass note, or
              drop to a simpler chord.
            </div>
          ) : (
            <>
              <div className="chords-grid finder-grid">
                {voicings.map((v, i) => (
                  <div
                    key={v.frets.join(",")}
                    className={`chord-cell finder-cell${i === selected ? " selected" : ""}${
                      activeIndex === i && !playing ? " sounding" : ""
                    }`}
                    onClick={() => {
                      setSelected(i);
                      strum(v, i);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(i);
                        strum(v, i);
                      }
                    }}
                    title={`${v.name}: ${v.frets.map((f) => (f === null ? "x" : f)).join(" ")} — click to select and hear it`}
                  >
                    <ChordDiagram chord={v} labelMode={labelMode} />
                  </div>
                ))}
              </div>

              {current && (
                <div className="fretboard-wrap">
                  <FretboardDiagram
                    diagram={neck}
                    labelMode={labelMode}
                    selectedBox={null}
                    activeNote={activeNote}
                    highlight={new Set(gripNotes(current).map((n) => posKey(n.stringIndex, n.fret)))}
                  />
                </div>
              )}

              <div className="chords-legend">
                Click a grip to hear it and see it on the neck — the neck shows every{" "}
                {chordName} tone, with the chosen grip picked out. Common voicings are the easiest
                grips spread along the neck; All lists every one the finder could fit under four
                fingers. Numbers in the dots are fingers (1 index … 4 pinky); an arc is a barre.
              </div>
            </>
          )}
        </>
      )}

      {finder.view === "arpeggio" && (
        <ChordArpeggio
          name={chordName}
          rootPc={finder.rootPc}
          rootName={rootName}
          neck={neck}
          labelMode={labelMode}
          playback={playback}
        />
      )}

      {finder.view === "scales" && (
        <MatchingScales
          chordName={chordName}
          typeId={type.id}
          rootPc={finder.rootPc}
          onOpenScale={onOpenScale}
        />
      )}
    </section>
  );
}

// ── Arpeggio of the chord ─────────────────────────────────────────────────────

function ChordArpeggio({
  name,
  rootPc,
  rootName,
  neck,
  labelMode,
  playback,
}: {
  name: string;
  rootPc: number;
  rootName: string;
  neck: ScaleDiagram;
  labelMode: LabelMode;
  playback: ReturnType<typeof usePlayback>;
}): JSX.Element {
  const [rootString, setRootString] = useState<6 | 5 | 4 | 3>(6);
  const [finger, setFinger] = useState<1 | 2 | 3 | 4>(1);
  const [boxIndex, setBoxIndex] = useState(0);
  const { playing, activeNote, playSequence, stop } = playback;

  const entry = useMemo(() => buildChordArpeggio(name, rootPc, rootName, neck.notes), [name, rootPc, rootName, neck]);

  useEffect(() => {
    setBoxIndex(0);
  }, [entry, rootString, finger]);

  const position =
    entry.positions.find((p) => p.rootString === rootString && p.finger === finger) ?? entry.positions[0];
  if (!position) return <div className="chords-legend">No arpeggio position fits on the neck.</div>;

  // Same rule as the scale arpeggios: stay inside one box, starting on its root
  const box = position.boxes[Math.min(boxIndex, position.boxes.length - 1)];
  const rootMidi = midiFor(6 - position.rootString, box.rootFret);
  const { run, shadowed } = chooseRun(
    entry.notes
      .filter((n) => n.fret >= box.startFret && n.fret <= box.endFret)
      .map((n) => noteAt(n.stringIndex, n.fret))
      .filter((n) => n.midi >= rootMidi),
    { baseStart: box.baseStart, baseEnd: box.baseEnd },
  );

  return (
    <>
      <div className="label-toggle-row finder-row">
        <span className="label-toggle-caption">Root on:</span>
        <div className="segmented">
          {ROOT_STRINGS.map((s) => (
            <button
              key={s}
              type="button"
              className={`segment${rootString === s ? " active" : ""}`}
              onClick={() => setRootString(s)}
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
        <div className="label-toggle-row finder-row">
          <span className="label-toggle-caption">Play box:</span>
          <div className="segmented">
            {position.boxes.map((b, i) => (
              <button
                key={`${b.startFret}-${b.endFret}`}
                type="button"
                className={`segment${b === box ? " active" : ""}`}
                onClick={() => setBoxIndex(i)}
              >
                frets {b.startFret}–{b.endFret}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="label-toggle-row finder-row">
        <LabelToggle />
        <button
          type="button"
          className="play-button"
          onClick={() => (playing ? stop() : void playSequence(upAndDown(run)))}
        >
          {playing ? "■ Stop" : "▶ Play arpeggio"}
        </button>
      </div>

      <div className="fretboard-wrap">
        <ArpeggioNeck
          scaleDiagram={neck}
          entry={entry}
          position={position}
          labelMode={labelMode}
          activeNote={activeNote}
          shadowed={shadowed}
          playBox={box}
        />
      </div>

      <div className="chords-legend">
        Take the root on the {STRING_ORDINAL[position.rootString]} string with finger {position.finger}:
        the hand sits over frets {position.baseStart}–{position.baseEnd}, one finger per fret
        {position.stretched ? ", reaching just outside it where a chord tone would otherwise be skipped" : ""}.
        Numbers above the dots are the fingers; hollow notes sit below the starting root.
      </div>
    </>
  );
}

// ── Scales that fit over the chord ────────────────────────────────────────────

function MatchingScales({
  chordName,
  typeId,
  rootPc,
  onOpenScale,
}: {
  chordName: string;
  typeId: string;
  rootPc: number;
  onOpenScale?: (scaleId: string, keyLabel: string) => void;
}): JSX.Element {
  const matches = useMemo(() => matchingScales(findChordType(typeId), rootPc), [typeId, rootPc]);
  const home = matches.filter((m) => m.onChordRoot);
  const others = matches.filter((m) => !m.onChordRoot);

  const chip = (m: (typeof matches)[number]) => {
    const keyLabel = SCALE_KEYS[m.rootPc].label;
    return (
      <button
        key={`${m.scale.id}-${m.rootPc}`}
        type="button"
        className="segment finder-scale-chip"
        onClick={() => onOpenScale?.(m.scale.id, keyLabel)}
        disabled={!onOpenScale}
        title={m.scale.description}
      >
        {prettyNote(keyLabel)} {m.scale.name}
      </button>
    );
  };

  return (
    <>
      <div className="finder-scale-group">
        <div className="label-toggle-caption">Rooted on the chord — {chordName} as home</div>
        <div className="finder-scale-list">
          {home.length ? home.map(chip) : <span className="chords-legend">None in the scale library.</span>}
        </div>
      </div>
      <div className="finder-scale-group">
        <div className="label-toggle-caption">Containing every note of the chord, from other roots</div>
        <div className="finder-scale-list">
          {others.length ? others.map(chip) : <span className="chords-legend">None.</span>}
        </div>
      </div>
      <div className="chords-legend">
        Every scale here contains all of {chordName}&rsquo;s notes, so it can be played over the chord
        without a clash. A scale on another root means {chordName} is one of that scale&rsquo;s own
        chords — e.g. Am7 sits inside C major as its vi. Click one to open it in Scales.
      </div>
    </>
  );
}
