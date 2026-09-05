import { useEffect, useRef, useState } from "react";
import {
  Accidental,
  Formatter,
  Renderer,
  Stave,
  StaveNote,
  TabNote,
  TabStave,
  Voice,
} from "vexflow";
import { NoteEvent } from "../types";
import { pitchKeyForVexflow } from "../music/utils";
import { AccidentalPreference } from "../music/keys";

type RenderPanelProps = {
  title: string;
  primaryNotes: NoteEvent[];
  secondaryNotes?: NoteEvent[];
  secondaryLabel?: string;
  activePrimaryIndex: number;
  activeSecondaryIndex: number;
  rootPitchClass: number;
  accidentalPreference: AccidentalPreference;
  keySignature: string;
};

export function RenderPanel({
  title,
  primaryNotes,
  secondaryNotes,
  secondaryLabel,
  activePrimaryIndex,
  activeSecondaryIndex,
  rootPitchClass,
  accidentalPreference,
  keySignature,
}: RenderPanelProps): JSX.Element {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [panelWidth, setPanelWidth] = useState<number>(920);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const updateWidth = (): void => {
      const next = Math.max(320, mount.clientWidth || 920);
      setPanelWidth((prev) => (prev === next ? prev : next));
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    observer.observe(mount);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    mount.innerHTML = "";

    if (primaryNotes.length === 0) return;

    const width = panelWidth;
    const hasSecondary = Boolean(secondaryNotes && secondaryNotes.length > 0);
    const height = hasSecondary ? 472 : 248;

    const renderer = new Renderer(mount, Renderer.Backends.SVG);
    renderer.resize(width, height);
    const context = renderer.getContext();

    const drawSystem = (notes: NoteEvent[], y: number, activeIndex: number): void => {
      const x = 12;
      const staveWidth = width - 24;
      const stave = new Stave(x, y, staveWidth);
      const tabStave = new TabStave(x, y + 100, staveWidth);

      stave.addClef("treble");
      if (keySignature !== "C") {
        stave.addKeySignature(keySignature);
      }
      tabStave.addClef("tab");

      stave.setContext(context).draw();
      tabStave.setContext(context).draw();
      tabStave.setNoteStartX(stave.getNoteStartX());

      const staveNotes = notes.map((n, globalIndex) => {
        const { key, accidental } = pitchKeyForVexflow(n.midi, accidentalPreference);
        const isRoot = n.midi % 12 === rootPitchClass;

        const note = new StaveNote({
          keys: [key],
          duration: n.duration,
          clef: "treble",
        });

        if (accidental) {
          note.addModifier(new Accidental(accidental), 0);
        }

        if (globalIndex === activeIndex) {
          note.setStyle({ fillStyle: "#d44919", strokeStyle: "#d44919" });
        } else if (isRoot) {
          note.setStyle({ fillStyle: "#ff3ea5", strokeStyle: "#ff3ea5" });
        } else {
          note.setStyle({ fillStyle: "#1f2937", strokeStyle: "#1f2937" });
        }

        return note;
      });

      const tabNotes = notes.map((n, globalIndex) => {
        const isRoot = n.midi % 12 === rootPitchClass;
        const tabNote = new TabNote({
          positions: [{ str: n.string, fret: n.fret.toString() }],
          duration: n.duration,
        });

        if (globalIndex === activeIndex) {
          tabNote.setStyle({ fillStyle: "#d44919", strokeStyle: "#d44919" });
        } else if (isRoot) {
          tabNote.setStyle({ fillStyle: "#ff3ea5", strokeStyle: "#ff3ea5" });
        } else {
          tabNote.setStyle({ fillStyle: "#1f2937", strokeStyle: "#1f2937" });
        }

        return tabNote;
      });

      const staveVoice = new Voice({ num_beats: notes.length, beat_value: 8 });
      staveVoice.setMode(Voice.Mode.SOFT);
      staveVoice.addTickables(staveNotes);

      const tabVoice = new Voice({ num_beats: notes.length, beat_value: 8 });
      tabVoice.setMode(Voice.Mode.SOFT);
      tabVoice.addTickables(tabNotes);

      const formatWidth = Math.max(40, stave.getNoteEndX() - stave.getNoteStartX() - 8);
      new Formatter().joinVoices([staveVoice]).joinVoices([tabVoice]).format([staveVoice, tabVoice], formatWidth);

      staveVoice.draw(context, stave);
      tabVoice.draw(context, tabStave);
    };

    drawSystem(primaryNotes, 16, activePrimaryIndex);

    if (hasSecondary && secondaryNotes) {
      drawSystem(secondaryNotes, 240, activeSecondaryIndex);
    }
  }, [
    primaryNotes,
    secondaryNotes,
    activePrimaryIndex,
    activeSecondaryIndex,
    panelWidth,
    rootPitchClass,
    accidentalPreference,
    keySignature,
  ]);

  return (
    <section className="card render-card">
      <div className="section-heading">{title}</div>
      {secondaryNotes && secondaryNotes.length > 0 ? (
        <div className="menu-summary">{secondaryLabel ?? "Interval Representation"}</div>
      ) : null}
      <div ref={mountRef} className="notation-mount" />
    </section>
  );
}
