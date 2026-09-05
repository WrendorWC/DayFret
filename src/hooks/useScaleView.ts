import { useMemo, useState } from "react";
import { ChartKey } from "../music/chords";
import { buildScaleDiagram, SCALE_KEYS, SCALES, ScaleDef, ScaleDiagram } from "../music/scales";

export type ScaleViewState = {
  diagram: ScaleDiagram;
  scales: ScaleDef[];
  keys: ChartKey[];
  onPickScale: (scaleId: string) => void;
  onPickKey: (keyLabel: string) => void;
  selectScale: (scaleId: string, keyLabel: string) => void;
};

export function useScaleView(): ScaleViewState {
  const [scaleId, setScaleId] = useState<string>("minor-pentatonic");
  const [keyLabel, setKeyLabel] = useState<string>("A");

  const diagram = useMemo(() => {
    const scale = SCALES.find((s) => s.id === scaleId) ?? SCALES[0];
    const key = SCALE_KEYS.find((k) => k.label === keyLabel) ?? SCALE_KEYS[0];
    return buildScaleDiagram(scale, key);
  }, [scaleId, keyLabel]);

  return {
    diagram,
    scales: SCALES,
    keys: SCALE_KEYS,
    onPickScale: setScaleId,
    onPickKey: setKeyLabel,
    selectScale: (id, label) => {
      setScaleId(id);
      setKeyLabel(label);
    },
  };
}
