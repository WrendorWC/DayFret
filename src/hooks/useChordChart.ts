import { useMemo, useState } from "react";
import {
  buildChordChart,
  buildCustomChart,
  ChartKey,
  ChordChart,
  MAJOR_CHART_KEYS,
  MINOR_CHART_KEYS,
  PROGRESSIONS,
  Progression,
} from "../music/chords";

// Either today's seeded chart (chartIndex 0) / a random one, or an explicit
// progression + key chosen through the pickers.
type Selection =
  | { kind: "seeded"; chartIndex: number }
  | { kind: "custom"; progressionId: string; keyLabel: string };

export type ChordChartState = {
  chart: ChordChart;
  isDailyChart: boolean;
  heading: string; // panel heading matching the current selection
  selectionKind: Selection["kind"];
  keysForChart: ChartKey[];
  progressions: Progression[];
  onPickProgression: (progressionId: string) => void;
  onPickKey: (keyLabel: string) => void;
  onSelectCustom: (progressionId: string, keyLabel: string) => void;
  onSurpriseMe: () => void;
  onNewVoicings: () => void;
  onBackToToday: () => void;
};

export function useChordChart(dateISO: string): ChordChartState {
  const [selection, setSelection] = useState<Selection>({ kind: "seeded", chartIndex: 0 });
  const [voicingVariant, setVoicingVariant] = useState<number>(0);

  const chart = useMemo(() => {
    if (selection.kind === "seeded") {
      return buildChordChart(dateISO, selection.chartIndex, voicingVariant);
    }
    const progression =
      PROGRESSIONS.find((p) => p.id === selection.progressionId) ?? PROGRESSIONS[0];
    const keys = progression.mode === "major" ? MAJOR_CHART_KEYS : MINOR_CHART_KEYS;
    const key = keys.find((k) => k.label === selection.keyLabel) ?? keys[0];
    return buildCustomChart(progression, key, voicingVariant);
  }, [dateISO, selection, voicingVariant]);

  const isDailyChart =
    selection.kind === "seeded" && selection.chartIndex === 0 && voicingVariant === 0;

  const keysForChart =
    chart.progression.mode === "major" ? MAJOR_CHART_KEYS : MINOR_CHART_KEYS;

  const onPickProgression = (progressionId: string): void => {
    const progression = PROGRESSIONS.find((p) => p.id === progressionId) ?? PROGRESSIONS[0];
    const keys = progression.mode === "major" ? MAJOR_CHART_KEYS : MINOR_CHART_KEYS;
    // Keep the current key when it exists in the new progression's mode
    const keyLabel = keys.some((k) => k.label === chart.key.label)
      ? chart.key.label
      : keys[0].label;
    setSelection({ kind: "custom", progressionId, keyLabel });
    setVoicingVariant(0);
  };

  const onPickKey = (keyLabel: string): void => {
    setSelection({ kind: "custom", progressionId: chart.progression.id, keyLabel });
    setVoicingVariant(0);
  };

  // Jump straight to a specific progression + key (used by the scale swap)
  const onSelectCustom = (progressionId: string, keyLabel: string): void => {
    setSelection({ kind: "custom", progressionId, keyLabel });
    setVoicingVariant(0);
  };

  const onSurpriseMe = (): void => {
    setSelection((prev) => ({
      kind: "seeded",
      chartIndex: prev.kind === "seeded" ? prev.chartIndex + 1 : 1,
    }));
    setVoicingVariant(0);
  };

  const onNewVoicings = (): void => setVoicingVariant((v) => v + 1);

  const onBackToToday = (): void => {
    setSelection({ kind: "seeded", chartIndex: 0 });
    setVoicingVariant(0);
  };

  const heading = chart.progression.keyless
    ? "Reference Chart"
    : isDailyChart
      ? "Chord Chart of the Day"
      : selection.kind === "custom"
        ? "Custom Chord Chart"
        : "Random Chord Chart";

  return {
    chart,
    isDailyChart,
    heading,
    selectionKind: selection.kind,
    keysForChart,
    progressions: PROGRESSIONS,
    onPickProgression,
    onPickKey,
    onSelectCustom,
    onSurpriseMe,
    onNewVoicings,
    onBackToToday,
  };
}
