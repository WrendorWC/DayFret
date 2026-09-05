import { useCallback, useEffect, useRef, useState } from "react";
import { getRiffSynth, PlayNote } from "../audio/riffSynth";
import { RunNote } from "../music/runs";

// Shared playback for chords, scales and arpeggios. Tracks which note of a
// sequence is currently sounding so the diagrams can highlight along.
export function usePlayback(bpm: number) {
  const [playing, setPlaying] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  // Polled from a timer rather than requestAnimationFrame: rAF is throttled
  // whenever the page is not actively compositing, which left the highlight
  // frozen on the first note while the audio carried on.
  const timerRef = useRef<number | null>(null);
  // The sequence currently playing, so the diagrams can light the right note
  const seqRef = useRef<RunNote[]>([]);
  // Timers for the one-shot flash when a single chord is clicked
  const flashRef = useRef<number | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    if (flashRef.current !== null) window.clearTimeout(flashRef.current);
    flashRef.current = null;
  }, []);

  const stop = useCallback(() => {
    getRiffSynth().stop();
    cancel();
    setPlaying(false);
    setActiveIndex(null);
  }, [cancel]);

  useEffect(() => stop, [stop]);

  // A run of single notes, highlighting each as it sounds
  const playSequence = useCallback(
    async (notes: RunNote[], opts: { notesPerBeat?: number; at?: number } = {}) => {
      if (notes.length === 0) return;

      const synth = getRiffSynth();
      await synth.resume();
      synth.stop();
      cancel();

      seqRef.current = notes;
      const { startTime, secondsPerNote, totalSeconds } = synth.playSequence(notes, bpm, opts);
      setPlaying(true);
      // Highlight the first note straight away rather than waiting for the
      // first animation frame, which can be delayed on a busy page.
      setActiveIndex(0);

      timerRef.current = window.setInterval(() => {
        const elapsed = synth.currentTime - startTime;
        if (elapsed > totalSeconds) {
          cancel();
          setPlaying(false);
          setActiveIndex(null);
          return;
        }
        setActiveIndex(
          elapsed < 0 ? 0 : Math.min(notes.length - 1, Math.floor(elapsed / secondsPerNote)),
        );
      }, 25);
    },
    [bpm, cancel],
  );

  // A single strummed chord. Passing its index flashes that diagram, the same
  // highlight the whole-chart playback uses.
  const playChord = useCallback(
    async (notes: PlayNote[], index?: number) => {
      if (notes.length === 0) return;
      const synth = getRiffSynth();
      await synth.resume();
      synth.stop();
      cancel();
      setPlaying(false);
      synth.playChord(notes);

      if (index === undefined) return;
      // Clear first so clicking the same chord twice restarts the animation
      // rather than leaving the class in place and showing nothing.
      setActiveIndex(null);
      flashRef.current = window.setTimeout(() => {
        setActiveIndex(index);
        flashRef.current = window.setTimeout(() => {
          setActiveIndex(null);
          flashRef.current = null;
        }, 620);
      }, 20);
    },
    [cancel],
  );

  // Several chords in turn, one per bar, highlighting the current one
  const playChords = useCallback(
    async (chords: PlayNote[][], beatsEach = 2) => {
      if (chords.length === 0) return;
      const synth = getRiffSynth();
      await synth.resume();
      synth.stop();
      cancel();

      const gap = (60 / bpm) * beatsEach;
      const start = synth.currentTime + 0.1;
      chords.forEach((notes, i) => {
        synth.playChord(notes, { at: start + i * gap, seconds: gap * 1.1 });
      });
      setPlaying(true);
      setActiveIndex(0);

      const total = chords.length * gap;
      timerRef.current = window.setInterval(() => {
        const elapsed = synth.currentTime - start;
        if (elapsed > total) {
          cancel();
          setPlaying(false);
          setActiveIndex(null);
          return;
        }
        setActiveIndex(elapsed < 0 ? 0 : Math.min(chords.length - 1, Math.floor(elapsed / gap)));
      }, 25);
    },
    [bpm, cancel],
  );

  // The exact string and fret sounding, so only that one lights up rather
  // than every place on the neck carrying the same pitch.
  const activeNote =
    activeIndex !== null && seqRef.current.length > 0
      ? (seqRef.current[activeIndex] ?? null)
      : null;

  return { playing, activeIndex, activeNote, playSequence, playChord, playChords, stop };
}
