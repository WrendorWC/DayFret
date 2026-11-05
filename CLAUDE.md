# DayFret

A local-only guitar practice app: a daily practice page built on scanned PDF
books, plus interactive chord charts, a scale explorer, arpeggios and a riff
generator. React + TypeScript + Vite. No backend, no database, no tests.

## Running it

```bash
npm install
npm run dev          # http://127.0.0.1:5192 — live reload, this is what you want while working
```

The **`dev` server serves source. Everything else serves `dist/`.** The
day-to-day launcher (`dayfret.command`, or the LaunchAgent installed by
`scripts/dayfret-ctl.sh install`) runs `npm run preview`, which serves a
prebuilt `dist/` and only builds when `dist/` is *missing*. So after changing
source, a running instance shows nothing new until:

```bash
npm run build
./scripts/dayfret-ctl.sh restart    # or ./dayfret.command if the LaunchAgent isn't installed
```

If someone reports "no change on my end", this is almost always why.

`npm run build` is also the typecheck (`tsc -b && vite build`) — run it before
committing.

## Two apps in one repo

- **`index.html` → `src/App.tsx`** — the full app: PDF practice books rendered
  to canvas, the daily exercise, metronome, and all the panels.
- **`chords.html` → `src/standalone/ChordsApp.tsx`** — chords/scales/riffs only,
  no PDFs. `npm run build:chords` builds it and `scripts/make-standalone.mjs`
  inlines the assets into one self-contained `dist-chords/DayFretChords.html`
  that runs from `file://`. Both apps share the same components and music
  engine, so a change to `src/music` or `src/components` hits both.

## Page layout

Both apps use the same structure, and new pages should follow it:

- **Navigation in two groups.** *Practice* is things you play (Today, Books,
  Progressions, Riffs); *Reference* is things you look up (Chords, Scales).
  The standalone app has no PDF books, so no Today/Books.
- **The sidebar holds only navigation and app-wide tools** (metronome, timer).
  A page's own pickers go in a toolbar card at the top of the page
  (`components/PageToolbars.tsx`), and the content card sits below it.
- **One Intervals/Notes setting** (`hooks/useLabelMode.tsx`), remembered in
  localStorage. Panels render `<LabelToggle />` beside their play button
  rather than keeping their own state.
- **Chords, Scales and Riffs share one key** (`hooks/useReference.ts`). Only the
  key pickers sync. Cross-links (a chord card's "All voicings ›", a matching
  scale) open their target without changing the key elsewhere.
- **Any chord card links to its Chords page** via `onOpenChord`, so voicings,
  arpeggios and matching scales live in one place instead of being rebuilt
  per page.

## Code map

`src/music/` is the theory engine — pure TypeScript, no React, no DOM. This is
where the real logic lives and where changes usually belong.

| File | What it owns |
| --- | --- |
| `tuning.ts` | Open-string MIDI pitches. Every other module derives fret↔pitch from here. |
| `chords.ts` | Chord spelling, voicings, progressions, key definitions. |
| `scales.ts` | Scale library, fretboard diagrams, **position boxes**, harmonization. |
| `arpeggios.ts` | Arpeggio shapes by root string and starting finger. |
| `riffs.ts` | Seeded riff generator, hand-position aware. |
| `runs.ts` | Turns a set of fretboard positions into a playable line. |
| `exercises.ts`, `daily.ts` | Exercise library and the date-seeded daily pick. |
| `pdf/` | Book/section catalog and MIDI note data for PDF playback. |

`src/components/` renders; `src/hooks/` glues state together; `src/audio/`
is the synth and metronome.

Conventions used throughout: **string index 0 is the low E string** (the
fretboard SVG draws it at the bottom, high E on top), fret 0 means open, and
`FRET_COUNT` is 21.

## Music rules worth knowing before editing

**Position boxes** (`boxWindow` in `scales.ts`) are the part most easily got
wrong. A box is a fret window that must hold a *whole* position: starting from
its own tone on the low E string, every consecutive note of the scale above
that tone has to sit somewhere inside it. A flat four-fret window starting on
the anchor tone does **not** satisfy this — that's what made A major pentatonic
box 1 come out as frets 5–8 (dropping the C# and F#) when the real box is
frets 4–7, root at the 5th fret under the second finger. Some positions need
five frets (A minor pentatonic box 3 is frets 9–13). Widen the window; never
drop the note.

Wide windows can contain the same pitch in two places (adjacent strings, five
frets apart). That's expected — `chooseRun` in `runs.ts` picks the one that's
easier under the hand and reports the other so the diagram can shade it.

**Riffs** (`riffs.ts`) are built in three passes, and each has its own job:

1. **Notes.** A short motif (two beats for rock, funk and gallop, a bar for
   blues and melodic) is repeated and developed: repeated at Simple, answered
   at Moderate, transposed at Tricky, contrasted at Brutal. Then comes an ending
   that lands on a held root on a beat. Pitch choice is weighted by the beat:
   chord tones on beats 1 and 3. Rock and gallop riffs may pump a low root
   pedal under the tune. Chromatic notes are always approach notes a half step
   into a strong beat, never stand-ins for a scale tone.
2. **Fingering.** One shortest-path pass over every string/fret option. It
   keeps the hand in the box and on the feel's strings, and it crosses strings
   rather than sliding along one (the riff rule: one position, crossing
   strings). It only moves the hand when there is time to.
3. **Decorations.** Chosen last, from the final fingering: a slur or slide
   only goes straight into a note on the same string, and a bend only goes on
   a note long enough to reach pitch.

Difficulty comes from technique (density, sequences, leaps between chord
tones, approach notes, reach), not from more randomness. Tricky and Brutal are
4 bars, with sixteenths and sextuplets at Brutal. At those two levels, low
riffs keep to the A, D and G strings and come down to the low E only for its
root. A busy line parked on the low E sounds like mud. No pitch repeats more
than twice running, and a final pass removes A-B-A-B trills.

**Span** (1–3 positions) makes a riff travel: it climbs from the chosen box
through the next one or two, carrying the motif up with it, slides where the
move is on one string, and ends on a root in the last box. It is never a pedal
riff, since a pedal holds the hand in one place.

`./scripts/check-riffs.sh` sweeps about 17,000 riffs and fails if any of these
rules break. Run it after touching `riffs.ts`.

All date logic is anchored to `America/New_York`, on purpose, so the daily
practice set doesn't shift with the browser's timezone.

## Verifying theory changes

There's no test runner. For anything in `src/music`, bundle the module and
exercise it directly rather than clicking through the UI:

```bash
npx esbuild src/music/scales.ts --bundle --format=esm --outfile=/tmp/scales.mjs
node -e "import('/tmp/scales.mjs').then(m => { /* sweep scales × keys, assert invariants */ })"
```

Sweeping all scales in all 12 keys and asserting an invariant (every box
gap-free, every box starting on its own tone) catches far more than spot
checks. Follow it with a real look at the app — `npm run dev`, then Scales →
pick the scale and key → pick a position — since these are shapes, and a
screenshot shows a ragged box instantly.

Cross-check against `SCALE_MINOR_PENT_BOXES_A` in `exercises.ts`: those five A
minor pentatonic boxes are hand-written note by note and are correct.

## Style

Comments here explain the *musical* reasoning, not the code mechanics — why a
box widens, why a run picks one duplicate pitch over another. Match that. Keep
dependencies as they are; this app is meant to keep working offline, from a
folder, years from now.
