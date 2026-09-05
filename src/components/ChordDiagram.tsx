import { PlacedChord } from "../music/chords";

type ChordDiagramProps = {
  chord: PlacedChord;
  labelMode: "intervals" | "notes";
};

// SVG geometry constants (viewBox units)
const STRING_GAP = 20;
const FRET_GAP = 26;
const GRID_LEFT = 22;
const GRID_TOP = 30;
const NUM_STRINGS = 6;
// Every diagram is drawn with the same number of fret rows so the boxes keep a
// constant size — otherwise switching to a voicing that needs a fifth row
// (22 of the shapes do) would resize the card and shift the layout.
const MIN_ROWS = 5;

export function ChordDiagram({ chord, labelMode }: ChordDiagramProps): JSX.Element {
  const { frets, baseFret, intervals } = chord;
  const stringLabels = labelMode === "notes" ? chord.notes : chord.intervals;

  const numFrets = Math.max(MIN_ROWS, chord.numFrets);
  const gridWidth = STRING_GAP * (NUM_STRINGS - 1);
  const gridHeight = FRET_GAP * numFrets;
  const width = GRID_LEFT + gridWidth + 22;
  const height = GRID_TOP + gridHeight + 26;

  const stringX = (i: number): number => GRID_LEFT + i * STRING_GAP;
  // Vertical center of a fret row (fret is absolute; row 0 = baseFret)
  const fretY = (fret: number): number => GRID_TOP + (fret - baseFret + 0.5) * FRET_GAP;

  return (
    <svg
      className="chord-diagram-svg"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${chord.name} chord diagram`}
    >
      {/* Nut (thick) when the window starts at fret 1, else a fret-number label */}
      {baseFret === 1 ? (
        <rect x={GRID_LEFT - 1.5} y={GRID_TOP - 4} width={gridWidth + 3} height={4} rx={1.5} fill="#1b3a5e" />
      ) : (
        <text x={GRID_LEFT - 8} y={GRID_TOP + FRET_GAP * 0.5 + 4} textAnchor="end" className="cd-fret-label">
          {baseFret}
        </text>
      )}

      {/* Fret lines */}
      {Array.from({ length: numFrets + 1 }, (_, i) => (
        <line
          key={`f${i}`}
          x1={GRID_LEFT}
          y1={GRID_TOP + i * FRET_GAP}
          x2={GRID_LEFT + gridWidth}
          y2={GRID_TOP + i * FRET_GAP}
          stroke="#a9bdd3"
          strokeWidth={1.4}
        />
      ))}

      {/* String lines */}
      {Array.from({ length: NUM_STRINGS }, (_, i) => (
        <line
          key={`s${i}`}
          x1={stringX(i)}
          y1={GRID_TOP}
          x2={stringX(i)}
          y2={GRID_TOP + gridHeight}
          stroke="#7e97b3"
          strokeWidth={1.4}
        />
      ))}

      {/* Open / muted markers above the nut, and fretted dots */}
      {frets.map((fret, i) => {
        const x = stringX(i);
        if (fret === null) {
          return (
            <text key={`m${i}`} x={x} y={GRID_TOP - 9} textAnchor="middle" className="cd-mute">
              ✕
            </text>
          );
        }
        if (fret === 0) {
          return (
            <circle
              key={`o${i}`}
              cx={x}
              cy={GRID_TOP - 12}
              r={4.5}
              fill="none"
              stroke="#1b3a5e"
              strokeWidth={1.6}
            />
          );
        }
        const isRoot = intervals[i] === "R";
        const finger = chord.fingers[i];
        return (
          <g key={`d${i}`}>
            <circle cx={x} cy={fretY(fret)} r={8} fill={isRoot ? "#c23f1d" : "#1b5c98"} />
            {finger !== null && (
              <text x={x} y={fretY(fret) + 3.5} textAnchor="middle" className="cd-finger">
                {finger}
              </text>
            )}
          </g>
        );
      })}

      {/* Interval or note-name labels under each string (root stays red) */}
      {stringLabels.map((label, i) =>
        label === null ? null : (
          <text
            key={`i${i}`}
            x={stringX(i)}
            y={GRID_TOP + gridHeight + 16}
            textAnchor="middle"
            className={`cd-interval${intervals[i] === "R" ? " root" : ""}`}
          >
            {label}
          </text>
        ),
      )}
    </svg>
  );
}
