import { FRET_COUNT, ScaleDiagram } from "../music/scales";
import { posKey, RunNote } from "../music/runs";

type FretboardDiagramProps = {
  diagram: ScaleDiagram;
  labelMode: "intervals" | "notes";
  selectedBox: number | null; // null = show all positions as brackets
  activeNote?: RunNote | null; // the exact string/fret sounding
  shadowed?: Set<string>; // duplicate pitches in the box that are not played
  playBox?: { start: number; end: number }; // the box playback runs through
};

// SVG geometry (viewBox units)
const NUT_X = 34;
const CELL = 36;
const ROW = 20;
const BRACKET_TOP = 6;
const BRACKET_ROW = 13;
const STR_TOP = 40;
const FRET_NUM_GAP = 26; // keeps fret numbers clear of the position box
const INLAY_FRETS = [3, 5, 7, 9, 15, 17, 19, 21];

export function FretboardDiagram({
  diagram,
  labelMode,
  selectedBox,
  activeNote = null,
  shadowed,
  playBox,
}: FretboardDiagramProps): JSX.Element {
  const width = NUT_X + FRET_COUNT * CELL + 12;
  const boardBottom = STR_TOP + 5 * ROW;
  const height = boardBottom + FRET_NUM_GAP + 8;

  const fretX = (fret: number): number => NUT_X + fret * CELL;
  // Note x: fretted notes sit between fret wires; open notes left of the nut
  const noteX = (fret: number): number => (fret === 0 ? NUT_X - 16 : NUT_X + (fret - 0.5) * CELL);
  // stringIndex 0 = low E drawn at the bottom, high E on top
  const stringY = (stringIndex: number): number => STR_TOP + (5 - stringIndex) * ROW;

  const activeBoxes = diagram.boxes.filter((b) => b.number === selectedBox);
  const inBox = (fret: number): boolean =>
    selectedBox === null || activeBoxes.some((b) => fret >= b.start && fret <= b.end);
  const boxX1 = (start: number): number => (start === 0 ? NUT_X - 30 : fretX(start - 1) + 4);

  return (
    <svg
      className="fretboard-svg"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${diagram.scale.name} in ${diagram.key.label} across the fretboard`}
    >
      {/* Position brackets (all-positions view) */}
      {selectedBox === null &&
        diagram.boxes.map((box, i) => {
          const y = BRACKET_TOP + (i % 2) * BRACKET_ROW;
          const x1 = boxX1(box.start);
          const x2 = fretX(box.end) - 4;
          return (
            <g key={`br${i}`}>
              <line x1={x1} y1={y + 8} x2={x2} y2={y + 8} stroke="#8aa7c4" strokeWidth={2} />
              <line x1={x1} y1={y + 4} x2={x1} y2={y + 8} stroke="#8aa7c4" strokeWidth={2} />
              <line x1={x2} y1={y + 4} x2={x2} y2={y + 8} stroke="#8aa7c4" strokeWidth={2} />
              <text x={(x1 + x2) / 2} y={y + 6} textAnchor="middle" className="fb-bracket-label">
                {box.number}
              </text>
            </g>
          );
        })}

      {/* Selected position window */}
      {activeBoxes.map((box, i) => {
        const isPlayBox = playBox === undefined || box.start === playBox.start;
        return (
          <rect
            key={`win${i}`}
            x={boxX1(box.start)}
            y={STR_TOP - 12}
            width={fretX(box.end) - 4 - boxX1(box.start)}
            height={5 * ROW + 24}
            rx={8}
            fill={isPlayBox ? "rgba(27, 92, 152, 0.09)" : "rgba(27, 92, 152, 0.03)"}
            stroke="#1b5c98"
            strokeWidth={isPlayBox ? 1.8 : 1}
            strokeDasharray={isPlayBox ? undefined : "5 4"}
            opacity={isPlayBox ? 1 : 0.55}
          />
        );
      })}

      {/* Nut */}
      <rect x={NUT_X - 3} y={STR_TOP - 1.5} width={4} height={5 * ROW + 3} rx={1.5} fill="#1b3a5e" />

      {/* Fret wires */}
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

      {/* Inlay markers */}
      {INLAY_FRETS.map((f) => (
        <circle
          key={`in${f}`}
          cx={fretX(f) - CELL / 2}
          cy={(STR_TOP + boardBottom) / 2}
          r={4.5}
          fill="#e2eaf2"
        />
      ))}
      <circle cx={fretX(12) - CELL / 2} cy={STR_TOP + 1 * ROW} r={4.5} fill="#e2eaf2" />
      <circle cx={fretX(12) - CELL / 2} cy={STR_TOP + 4 * ROW} r={4.5} fill="#e2eaf2" />

      {/* Strings */}
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

      {/* Fret numbers */}
      {[3, 5, 7, 9, 12, 15, 17, 19, 21].map((f) => (
        <text
          key={`fn${f}`}
          x={fretX(f) - CELL / 2}
          y={boardBottom + FRET_NUM_GAP}
          textAnchor="middle"
          className="fb-fret-number"
        >
          {f}
        </text>
      ))}

      {/* Scale notes */}
      {diagram.notes.map((n, i) => {
        const dimmed = !inBox(n.fret);
        const label = labelMode === "notes" ? n.note : n.interval;
        // Exactly the note being played, not every place that pitch appears
        const sounding =
          activeNote !== null &&
          activeNote.stringIndex === n.stringIndex &&
          activeNote.fret === n.fret;
        // A duplicate of a pitch already covered elsewhere in the box: shown,
        // but shaded back because you would not play both.
        const inPlayBox =
          playBox === undefined || (n.fret >= playBox.start && n.fret <= playBox.end);
        const duplicate = inPlayBox && (shadowed?.has(posKey(n.stringIndex, n.fret)) ?? false);
        return (
          <g
            key={`n${i}`}
            opacity={dimmed ? 0.18 : duplicate ? 0.32 : 1}
            className={sounding ? "note-sounding" : undefined}
          >
            <circle
              cx={noteX(n.fret)}
              cy={stringY(n.stringIndex)}
              r={8}
              fill={n.isRoot ? "#c23f1d" : "#1b5c98"}
              stroke="#fff"
              strokeWidth={1}
            />
            <text
              x={noteX(n.fret)}
              y={stringY(n.stringIndex) + 2.8}
              textAnchor="middle"
              className="fb-note-label"
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
