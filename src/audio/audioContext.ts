// One AudioContext for the whole app.
//
// The metronome and the riff synth used to open one each. Browsers cap how many
// can exist, and some (Safari especially) will happily create a second one that
// reports "running" while producing no output at all — which shows up as one
// feature having sound and the other silently not. Sharing a single context
// removes that whole class of problem, and lets both mix through the same
// output node.

let ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  return ctx;
}

// Browsers start a context suspended until a user gesture. Call this from the
// click handler before scheduling anything.
export async function resumeAudio(): Promise<AudioContext> {
  const context = getAudioContext();
  if (context.state === "suspended") {
    try {
      await context.resume();
    } catch {
      // Nothing useful to do — the caller will still schedule, and the context
      // resumes on the next gesture.
    }
  }
  return context;
}
