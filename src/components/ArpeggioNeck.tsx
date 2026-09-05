import { ArpeggioBox, ArpeggioEntry, ArpeggioPosition, noteKey, STRING_ORDINAL } from "../music/arpeggios";
import { FRET_COUNT, ScaleDiagram } from "../music/scales";
import { posKey, RunNote } from "../music/runs";

type ArpeggioNeckProps = {
  scaleDiagram: ScaleDiagram; // the greyed-out backdrop of scale tones
  entry: ArpeggioEntry;
  position: ArpeggioPosition;
  labelMode: "intervals" | "notes";
  activeNote?: RunNote | null;
  shadowed?: Set<string>;
  // The box playback runs through, drawn more prominently than the others
  playBox?: ArpeggioBox;
};

// SVG geometry — matches the scale fretboard so the two views feel like the
// same instrument.
const NUT_X = 34;
const CELL = 36;
const ROW = 20;
const STR_TOP = 34;
const INLAY_FRETS = [3, 5, 7, 9, 15, 17, 19, 21];

// Vertical spacing. Finger labels sit above their string, so the box has to
// clear them at the top; the fret numbers have to clear the box at the bottom.
const FINGER_OFFSET = 11; // finger label above the string
const BOX_PAD_TOP = 22; // box top above the highest string
const BOX_PAD_BOTTOM = 12; // box bottom below the lowest string
const FRET_NUM_GAP = 26; // fret-number baseline below the lowest string

// Open-string pitches in MIDI, low E to high E — used to decide which notes
// sit below the position's root and so fall outside the ascending run.
const OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64];

