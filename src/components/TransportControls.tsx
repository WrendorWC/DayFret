import { PlaybackAudioMode, RegisterMode, RunDirection, SoundfontStatus } from "../types";

type TransportControlsProps = {
  direction: RunDirection;
  setDirection: (direction: RunDirection) => void;
  audioMode: PlaybackAudioMode;
  setAudioMode: (mode: PlaybackAudioMode) => void;
  soundfontStatus: SoundfontStatus;
  registerMode: RegisterMode;
  setRegisterMode: (mode: RegisterMode) => void;
  tempoBpm: number;
  setTempoBpm: (tempo: number) => void;
  isLooping: boolean;
  setLooping: (value: boolean) => void;
  isPlaying: boolean;
  onTogglePlayback: () => void;
};

const DIRECTION_OPTIONS: Array<{ value: RunDirection; label: string }> = [
  { value: "asc", label: "Ascend" },
  { value: "desc", label: "Descend" },
  { value: "asc_desc", label: "Both" },
];

const AUDIO_OPTIONS: Array<{ value: PlaybackAudioMode; label: string }> = [
  { value: "metronome", label: "Click" },
  { value: "metronome_notes", label: "Click + Notes" },
  { value: "notes", label: "Notes" },
];

const REGISTER_OPTIONS: Array<{ value: RegisterMode; label: string }> = [
  { value: "acoustic", label: "Acoustic (Original)" },
  { value: "electric", label: "Electric (Upper)" },
];

export function TransportControls({
  direction,
  setDirection,
  audioMode,
  setAudioMode,
  soundfontStatus,
  registerMode,
  setRegisterMode,
  tempoBpm,
  setTempoBpm,
  isLooping,
  setLooping,
  isPlaying,
  onTogglePlayback,
}: TransportControlsProps): JSX.Element {
  const soundfontStatusLabel =
    soundfontStatus === "loading"
      ? "Guitar soundfont loading..."
      : soundfontStatus === "ready"
        ? "Guitar soundfont ready"
        : soundfontStatus === "failed"
          ? "Guitar soundfont unavailable, using synth fallback"
          : "Guitar soundfont idle (loads when needed)";

  return (
    <section className="card controls-grid">
      <div>
        <div className="section-heading">Direction</div>
        <div className="segmented">
          {DIRECTION_OPTIONS.map((opt) => {
            const active = opt.value === direction;
            return (
              <button
                key={opt.value}
                type="button"
                className={`segment ${active ? "active" : ""}`}
                onClick={() => setDirection(opt.value)}
                aria-pressed={active}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="section-heading">Tempo: {tempoBpm} BPM</div>
        <input
          type="range"
          min={40}
          max={200}
          value={tempoBpm}
          onChange={(e) => setTempoBpm(Number(e.target.value))}
          className="tempo-slider"
          aria-label="Tempo in beats per minute"
        />
      </div>

      <div>
        <div className="section-heading">Audio</div>
        <div className="segmented">
          {AUDIO_OPTIONS.map((opt) => {
            const active = opt.value === audioMode;
            return (
              <button
                key={opt.value}
                type="button"
                className={`segment ${active ? "active" : ""}`}
                onClick={() => setAudioMode(opt.value)}
                aria-pressed={active}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <div className={`audio-status ${soundfontStatus}`} aria-live="polite">
          {soundfontStatusLabel}
        </div>
      </div>

      <div>
        <div className="section-heading">Register</div>
        <div className="segmented">
          {REGISTER_OPTIONS.map((opt) => {
            const active = opt.value === registerMode;
            return (
              <button
                key={opt.value}
                type="button"
                className={`segment ${active ? "active" : ""}`}
                onClick={() => setRegisterMode(opt.value)}
                aria-pressed={active}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="transport-row">
        <button type="button" className="primary-button" onClick={onTogglePlayback}>
          {isPlaying ? "Pause" : "Play"}
        </button>
        <label className="loop-toggle">
          <input
            type="checkbox"
            checked={isLooping}
            onChange={(e) => setLooping(e.target.checked)}
          />
          Loop selected position
        </label>
      </div>
    </section>
  );
}
