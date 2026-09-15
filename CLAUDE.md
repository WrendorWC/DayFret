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