export function ArpeggioNeck({
  scaleDiagram,
  entry,
  position,
  labelMode,
  activeNote = null,
  shadowed,
  playBox,
}: ArpeggioNeckProps): JSX.Element {
  const width = NUT_X + FRET_COUNT * CELL + 12;
  const boardBottom = STR_TOP + 5 * ROW;
  const height = boardBottom + FRET_NUM_GAP + 8;

  const fretX = (fret: number): number => NUT_X + fret * CELL;
  const noteX = (fret: number): number => (fret === 0 ? NUT_X - 16 : NUT_X + (fret - 0.5) * CELL);
  const stringY = (stringIndex: number): number => STR_TOP + (5 - stringIndex) * ROW;

  // Which neck slots belong to the arpeggio, and which of those sit in the box
  const arpAt = new Map(entry.notes.map((n) => [noteKey(n.stringIndex, n.fret), n]));
  // A shape usually fits more than once on the neck; every box counts as in.
  const inBox = (fret: number): boolean =>
    position.boxes.some((b) => fret >= b.startFret && fret <= b.endFret);

  // The arpeggio is played upward from the root on the chosen string, so
  // anything lower in pitch than that root is shaded back: it is on the neck
  // but not part of the run.
  const rootStringIndex = 6 - position.rootString;
  // Lowest root of the position, since a shape may repeat up the neck
  const rootPitch = Math.min(
    ...position.boxes.map((b) => OPEN_STRING_MIDI[rootStringIndex] + b.rootFret),
  );
  const pitchOf = (stringIndex: number, fret: number): number =>
    OPEN_STRING_MIDI[stringIndex] + fret;
  const belowRoot = (stringIndex: number, fret: number): boolean =>
    pitchOf(stringIndex, fret) < rootPitch;

  const boxBounds = position.boxes.map((b) => ({
    x1: b.startFret === 0 ? NUT_X - 30 : fretX(b.startFret - 1) + 3,
    x2: fretX(b.endFret) - 3,
    isPlayBox: playBox === undefined || b.startFret === playBox.startFret,
  }));

  return (
    <svg
      className="fretboard-svg"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${entry.name} arpeggio, root on the ${STRING_ORDINAL[position.rootString]} string with finger ${position.finger}`}
    >
      {/* Position boxes — one per octave of the shape that fits */}
      {boxBounds.map((b, i) => (
        <rect
          key={`box${i}`}
          x={b.x1}
          y={STR_TOP - BOX_PAD_TOP}
          width={b.x2 - b.x1}
          height={5 * ROW + BOX_PAD_TOP + BOX_PAD_BOTTOM}
          rx={8}
          fill={b.isPlayBox ? "rgba(27, 92, 152, 0.09)" : "rgba(27, 92, 152, 0.03)"}
          stroke="#1b5c98"
          strokeWidth={b.isPlayBox ? 1.8 : 1}
          strokeDasharray={b.isPlayBox ? undefined : "5 4"}
          opacity={b.isPlayBox ? 1 : 0.55}
        />
      ))}

      <rect x={NUT_X - 3} y={STR_TOP - 1.5} width={4} height={5 * ROW + 3} rx={1.5} fill="#1b3a5e" />

      {Array.from({ length: FRET_COUNT }, (_, i) => (
        <line
          key={`fw${i}`}
          x1={fretX(i + 1)}
          y1={STR_TOP}
          x2={fretX(i + 1)}
          y2={boardBottom}
          stroke="#b7c8da"
          strokeWidth={1.4}
        />
      ))}

      {INLAY_FRETS.map((f) => (
        <circle key={`in${f}`} cx={fretX(f) - CELL / 2} cy={(STR_TOP + boardBottom) / 2} r={4.5} fill="#e2eaf2" />
      ))}
      <circle cx={fretX(12) - CELL / 2} cy={STR_TOP + 1 * ROW} r={4.5} fill="#e2eaf2" />
      <circle cx={fretX(12) - CELL / 2} cy={STR_TOP + 4 * ROW} r={4.5} fill="#e2eaf2" />

      {Array.from({ length: 6 }, (_, s) => (
        <line
          key={`st${s}`}
          x1={NUT_X - 3}
          y1={stringY(s)}
          x2={fretX(FRET_COUNT)}
          y2={stringY(s)}
          stroke="#7e97b3"
          strokeWidth={0.8 + (5 - s) * 0.25}
        />
      ))}

      {[3, 5, 7, 9, 12, 15, 17, 19, 21].map((f) => (
        <text key={`fn${f}`} x={fretX(f) - CELL / 2} y={boardBottom + FRET_NUM_GAP} textAnchor="middle" className="fb-fret-number">
          {f}
        </text>
      ))}

      {/* Layer 1: the scale, greyed out — everything not in the arpeggio */}
      {scaleDiagram.notes
        .filter((n) => !arpAt.has(noteKey(n.stringIndex, n.fret)))
        .map((n, i) => {
          const under = belowRoot(n.stringIndex, n.fret);
          return (
            <circle
              key={`sc${i}`}
              cx={noteX(n.fret)}
              cy={stringY(n.stringIndex)}
              r={under ? 4.5 : 6}
              fill={under ? "#dbe3ec" : "#c8d4e1"}
              opacity={under ? 0.55 : 0.5}
            />
          );
        })}

      {/* Layer 2: arpeggio tones — faint outside the box, full colour inside */}
      {entry.notes.map((n, i) => {
        const active = inBox(n.fret);
        const under = belowRoot(n.stringIndex, n.fret);
        const finger = position.fingers.get(noteKey(n.stringIndex, n.fret));
        const colour = n.isRoot ? "#c23f1d" : "#1b5c98";
        // Exactly the note being played, not every place that pitch appears
        const sounding =
          activeNote !== null &&
          activeNote.stringIndex === n.stringIndex &&
          activeNote.fret === n.fret;
        // In-box duplicate of a pitch played elsewhere: shaded back
        const inPlayBox =
          playBox === undefined ||
          (n.fret >= playBox.startFret && n.fret <= playBox.endFret);
        const duplicate =
          active && inPlayBox && (shadowed?.has(posKey(n.stringIndex, n.fret)) ?? false);
        const groupOpacity = active
          ? under
            ? 0.5
            : duplicate
              ? 0.3
              : 1
          : under
            ? 0.12
            : 0.22;
        return (
          <g key={`ar${i}`} opacity={groupOpacity} className={sounding ? "note-sounding" : undefined}>
            <circle
              cx={noteX(n.fret)}
              cy={stringY(n.stringIndex)}
              r={active ? 8.5 : 6.5}
              // Below the root the dot is drawn hollow, so it reads as present
              // on the neck but outside the run.
              fill={under ? "#fff" : colour}
              stroke={under ? colour : "#fff"}
              strokeWidth={under ? 1.8 : active ? 1 : 0}
            />
            {active && (
              <text
                x={noteX(n.fret)}
                y={stringY(n.stringIndex) + 2.8}
                textAnchor="middle"
                className="fb-note-label"
                fill={under ? colour : undefined}
              >
                {labelMode === "notes" ? n.note : n.interval}
              </text>
            )}
            {active && finger !== undefined && n.fret > 0 && (
              <text x={noteX(n.fret)} y={stringY(n.stringIndex) - FINGER_OFFSET} textAnchor="middle" className="arp-finger-label">
                {finger}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
