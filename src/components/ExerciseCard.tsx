import { ExerciseDefinition } from "../types";

type ExerciseCardProps = {
  exercise: ExerciseDefinition;
  keyLabel: string;
  isDailyAuto: boolean;
};

export function ExerciseCard({ exercise, keyLabel, isDailyAuto }: ExerciseCardProps): JSX.Element {
  return (
    <section className="card exercise-card">
      <h2 className="exercise-title">{exercise.name}</h2>
      <p className="exercise-meta">
        {exercise.practiceType === "scale" ? "Scale" : "Arpeggio"} • Key of {keyLabel} •{" "}
        {isDailyAuto ? "Daily Auto" : "Custom"}
      </p>
      <p className="exercise-description">{exercise.description}</p>
    </section>
  );
}
