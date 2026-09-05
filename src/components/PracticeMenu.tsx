import { ExerciseDefinition, PracticeType, ScaleRepresentation } from "../types";
import { KeyOption } from "../music/keys";

type PracticeMenuProps = {
  dateISO: string;
  isDailyAuto: boolean;
  setDailyAuto: (value: boolean) => void;
  dailyExercise: ExerciseDefinition;
  dailyKey: KeyOption;
  customPracticeType: PracticeType;
  setCustomPracticeType: (value: PracticeType) => void;
  customExerciseId: string;
  setCustomExerciseId: (value: string) => void;
  customExercises: ExerciseDefinition[];
  customKeyId: string;
  setCustomKeyId: (value: string) => void;
  scaleRepresentation: ScaleRepresentation;
  setScaleRepresentation: (value: ScaleRepresentation) => void;
  scaleRepresentationEnabled: boolean;
  keyOptions: KeyOption[];
};

export function PracticeMenu({
  dateISO,
  isDailyAuto,
  setDailyAuto,
  dailyExercise,
  dailyKey,
  customPracticeType,
  setCustomPracticeType,
  customExerciseId,
  setCustomExerciseId,
  customExercises,
  customKeyId,
  setCustomKeyId,
  scaleRepresentation,
  setScaleRepresentation,
  scaleRepresentationEnabled,
  keyOptions,
}: PracticeMenuProps): JSX.Element {
  return (
    <section className="card">
      <div className="section-heading">Practice Menu</div>

      <label className="loop-toggle">
        <input
          type="checkbox"
          checked={isDailyAuto}
          onChange={(e) => setDailyAuto(e.target.checked)}
        />
        Daily auto selection
      </label>

      <p className="menu-summary">
        Daily ({dateISO}): {dailyExercise.name} in {dailyKey.label}
      </p>

      <div className={`menu-fields ${isDailyAuto ? "disabled" : ""}`}>
        <div>
          <div className="section-heading">Type</div>
          <div className="segmented">
            <button
              type="button"
              className={`segment ${customPracticeType === "scale" ? "active" : ""}`}
              onClick={() => setCustomPracticeType("scale")}
              aria-pressed={customPracticeType === "scale"}
            >
              Scale
            </button>
            <button
              type="button"
              className={`segment ${customPracticeType === "arpeggio" ? "active" : ""}`}
              onClick={() => setCustomPracticeType("arpeggio")}
              aria-pressed={customPracticeType === "arpeggio"}
            >
              Arpeggio
            </button>
          </div>
        </div>

        <div>
          <div className="section-heading">Pattern</div>
          <select
            value={customExerciseId}
            onChange={(e) => setCustomExerciseId(e.target.value)}
            disabled={isDailyAuto}
            className="menu-select"
          >
            {customExercises.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="section-heading">Key</div>
          <select
            value={customKeyId}
            onChange={(e) => setCustomKeyId(e.target.value)}
            disabled={isDailyAuto}
            className="menu-select"
          >
            {keyOptions.map((key) => (
              <option key={key.id} value={key.id}>
                {key.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="section-heading">Scale Representation</div>
          <select
            value={scaleRepresentation}
            onChange={(e) => setScaleRepresentation(e.target.value as ScaleRepresentation)}
            disabled={isDailyAuto || !scaleRepresentationEnabled}
            className="menu-select"
          >
            <option value="straight">Straight (Scale Order)</option>
            <option value="seconds">In 2nds</option>
            <option value="thirds">In 3rds</option>
            <option value="fourths">In 4ths</option>
            <option value="fifths">In 5ths</option>
            <option value="sixths">In 6ths</option>
            <option value="sevenths">In 7ths</option>
          </select>
          {!isDailyAuto && !scaleRepresentationEnabled ? (
            <p className="menu-summary">Interval representation is available for scales only.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
