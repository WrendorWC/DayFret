import { EXERCISE_LIBRARY } from "./exercises";
import { ExerciseDefinition } from "../types";
import { KEY_OPTIONS, KeyOption } from "./keys";

export function hashStringToInt(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function getDateISOInTimeZone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to derive date parts for timezone");
  }

  return `${year}-${month}-${day}`;
}

export function getTodaysExercise(dateISO: string): ExerciseDefinition {
  const h = hashStringToInt(dateISO);
  return EXERCISE_LIBRARY[h % EXERCISE_LIBRARY.length];
}

export function getTodaysSelection(dateISO: string): { exercise: ExerciseDefinition; key: KeyOption } {
  const h = hashStringToInt(dateISO);
  const exercise = EXERCISE_LIBRARY[h % EXERCISE_LIBRARY.length];
  const key = KEY_OPTIONS[Math.floor(h / EXERCISE_LIBRARY.length) % KEY_OPTIONS.length];
  return { exercise, key };
}
