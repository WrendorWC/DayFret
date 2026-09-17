import { Riff, RiffEvent, TICKS_PER_BAR, TICKS_PER_QUARTER } from "../music/riffs";

type TabStaffProps = {
  riff: Riff;
  playheadTick: number | null;
};

// Layout (SVG units)
const LEFT = 26;
const RIGHT_PAD = 18;
const PX_PER_TICK = 7.2;
const STRING_GAP = 13;
const ART_TOP = 44; // room above the staff for bends and slurs
const STEM_LEN = 22;
const BEAM_GAP = 4;

const STRING_LABELS = ["E", "A", "D", "G", "B", "e"]; // low to high

// How many beams a duration carries (a quarter and longer get none)
function beamCount(duration: number): number {
  if (duration <= TICKS_PER_QUARTER / 4) return 2; // sixteenth
  if (duration < TICKS_PER_QUARTER) return 1; // eighth, triplet eighth, swung pair
  return 0;
}

// Dotted values are 1.5x a plain one
function isDotted(duration: number): boolean {
  return [TICKS_PER_QUARTER * 1.5, TICKS_PER_QUARTER * 0.75].includes(duration);
}

export function TabStaff({ riff, playheadTick }: TabStaffProps): JSX.Element {
  const totalTicks = TICKS_PER_BAR * riff.bars;
  const width = LEFT + totalTicks * PX_PER_TICK + RIGHT_PAD;
  const staffTop = ART_TOP;
  const staffBottom = staffTop + 5 * STRING_GAP;
  const height = staffBottom + STEM_LEN + 26;

  // stringIndex 0 is the low E, drawn on the bottom line
  const lineY = (stringIndex: number): number => staffTop + (5 - stringIndex) * STRING_GAP;
  const tickX = (tick: number): number => LEFT + tick * PX_PER_TICK;
  // Everything that belongs to a note — the fret number, its stem, the slur to
  // the next one — is drawn a few pixels right of the tick it falls on, so the
  // playhead has to sit on the same offset or it runs permanently to the left
  // of the note it is sounding. On sixteenths that gap is most of a note.
  const NOTE_X = 3;

  const sounded = riff.events.filter((e) => !e.rest);

  // Beam groups: consecutive sub-quarter notes inside the same beat
  const groups: RiffEvent[][] = [];
  let current: RiffEvent[] = [];
  let currentBeat = -1;
  for (const e of riff.events) {
    const beat = Math.floor(e.start / TICKS_PER_QUARTER);
    if (e.rest || beamCount(e.duration) === 0 || beat !== currentBeat) {
      if (current.length > 1) groups.push(current);
      current = [];
      currentBeat = beat;
    }
    if (!e.rest && beamCount(e.duration) > 0) {
      current.push(e);
      currentBeat = beat;
    }
  }
  if (current.length > 1) groups.push(current);
  const beamed = new Set(groups.flat());

  const nextSounded = (e: RiffEvent): RiffEvent | undefined =>
    sounded[sounded.indexOf(e) + 1];

  return (
    <svg
      className="tab-staff-svg"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Tablature for a ${riff.feel.name} riff in ${riff.key.label} ${riff.scale.name}`}
    >
      {/* String lines */}
      {Array.from({ length: 6 }, (_, s) => (
        <line
          key={`s${s}`}
          x1={LEFT - 10}
          y1={lineY(s)}
          x2={width - RIGHT_PAD + 6}
          y2={lineY(s)}
          stroke="#b7c8da"
          strokeWidth={1}
        />
      ))}

      {/* "TAB" clef */}
      {STRING_LABELS.map((l, s) => (
        <text key={`sl${s}`} x={LEFT - 16} y={lineY(s) + 3.2} textAnchor="middle" className="tab-string-label">
          {l}
        </text>
      ))}

      {/* Bar lines */}
      {Array.from({ length: riff.bars + 1 }, (_, b) => {
        const x = tickX(b * TICKS_PER_BAR);
        const last = b === riff.bars;
        return (
          <g key={`bl${b}`}>
            <line x1={x} y1={lineY(5)} x2={x} y2={lineY(0)} stroke="#7e97b3" strokeWidth={last ? 2.2 : 1.2} />
            {last && (
              <line x1={x - 4} y1={lineY(5)} x2={x - 4} y2={lineY(0)} stroke="#7e97b3" strokeWidth={1} />
            )}
          </g>
        );
      })}

      {/* Playhead */}
      {playheadTick !== null && (
        <line
          x1={tickX(playheadTick) + NOTE_X}
          y1={staffTop - 8}
          x2={tickX(playheadTick) + NOTE_X}
          y2={staffBottom + STEM_LEN}
          stroke="#dc5f2c"
          strokeWidth={2}
          opacity={0.85}
        />
      )}

      {/* Stems and beams */}
      {riff.events.map((e, i) => {
        if (e.rest) return null;
        const x = tickX(e.start) + 3;
        const y1 = staffBottom + 4;
        const y2 = staffBottom + STEM_LEN;
        return (
          <g key={`st${i}`}>
            <line x1={x} y1={y1} x2={x} y2={y2} stroke="#5b7695" strokeWidth={1} />
            {/* Unbeamed short notes get flags drawn as short stubs */}
            {!beamed.has(e) &&
              Array.from({ length: beamCount(e.duration) }, (_, k) => (
                <line
                  key={`fl${k}`}
                  x1={x}
                  y1={y2 - k * BEAM_GAP}
                  x2={x + 7}
                  y2={y2 - k * BEAM_GAP - 4}
                  stroke="#5b7695"
                  strokeWidth={2}
                />
              ))}
            {isDotted(e.duration) && <circle cx={x + 4} cy={y2 - 3} r={1.4} fill="#5b7695" />}
          </g>
        );
      })}

      {groups.map((group, gi) =>
        Array.from({ length: Math.min(...group.map((e) => beamCount(e.duration))) }, (_, k) => (
          <line
            key={`bm${gi}-${k}`}
            x1={tickX(group[0].start) + 3}
            y1={staffBottom + STEM_LEN - k * BEAM_GAP}
            x2={tickX(group[group.length - 1].start) + 3}
            y2={staffBottom + STEM_LEN - k * BEAM_GAP}
            stroke="#5b7695"
            strokeWidth={2.4}
          />
        )),
      )}

      {/* Rests, drawn rather than typed: the Unicode musical rest characters
          are in a block most system fonts skip, so they came out as tofu. */}
      {riff.events.map((e, i) => {
        if (!e.rest) return null;
        const x = tickX(e.start) + 3;
        const y = (lineY(0) + lineY(5)) / 2;
        const stroke = "#8aa7c4";

        // A beat or longer: the familiar quarter-rest zigzag with a hooked foot.
        // The rhythm generator does not currently emit rests this long, but a
        // riff feel that did would otherwise fall through to an eighth rest.
        if (e.duration >= TICKS_PER_QUARTER) {
          return (
            <g key={`r${i}`} fill="none" stroke={stroke} strokeWidth={1.9}
               strokeLinecap="round" strokeLinejoin="round">
              <path d={`M ${x - 2.5} ${y - 7} L ${x + 1.8} ${y - 3} L ${x - 2} ${y + 0.5} L ${x + 2} ${y + 4}`} />
              <path d={`M ${x + 2} ${y + 4} c -3 0 -3.4 2.6 -0.4 3.6`} strokeWidth={1.5} />
            </g>
          );
        }

        // Eighth and sixteenth rests: a slanted stem carrying one flag or two
        const flags = e.duration <= TICKS_PER_QUARTER / 4 ? 2 : 1;
        return (
          <g key={`r${i}`}>
            <line
              x1={x + 2.6}
              y1={y - 4.6}
              x2={x - 1.2}
              y2={y + 4.6}
              stroke={stroke}
              strokeWidth={1.5}
              strokeLinecap="round"
            />
            {Array.from({ length: flags }, (_, k) => (
              <circle key={k} cx={x + 0.4} cy={y - 3.4 + k * 3} r={1.7} fill={stroke} />
            ))}
          </g>
        );
      })}

      {/* Fret numbers, with a halo so the string line does not run through them */}
      {riff.events.map((e, i) => {
        if (e.rest) return null;
        const x = tickX(e.start) + 3;
        return (
          <g key={`n${i}`}>
            {e.notes.map((n, j) => (
              <g key={`nn${j}`}>
                <rect
                  x={x - 6}
                  y={lineY(n.stringIndex) - 5.5}
                  width={n.fret > 9 ? 14 : 11}
                  height={11}
                  fill="#fff"
                  rx={2}
                />
                <text
                  x={x - 6 + (n.fret > 9 ? 7 : 5.5)}
                  y={lineY(n.stringIndex) + 3.4}
                  textAnchor="middle"
                  className={`tab-fret${n.interval === "R" ? " root" : ""}`}
                >
                  {n.fret}
                </text>
              </g>
            ))}
          </g>
        );
      })}

      {/* Articulations */}
      {riff.events.map((e, i) => {
        if (e.rest || !e.technique) return null;
        const x = tickX(e.start) + 3;
        const y = staffTop - 10;
        const nxt = nextSounded(e);
        const nx = nxt ? tickX(nxt.start) + 3 : x + 18;

        if (e.technique === "bend") {
          const label = e.bendAmount === "full" ? "full" : "½";
          return (
            <g key={`ar${i}`}>
              <path
                d={`M ${x + 6} ${y} Q ${x + 14} ${y} ${x + 14} ${y - 14}`}
                fill="none"
                stroke="#c23f1d"
                strokeWidth={1.4}
              />
              <path d={`M ${x + 11} ${y - 11} L ${x + 14} ${y - 17} L ${x + 17} ${y - 11} Z`} fill="#c23f1d" />
              <text x={x + 14} y={y - 20} textAnchor="middle" className="tab-artic bend">
                {label}
              </text>
            </g>
          );
        }

        if (e.technique === "vibrato") {
          let d = `M ${x + 7} ${lineY(e.notes[0].stringIndex) - 7}`;
          for (let k = 0; k < 4; k += 1) {
            d += ` q 2 -3 4 0 q 2 3 0 0`;
          }
          return (
            <path key={`ar${i}`} d={d} fill="none" stroke="#1b5c98" strokeWidth={1.3} transform={`translate(0,0)`} />
          );
        }

        if (e.technique === "slide") {
          const str = e.notes[0].stringIndex;
          return (
            <line
              key={`ar${i}`}
              x1={x + 7}
              y1={lineY(str) + 3}
              x2={nx - 7}
              y2={lineY(str) - 3}
              stroke="#1b5c98"
              strokeWidth={1.4}
            />
          );
        }

        // hammer-on / pull-off arc
        const mid = (x + nx) / 2;
        return (
          <g key={`ar${i}`}>
            <path d={`M ${x + 4} ${y} Q ${mid} ${y - 9} ${nx - 4} ${y}`} fill="none" stroke="#1b5c98" strokeWidth={1.2} />
            <text x={mid} y={y - 10} textAnchor="middle" className="tab-artic">
              {e.technique === "hammer" ? "H" : "P"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
