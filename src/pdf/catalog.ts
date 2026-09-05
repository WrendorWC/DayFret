export type PdfBookId =
  | "morning_coffee"
  | "cream_sugar"
  | "glissando_arpeggios"
  | "hopscotch_vol1"
  | "hopscotch_vol2"
  | "uncaged_part1"
  | "uncaged_part2";

export type SectionScriptId =
  | "none"
  | "exercise"
  | "major_scale"
  | "major_triad_arpeggio"
  | "major_pentatonic"
  | "minor_triad_arpeggio"
  | "minor_pentatonic"
  | "major_broken_3"
  | "major_broken_4"
  | "major_broken_5"
  | "major_broken_6"
  | "major_broken_7"
  | "major_broken_8"
  | "major_broken_9"
  | "major_broken_10"
  | "diatonic_seventh_arpeggios"
  | "minor_scale"
  | "harmonic_minor_scale"
  | "melodic_minor_scale"
  | "melodic_minor_ascending"
  | "harmonic_major_scale"
  | "double_harmonic_major"
  | "minor_broken_3"
  | "minor_broken_4"
  | "minor_broken_5"
  | "minor_broken_6"
  | "minor_broken_7"
  | "minor_broken_8"
  | "minor_broken_9"
  | "minor_broken_10"
  | "diminished_seventh_arpeggios"
  | "augmented_arpeggios";

// A single key entry within a section — maps a root pitch to a PDF page.
//
// rootMidi: MIDI note for the root (e.g. 48 = C3, 45 = A2).
// page:     1-based PDF page index.
// systems:  Which overlay systems (0-indexed TAB rows, top-to-bottom) on the
//           page belong to this key.
//           null  → all systems (used when one key owns the entire page, e.g.
//                   diatonic seventh arpeggios).
//           [a,b] → systems a through b inclusive.
//           For 3-page sections: 4 systems/page → [0,0],[1,1],[2,2],[3,3].
//           For 6-page broken sections: 4 rows/page (2 per key) → [0,1],[2,3].
//           For 4-key/page sections (dim7, aug): [0,0],[1,1],[2,2],[3,3].
export type PdfKeyEntry = {
  id: string;
  label: string;
  rootMidi: number;
  page: number;
  systems: [number, number] | null;
};

export type PdfSection = {
  id: string;
  title: string;
  scriptId: SectionScriptId;
  keys: PdfKeyEntry[];
};

export type PdfBook = {
  id: PdfBookId;
  title: string;
  file: string;
  totalPages: number;
  sections: PdfSection[];
};

// Replaces PracticePage — carries everything App needs for a selected key.
export type PracticeKey = {
  bookId: PdfBookId;
  sectionId: string;
  sectionTitle: string;
  scriptId: SectionScriptId;
  keyId: string;
  label: string;
  rootMidi: number;
  page: number;
  systems: [number, number] | null;
};

// ---------------------------------------------------------------------------
// Key-list builders (verified against pdftotext B-string fret analysis)
// ---------------------------------------------------------------------------

// MIDI roots (all on or near low-E string position, MIDI 40 = E2 open):
//   C=48  G=43  D=50  A=45  E=52  B=47  Gb=42  Db=49  Ab=44  Eb=51  Bb=46  F=41
//   F#=42  C#=49  G#=44  D#=51  (enharmonic equivalents used for minor COF)

// 3-page major section: 4 keys per page (1 system each), circle-of-5ths order.
// p+0: C[0] G[1] D[2] A[3]  |  p+1: E[0] B[1] Gb[2] Db[3]  |  p+2: Ab[0] Eb[1] Bb[2] F[3]
function majorKeys(startPage: number): PdfKeyEntry[] {
  return [
    { id: "c",  label: "C",  rootMidi: 48, page: startPage,     systems: [0, 0] },
    { id: "g",  label: "G",  rootMidi: 43, page: startPage,     systems: [1, 1] },
    { id: "d",  label: "D",  rootMidi: 50, page: startPage,     systems: [2, 2] },
    { id: "a",  label: "A",  rootMidi: 45, page: startPage,     systems: [3, 3] },
    { id: "e",  label: "E",  rootMidi: 52, page: startPage + 1, systems: [0, 0] },
    { id: "b",  label: "B",  rootMidi: 47, page: startPage + 1, systems: [1, 1] },
    { id: "gb", label: "Gb", rootMidi: 42, page: startPage + 1, systems: [2, 2] },
    { id: "db", label: "Db", rootMidi: 49, page: startPage + 1, systems: [3, 3] },
    { id: "ab", label: "Ab", rootMidi: 44, page: startPage + 2, systems: [0, 0] },
    { id: "eb", label: "Eb", rootMidi: 51, page: startPage + 2, systems: [1, 1] },
    { id: "bb", label: "Bb", rootMidi: 46, page: startPage + 2, systems: [2, 2] },
    { id: "f",  label: "F",  rootMidi: 41, page: startPage + 2, systems: [3, 3] },
  ];
}

// 3-page minor section: 4 keys per page, minor circle-of-5ths order.
// p+0: A[0] E[1] B[2] F#[3]  |  p+1: C#[0] G#[1] Eb[2] Bb[3]  |  p+2: F[0] C[1] G[2] D[3]
function minorKeys(startPage: number): PdfKeyEntry[] {
  return [
    { id: "a",  label: "A",  rootMidi: 45, page: startPage,     systems: [0, 0] },
    { id: "e",  label: "E",  rootMidi: 52, page: startPage,     systems: [1, 1] },
    { id: "b",  label: "B",  rootMidi: 47, page: startPage,     systems: [2, 2] },
    { id: "fs", label: "F#", rootMidi: 42, page: startPage,     systems: [3, 3] },
    { id: "cs", label: "C#", rootMidi: 49, page: startPage + 1, systems: [0, 0] },
    { id: "gs", label: "G#", rootMidi: 44, page: startPage + 1, systems: [1, 1] },
    { id: "eb", label: "Eb", rootMidi: 51, page: startPage + 1, systems: [2, 2] },
    { id: "bb", label: "Bb", rootMidi: 46, page: startPage + 1, systems: [3, 3] },
    { id: "f",  label: "F",  rootMidi: 41, page: startPage + 2, systems: [0, 0] },
    { id: "c",  label: "C",  rootMidi: 48, page: startPage + 2, systems: [1, 1] },
    { id: "g",  label: "G",  rootMidi: 43, page: startPage + 2, systems: [2, 2] },
    { id: "d",  label: "D",  rootMidi: 50, page: startPage + 2, systems: [3, 3] },
  ];
}

// 6-page major broken-interval section: 2 keys per page, each spanning 2 TAB rows.
// p+0: C[0,1] G[2,3]  |  p+1: D[0,1] A[2,3]  |  p+2: E[0,1] B[2,3]
// p+3: Gb[0,1] Db[2,3]  |  p+4: Ab[0,1] Eb[2,3]  |  p+5: Bb[0,1] F[2,3]
function majorBrokenKeys(startPage: number): PdfKeyEntry[] {
  return [
    { id: "c",  label: "C",  rootMidi: 48, page: startPage,     systems: [0, 1] },
    { id: "g",  label: "G",  rootMidi: 43, page: startPage,     systems: [2, 3] },
    { id: "d",  label: "D",  rootMidi: 50, page: startPage + 1, systems: [0, 1] },
    { id: "a",  label: "A",  rootMidi: 45, page: startPage + 1, systems: [2, 3] },
    { id: "e",  label: "E",  rootMidi: 52, page: startPage + 2, systems: [0, 1] },
    { id: "b",  label: "B",  rootMidi: 47, page: startPage + 2, systems: [2, 3] },
    { id: "gb", label: "Gb", rootMidi: 42, page: startPage + 3, systems: [0, 1] },
    { id: "db", label: "Db", rootMidi: 49, page: startPage + 3, systems: [2, 3] },
    { id: "ab", label: "Ab", rootMidi: 44, page: startPage + 4, systems: [0, 1] },
    { id: "eb", label: "Eb", rootMidi: 51, page: startPage + 4, systems: [2, 3] },
    { id: "bb", label: "Bb", rootMidi: 46, page: startPage + 5, systems: [0, 1] },
    { id: "f",  label: "F",  rootMidi: 41, page: startPage + 5, systems: [2, 3] },
  ];
}

// 6-page minor broken-interval section: same shape as majorBrokenKeys.
// p+0: A[0,1] E[2,3]  |  p+1: B[0,1] F#[2,3]  |  p+2: C#[0,1] G#[2,3]
// p+3: Eb[0,1] Bb[2,3]  |  p+4: F[0,1] C[2,3]  |  p+5: G[0,1] D[2,3]
function minorBrokenKeys(startPage: number): PdfKeyEntry[] {
  return [
    { id: "a",  label: "A",  rootMidi: 45, page: startPage,     systems: [0, 1] },
    { id: "e",  label: "E",  rootMidi: 52, page: startPage,     systems: [2, 3] },
    { id: "b",  label: "B",  rootMidi: 47, page: startPage + 1, systems: [0, 1] },
    { id: "fs", label: "F#", rootMidi: 42, page: startPage + 1, systems: [2, 3] },
    { id: "cs", label: "C#", rootMidi: 49, page: startPage + 2, systems: [0, 1] },
    { id: "gs", label: "G#", rootMidi: 44, page: startPage + 2, systems: [2, 3] },
    { id: "eb", label: "Eb", rootMidi: 51, page: startPage + 3, systems: [0, 1] },
    { id: "bb", label: "Bb", rootMidi: 46, page: startPage + 3, systems: [2, 3] },
    { id: "f",  label: "F",  rootMidi: 41, page: startPage + 4, systems: [0, 1] },
    { id: "c",  label: "C",  rootMidi: 48, page: startPage + 4, systems: [2, 3] },
    { id: "g",  label: "G",  rootMidi: 43, page: startPage + 5, systems: [0, 1] },
    { id: "d",  label: "D",  rootMidi: 50, page: startPage + 5, systems: [2, 3] },
  ];
}

// 12-page diatonic 7th arpeggios: 1 key per page, all systems → null.
// C G D A E B Gb Db Ab Eb Bb F  (startPage through startPage+11)
function diatonicSeventhKeys(startPage: number): PdfKeyEntry[] {
  return [
    { id: "c",  label: "C",  rootMidi: 48, page: startPage,      systems: null },
    { id: "g",  label: "G",  rootMidi: 43, page: startPage + 1,  systems: null },
    { id: "d",  label: "D",  rootMidi: 50, page: startPage + 2,  systems: null },
    { id: "a",  label: "A",  rootMidi: 45, page: startPage + 3,  systems: null },
    { id: "e",  label: "E",  rootMidi: 52, page: startPage + 4,  systems: null },
    { id: "b",  label: "B",  rootMidi: 47, page: startPage + 5,  systems: null },
    { id: "gb", label: "Gb", rootMidi: 42, page: startPage + 6,  systems: null },
    { id: "db", label: "Db", rootMidi: 49, page: startPage + 7,  systems: null },
    { id: "ab", label: "Ab", rootMidi: 44, page: startPage + 8,  systems: null },
    { id: "eb", label: "Eb", rootMidi: 51, page: startPage + 9,  systems: null },
    { id: "bb", label: "Bb", rootMidi: 46, page: startPage + 10, systems: null },
    { id: "f",  label: "F",  rootMidi: 41, page: startPage + 11, systems: null },
  ];
}

// Glissando Arpeggios: 3 keys per page, 4 pages = 12 keys per section.
// systems is null for all entries (no overlay in current build).
function gl12Keys(
  startPage: number,
  roots: Array<{ id: string; label: string; rootMidi: number }>,
): PdfKeyEntry[] {
  return roots.map((r, i) => ({
    id: r.id,
    label: r.label,
    rootMidi: r.rootMidi,
    page: startPage + Math.floor(i / 3),
    systems: null,
  }));
}

// Hopscotch Vol 1: 8 intervals × 4 mode-pair pages = 32 entries per key section.
// systems is null for all entries.
function hopscotchKeys(startPage: number, rootMidi: number): PdfKeyEntry[] {
  const INTERVALS = [
    "Thirds", "Fourths", "Fifths", "Sixths",
    "Sevenths", "Octaves", "Ninths", "Tenths",
  ];
  const MODE_PAIRS: [string, string][] = [
    ["Ionian",     "Dorian"],
    ["Phrygian",   "Lydian"],
    ["Mixolydian", "Aeolian"],
    ["Locrian",    "Ionian"],
  ];
  const entries: PdfKeyEntry[] = [];
  let page = startPage;
  for (const interval of INTERVALS) {
    for (const [m1, m2] of MODE_PAIRS) {
      entries.push({
        id: `${interval.toLowerCase()}_${m1.toLowerCase()}`,
        label: `${interval}: ${m1} / ${m2}`,
        rootMidi,
        page,
        systems: null,
      });
      page += 1;
    }
  }
  return entries;
}

// Hopscotch Vol 2: 8 intervals × 4 HM mode-pair pages = 32 entries per key section.
// systems is null for all entries.
function hopscotchHMKeys(startPage: number, rootMidi: number): PdfKeyEntry[] {
  const INTERVALS = [
    "Thirds", "Fourths", "Fifths", "Sixths",
    "Sevenths", "Octaves", "Ninths", "Tenths",
  ];
  const MODE_PAIRS: Array<{ m1: string; m2: string; suffix: string }> = [
    { m1: "Harmonic Minor",              m2: "Locrian \u266d6",      suffix: "hm"           },
    { m1: "Ionian \u266f5",              m2: "Dorian \u266f4",       suffix: "ionian5"      },
    { m1: "Phrygian Dominant",           m2: "Lydian \u266f2",       suffix: "phrygian_dom" },
    { m1: "Super Locrian \u266d\u266d7", m2: "Harmonic Minor",       suffix: "super_locrian"},
  ];
  const entries: PdfKeyEntry[] = [];
  let page = startPage;
  for (const interval of INTERVALS) {
    for (const { m1, m2, suffix } of MODE_PAIRS) {
      entries.push({
        id: `${interval.toLowerCase()}_${suffix}`,
        label: `${interval}: ${m1} / ${m2}`,
        rootMidi,
        page,
        systems: null,
      });
      page += 1;
    }
  }
  return entries;
}

// UnCAGED Part 1: 12 COF keys × 2 voicing pages (closed + drop 2) = 24 entries per section.
// systems is null for all entries.
function triadKeys(startPage: number): PdfKeyEntry[] {
  const COF = [
    { id: "c",  label: "C",  rootMidi: 48 }, { id: "g",  label: "G",  rootMidi: 43 },
    { id: "d",  label: "D",  rootMidi: 50 }, { id: "a",  label: "A",  rootMidi: 45 },
    { id: "e",  label: "E",  rootMidi: 52 }, { id: "b",  label: "B",  rootMidi: 47 },
    { id: "fs", label: "F#", rootMidi: 42 }, { id: "db", label: "Db", rootMidi: 49 },
    { id: "ab", label: "Ab", rootMidi: 44 }, { id: "eb", label: "Eb", rootMidi: 51 },
    { id: "bb", label: "Bb", rootMidi: 46 }, { id: "f",  label: "F",  rootMidi: 41 },
  ];
  const entries: PdfKeyEntry[] = [];
  let page = startPage;
  for (const key of COF) {
    entries.push({
      id: `${key.id}_closed`,
      label: `${key.label} \u2014 Closed`,
      rootMidi: key.rootMidi,
      page,
      systems: null,
    });
    entries.push({
      id: `${key.id}_drop2`,
      label: `${key.label} \u2014 Drop 2`,
      rootMidi: key.rootMidi,
      page: page + 1,
      systems: null,
    });
    page += 2;
  }
  return entries;
}

// UnCAGED Part 2: 18 entries per major key.
// Chord Scales (4 pages) + 7 progressions × 2 pages (closed + drop 2) = 4 + 14 = 18.
// systems is null for all entries.
function uncagedPart2Keys(startPage: number, rootMidi: number): PdfKeyEntry[] {
  const p = startPage;
  return [
    { id: "chord_scales_closed_1", label: "Chord Scales \u2014 Closed (1)",    rootMidi, page: p,      systems: null },
    { id: "chord_scales_closed_2", label: "Chord Scales \u2014 Closed (2)",    rootMidi, page: p + 1,  systems: null },
    { id: "chord_scales_drop2_1",  label: "Chord Scales \u2014 Drop 2 (1)",   rootMidi, page: p + 2,  systems: null },
    { id: "chord_scales_drop2_2",  label: "Chord Scales \u2014 Drop 2 (2)",   rootMidi, page: p + 3,  systems: null },
    { id: "i_v_closed",            label: "I \u2014 V \u2014 Closed",           rootMidi, page: p + 4,  systems: null },
    { id: "i_v_drop2",             label: "I \u2014 V \u2014 Drop 2",           rootMidi, page: p + 5,  systems: null },
    { id: "i_viio_closed",         label: "I \u2014 vii\u00b0 \u2014 Closed",  rootMidi, page: p + 6,  systems: null },
    { id: "i_viio_drop2",          label: "I \u2014 vii\u00b0 \u2014 Drop 2",  rootMidi, page: p + 7,  systems: null },
    { id: "i_iv_closed",           label: "I \u2014 IV \u2014 Closed",          rootMidi, page: p + 8,  systems: null },
    { id: "i_iv_drop2",            label: "I \u2014 IV \u2014 Drop 2",          rootMidi, page: p + 9,  systems: null },
    { id: "i_ii_closed",           label: "I \u2014 ii \u2014 Closed",          rootMidi, page: p + 10, systems: null },
    { id: "i_ii_drop2",            label: "I \u2014 ii \u2014 Drop 2",          rootMidi, page: p + 11, systems: null },
    { id: "i_vi_closed",           label: "I \u2014 vi \u2014 Closed",          rootMidi, page: p + 12, systems: null },
    { id: "i_vi_drop2",            label: "I \u2014 vi \u2014 Drop 2",          rootMidi, page: p + 13, systems: null },
    { id: "i_iii_closed",          label: "I \u2014 iii \u2014 Closed",         rootMidi, page: p + 14, systems: null },
    { id: "i_iii_drop2",           label: "I \u2014 iii \u2014 Drop 2",         rootMidi, page: p + 15, systems: null },
    { id: "falling_fifths_closed", label: "Falling Fifths \u2014 Closed",       rootMidi, page: p + 16, systems: null },
    { id: "falling_fifths_drop2",  label: "Falling Fifths \u2014 Drop 2",       rootMidi, page: p + 17, systems: null },
  ];
}

// ---------------------------------------------------------------------------
// Book data
// ---------------------------------------------------------------------------

export const PDF_BOOKS: PdfBook[] = [
  {
    id: "morning_coffee",
    title: "Morning Coffee",
    file: "/pdfs/morning-coffee-complete.pdf",
    totalPages: 78,
    sections: [
      {
        id: "intro",
        title: "Intro",
        scriptId: "none",
        keys: [
          { id: "p1", label: "Page 1", rootMidi: 48, page: 1, systems: null },
          { id: "p2", label: "Page 2", rootMidi: 48, page: 2, systems: null },
          { id: "p3", label: "Page 3", rootMidi: 48, page: 3, systems: null },
        ],
      },
      {
        id: "major_scales",
        title: "Major Scales",
        scriptId: "major_scale",
        keys: majorKeys(4),
      },
      {
        id: "major_triad_arpeggios",
        title: "Major Triad Arpeggios",
        scriptId: "major_triad_arpeggio",
        keys: majorKeys(7),
      },
      {
        id: "major_pentatonic_scales",
        title: "Major Pentatonic Scales",
        scriptId: "major_pentatonic",
        keys: majorKeys(10),
      },
      {
        id: "minor_triad_arpeggios",
        title: "Minor Triad Arpeggios",
        scriptId: "minor_triad_arpeggio",
        keys: minorKeys(13),
      },
      {
        id: "minor_pentatonic_scales",
        title: "Minor Pentatonic Scales",
        scriptId: "minor_pentatonic",
        keys: minorKeys(16),
      },
      {
        id: "major_broken_thirds",
        title: "Major Scales in Broken Thirds",
        scriptId: "major_broken_3",
        keys: majorBrokenKeys(19),
      },
      {
        id: "major_broken_fourths",
        title: "Major Scales in Broken Fourths",
        scriptId: "major_broken_4",
        keys: majorBrokenKeys(25),
      },
      {
        id: "major_broken_fifths",
        title: "Major Scales in Broken Fifths",
        scriptId: "major_broken_5",
        keys: majorBrokenKeys(31),
      },
      {
        id: "major_broken_sixths",
        title: "Major Scales in Broken Sixths",
        scriptId: "major_broken_6",
        keys: majorBrokenKeys(37),
      },
      {
        id: "major_broken_sevenths",
        title: "Major Scales in Broken Sevenths",
        scriptId: "major_broken_7",
        keys: majorBrokenKeys(43),
      },
      {
        id: "major_broken_octaves",
        title: "Major Scales in Broken Octaves",
        scriptId: "major_broken_8",
        keys: majorBrokenKeys(49),
      },
      {
        id: "major_broken_ninths",
        title: "Major Scales in Broken Ninths",
        scriptId: "major_broken_9",
        keys: majorBrokenKeys(55),
      },
      {
        id: "major_broken_tenths",
        title: "Major Scales in Broken Tenths",
        scriptId: "major_broken_10",
        keys: majorBrokenKeys(61),
      },
      {
        id: "diatonic_seventh_arpeggios",
        title: "Diatonic Seventh Arpeggios",
        scriptId: "diatonic_seventh_arpeggios",
        keys: diatonicSeventhKeys(67),
      },
    ],
  },
  {
    id: "cream_sugar",
    title: "Cream & Sugar",
    file: "/pdfs/cream-sugar-complete.pdf",
    totalPages: 73,
    sections: [
      {
        id: "intro",
        title: "Intro",
        scriptId: "none",
        keys: [
          { id: "p1", label: "Page 1", rootMidi: 48, page: 1, systems: null },
          { id: "p2", label: "Page 2", rootMidi: 48, page: 2, systems: null },
        ],
      },
      {
        id: "minor_scales",
        title: "Minor Scales",
        scriptId: "minor_scale",
        keys: minorKeys(3),
      },
      {
        id: "harmonic_minor_scales",
        title: "Harmonic Minor Scales",
        scriptId: "harmonic_minor_scale",
        keys: minorKeys(6),
      },
      {
        id: "melodic_minor_scales",
        title: "Melodic Minor Scales",
        scriptId: "melodic_minor_scale",
        keys: minorKeys(9),
      },
      {
        id: "melodic_minor_ascending",
        title: "Melodic Minor (Ascending)",
        scriptId: "melodic_minor_ascending",
        keys: minorKeys(12),
      },
      {
        id: "harmonic_major_scales",
        title: "Harmonic Major Scales",
        scriptId: "harmonic_major_scale",
        keys: majorKeys(15),
      },
      {
        id: "double_harmonic_major_scales",
        title: "Double Harmonic Major Scales",
        scriptId: "double_harmonic_major",
        keys: majorKeys(18),
      },
      {
        id: "minor_broken_thirds",
        title: "Minor Scales in Broken Thirds",
        scriptId: "minor_broken_3",
        keys: minorBrokenKeys(21),
      },
      {
        id: "minor_broken_fourths",
        title: "Minor Scales in Broken Fourths",
        scriptId: "minor_broken_4",
        keys: minorBrokenKeys(27),
      },
      {
        id: "minor_broken_fifths",
        title: "Minor Scales in Broken Fifths",
        scriptId: "minor_broken_5",
        keys: minorBrokenKeys(33),
      },
      {
        id: "minor_broken_sixths",
        title: "Minor Scales in Broken Sixths",
        scriptId: "minor_broken_6",
        keys: minorBrokenKeys(39),
      },
      {
        id: "minor_broken_sevenths",
        title: "Minor Scales in Broken Sevenths",
        scriptId: "minor_broken_7",
        keys: minorBrokenKeys(45),
      },
      {
        id: "minor_broken_octaves",
        title: "Minor Scales in Broken Octaves",
        scriptId: "minor_broken_8",
        keys: minorBrokenKeys(51),
      },
      {
        id: "minor_broken_ninths",
        title: "Minor Scales in Broken Ninths",
        scriptId: "minor_broken_9",
        keys: minorBrokenKeys(57),
      },
      {
        id: "minor_broken_tenths",
        title: "Minor Scales in Broken Tenths",
        scriptId: "minor_broken_10",
        keys: minorBrokenKeys(63),
      },
      {
        id: "diminished_seventh_arpeggios",
        title: "Diminished Seventh Arpeggios",
        scriptId: "diminished_seventh_arpeggios",
        // 3 pages, 4 keys each (1 system per key).
        // p69: G dim7 family  |  p70: Ab dim7 family  |  p71: A dim7 family
        keys: [
          { id: "g",  label: "G",  rootMidi: 43, page: 69, systems: [0, 0] },
          { id: "db", label: "Db", rootMidi: 49, page: 69, systems: [1, 1] },
          { id: "e",  label: "E",  rootMidi: 52, page: 69, systems: [2, 2] },
          { id: "bb", label: "Bb", rootMidi: 46, page: 69, systems: [3, 3] },
          { id: "ab", label: "Ab", rootMidi: 44, page: 70, systems: [0, 0] },
          { id: "d",  label: "D",  rootMidi: 50, page: 70, systems: [1, 1] },
          { id: "f",  label: "F",  rootMidi: 41, page: 70, systems: [2, 2] },
          { id: "b",  label: "B",  rootMidi: 47, page: 70, systems: [3, 3] },
          { id: "a",  label: "A",  rootMidi: 45, page: 71, systems: [0, 0] },
          { id: "eb", label: "Eb", rootMidi: 51, page: 71, systems: [1, 1] },
          { id: "gb", label: "Gb", rootMidi: 42, page: 71, systems: [2, 2] },
          { id: "c",  label: "C",  rootMidi: 48, page: 71, systems: [3, 3] },
        ],
      },
      {
        id: "augmented_arpeggios",
        title: "Augmented Arpeggios",
        scriptId: "augmented_arpeggios",
        // 2 pages, 4 keys each (1 system per key).
        // p72: Bb F A E  |  p73: Ab Eb G D
        keys: [
          { id: "bb", label: "Bb", rootMidi: 46, page: 72, systems: [0, 0] },
          { id: "f",  label: "F",  rootMidi: 41, page: 72, systems: [1, 1] },
          { id: "a",  label: "A",  rootMidi: 45, page: 72, systems: [2, 2] },
          { id: "e",  label: "E",  rootMidi: 52, page: 72, systems: [3, 3] },
          { id: "ab", label: "Ab", rootMidi: 44, page: 73, systems: [0, 0] },
          { id: "eb", label: "Eb", rootMidi: 51, page: 73, systems: [1, 1] },
          { id: "g",  label: "G",  rootMidi: 43, page: 73, systems: [2, 2] },
          { id: "d",  label: "D",  rootMidi: 50, page: 73, systems: [3, 3] },
        ],
      },
    ],
  },
  {
    id: "glissando_arpeggios",
    title: "Glissando Arpeggios",
    file: "/pdfs/glissando-arpeggios.pdf",
    totalPages: 34,
    sections: [
      {
        id: "intro",
        title: "Intro",
        scriptId: "none",
        keys: [
          { id: "p1", label: "Page 1", rootMidi: 48, page: 1, systems: null },
          { id: "p2", label: "Page 2", rootMidi: 48, page: 2, systems: null },
          { id: "p3", label: "Page 3", rootMidi: 48, page: 3, systems: null },
        ],
      },
      {
        // p4-7: 3 keys per page, COF major order: C G D | A E B | Gb Db Ab | Eb Bb F
        id: "maj7",
        title: "Major 7th Arpeggios",
        scriptId: "exercise",
        keys: gl12Keys(4, [
          { id: "c",  label: "C",  rootMidi: 48 },
          { id: "g",  label: "G",  rootMidi: 43 },
          { id: "d",  label: "D",  rootMidi: 50 },
          { id: "a",  label: "A",  rootMidi: 45 },
          { id: "e",  label: "E",  rootMidi: 52 },
          { id: "b",  label: "B",  rootMidi: 47 },
          { id: "gb", label: "Gb", rootMidi: 42 },
          { id: "db", label: "Db", rootMidi: 49 },
          { id: "ab", label: "Ab", rootMidi: 44 },
          { id: "eb", label: "Eb", rootMidi: 51 },
          { id: "bb", label: "Bb", rootMidi: 46 },
          { id: "f",  label: "F",  rootMidi: 41 },
        ]),
      },
      {
        // p8-11: minor COF order: A E B | F# C# G# | Eb Bb F | C G D
        id: "m7",
        title: "Minor 7th Arpeggios",
        scriptId: "exercise",
        keys: gl12Keys(8, [
          { id: "a",  label: "A",  rootMidi: 45 },
          { id: "e",  label: "E",  rootMidi: 52 },
          { id: "b",  label: "B",  rootMidi: 47 },
          { id: "fs", label: "F#", rootMidi: 42 },
          { id: "cs", label: "C#", rootMidi: 49 },
          { id: "gs", label: "G#", rootMidi: 44 },
          { id: "eb", label: "Eb", rootMidi: 51 },
          { id: "bb", label: "Bb", rootMidi: 46 },
          { id: "f",  label: "F",  rootMidi: 41 },
          { id: "c",  label: "C",  rootMidi: 48 },
          { id: "g",  label: "G",  rootMidi: 43 },
          { id: "d",  label: "D",  rootMidi: 50 },
        ]),
      },
      {
        // p12-15: starting G: G D A | E B F# | C# Ab Eb | Bb F C
        id: "dom7",
        title: "Dominant 7th Arpeggios",
        scriptId: "exercise",
        keys: gl12Keys(12, [
          { id: "g",  label: "G",  rootMidi: 43 },
          { id: "d",  label: "D",  rootMidi: 50 },
          { id: "a",  label: "A",  rootMidi: 45 },
          { id: "e",  label: "E",  rootMidi: 52 },
          { id: "b",  label: "B",  rootMidi: 47 },
          { id: "fs", label: "F#", rootMidi: 42 },
          { id: "cs", label: "C#", rootMidi: 49 },
          { id: "ab", label: "Ab", rootMidi: 44 },
          { id: "eb", label: "Eb", rootMidi: 51 },
          { id: "bb", label: "Bb", rootMidi: 46 },
          { id: "f",  label: "F",  rootMidi: 41 },
          { id: "c",  label: "C",  rootMidi: 48 },
        ]),
      },
      {
        // p16-19: starting B: B F# C# | G# Eb Bb | F C G | D A E
        id: "m7b5",
        title: "Minor 7\u266d5 Arpeggios",
        scriptId: "exercise",
        keys: gl12Keys(16, [
          { id: "b",  label: "B",  rootMidi: 47 },
          { id: "fs", label: "F#", rootMidi: 42 },
          { id: "cs", label: "C#", rootMidi: 49 },
          { id: "gs", label: "G#", rootMidi: 44 },
          { id: "eb", label: "Eb", rootMidi: 51 },
          { id: "bb", label: "Bb", rootMidi: 46 },
          { id: "f",  label: "F",  rootMidi: 41 },
          { id: "c",  label: "C",  rootMidi: 48 },
          { id: "g",  label: "G",  rootMidi: 43 },
          { id: "d",  label: "D",  rootMidi: 50 },
          { id: "a",  label: "A",  rootMidi: 45 },
          { id: "e",  label: "E",  rootMidi: 52 },
        ]),
      },
      {
        // p20-23: starting F: F C G | D A E | B F# C# | G# Eb Bb
        id: "mmaj7",
        title: "Minor-Major 7th Arpeggios",
        scriptId: "exercise",
        keys: gl12Keys(20, [
          { id: "f",  label: "F",  rootMidi: 41 },
          { id: "c",  label: "C",  rootMidi: 48 },
          { id: "g",  label: "G",  rootMidi: 43 },
          { id: "d",  label: "D",  rootMidi: 50 },
          { id: "a",  label: "A",  rootMidi: 45 },
          { id: "e",  label: "E",  rootMidi: 52 },
          { id: "b",  label: "B",  rootMidi: 47 },
          { id: "fs", label: "F#", rootMidi: 42 },
          { id: "cs", label: "C#", rootMidi: 49 },
          { id: "gs", label: "G#", rootMidi: 44 },
          { id: "eb", label: "Eb", rootMidi: 51 },
          { id: "bb", label: "Bb", rootMidi: 46 },
        ]),
      },
      {
        // p24: 3 fully-diminished families (each chord has 4 enharmonic roots)
        id: "dim7",
        title: "Diminished 7th Arpeggios",
        scriptId: "exercise",
        keys: [
          { id: "b_d_f_ab",   label: "B / D / F / Ab",   rootMidi: 47, page: 24, systems: null },
          { id: "c_eb_gb_a",  label: "C / Eb / Gb / A",  rootMidi: 48, page: 24, systems: null },
          { id: "cs_e_g_bb",  label: "C# / E / G / Bb",  rootMidi: 49, page: 24, systems: null },
        ],
      },
      {
        // p25-26: 6 tritone-equivalent pairs, 3 per page
        // p25: G/Db, D/Ab, A/Eb  |  p26: E/Bb, B/F, F#/C
        id: "dom7b5",
        title: "Dominant 7\u266d5 Arpeggios",
        scriptId: "exercise",
        keys: [
          { id: "g_db",  label: "G / Db",  rootMidi: 43, page: 25, systems: null },
          { id: "d_ab",  label: "D / Ab",  rootMidi: 50, page: 25, systems: null },
          { id: "a_eb",  label: "A / Eb",  rootMidi: 45, page: 25, systems: null },
          { id: "e_bb",  label: "E / Bb",  rootMidi: 52, page: 26, systems: null },
          { id: "b_f",   label: "B / F",   rootMidi: 47, page: 26, systems: null },
          { id: "fs_c",  label: "F# / C",  rootMidi: 42, page: 26, systems: null },
        ],
      },
      {
        // p27-30: starting G (same order as Dom7): G D A | E B F# | C# Ab Eb | Bb F C
        id: "dom7s5",
        title: "Dominant 7\u266f5 Arpeggios",
        scriptId: "exercise",
        keys: gl12Keys(27, [
          { id: "g",  label: "G",  rootMidi: 43 },
          { id: "d",  label: "D",  rootMidi: 50 },
          { id: "a",  label: "A",  rootMidi: 45 },
          { id: "e",  label: "E",  rootMidi: 52 },
          { id: "b",  label: "B",  rootMidi: 47 },
          { id: "fs", label: "F#", rootMidi: 42 },
          { id: "cs", label: "C#", rootMidi: 49 },
          { id: "ab", label: "Ab", rootMidi: 44 },
          { id: "eb", label: "Eb", rootMidi: 51 },
          { id: "bb", label: "Bb", rootMidi: 46 },
          { id: "f",  label: "F",  rootMidi: 41 },
          { id: "c",  label: "C",  rootMidi: 48 },
        ]),
      },
      {
        // p31-34: COF major order (same as Maj7): C G D | A E B | Gb Db Ab | Eb Bb F
        id: "maj7s5",
        title: "Major 7\u266f5 Arpeggios",
        scriptId: "exercise",
        keys: gl12Keys(31, [
          { id: "c",  label: "C",  rootMidi: 48 },
          { id: "g",  label: "G",  rootMidi: 43 },
          { id: "d",  label: "D",  rootMidi: 50 },
          { id: "a",  label: "A",  rootMidi: 45 },
          { id: "e",  label: "E",  rootMidi: 52 },
          { id: "b",  label: "B",  rootMidi: 47 },
          { id: "gb", label: "Gb", rootMidi: 42 },
          { id: "db", label: "Db", rootMidi: 49 },
          { id: "ab", label: "Ab", rootMidi: 44 },
          { id: "eb", label: "Eb", rootMidi: 51 },
          { id: "bb", label: "Bb", rootMidi: 46 },
          { id: "f",  label: "F",  rootMidi: 41 },
        ]),
      },
    ],
  },
  {
    id: "hopscotch_vol1",
    title: "Hopscotch, Vol. 1",
    file: "/pdfs/hopscotch-vol1.pdf",
    totalPages: 387,
    sections: [
      {
        id: "intro",
        title: "Intro",
        scriptId: "none",
        keys: [
          { id: "p1", label: "Page 1", rootMidi: 48, page: 1, systems: null },
          { id: "p2", label: "Page 2", rootMidi: 48, page: 2, systems: null },
          { id: "p3", label: "Page 3", rootMidi: 48, page: 3, systems: null },
        ],
      },
      {
        // C major: p4-35 (32 pages: 8 intervals × 4 mode-pair pages)
        id: "c_major",
        title: "C Major",
        scriptId: "exercise",
        keys: hopscotchKeys(4, 48),
      },
      {
        // G major: p36-67
        id: "g_major",
        title: "G Major",
        scriptId: "exercise",
        keys: hopscotchKeys(36, 43),
      },
      {
        // D major: p68-99
        id: "d_major",
        title: "D Major",
        scriptId: "exercise",
        keys: hopscotchKeys(68, 50),
      },
      {
        // A major: p100-131
        id: "a_major",
        title: "A Major",
        scriptId: "exercise",
        keys: hopscotchKeys(100, 45),
      },
      {
        // E major: p132-163
        id: "e_major",
        title: "E Major",
        scriptId: "exercise",
        keys: hopscotchKeys(132, 52),
      },
      {
        // B major: p164-195
        id: "b_major",
        title: "B Major",
        scriptId: "exercise",
        keys: hopscotchKeys(164, 47),
      },
      {
        // F# major: p196-227
        id: "fs_major",
        title: "F\u266f Major",
        scriptId: "exercise",
        keys: hopscotchKeys(196, 42),
      },
      {
        // Db major: p228-259
        id: "db_major",
        title: "D\u266d Major",
        scriptId: "exercise",
        keys: hopscotchKeys(228, 49),
      },
      {
        // Ab major: p260-291
        id: "ab_major",
        title: "A\u266d Major",
        scriptId: "exercise",
        keys: hopscotchKeys(260, 44),
      },
      {
        // Eb major: p292-323
        id: "eb_major",
        title: "E\u266d Major",
        scriptId: "exercise",
        keys: hopscotchKeys(292, 51),
      },
      {
        // Bb major: p324-355
        id: "bb_major",
        title: "B\u266d Major",
        scriptId: "exercise",
        keys: hopscotchKeys(324, 46),
      },
      {
        // F major: p356-387
        id: "f_major",
        title: "F Major",
        scriptId: "exercise",
        keys: hopscotchKeys(356, 41),
      },
    ],
  },
  {
    id: "hopscotch_vol2",
    title: "Hopscotch, Vol. 2",
    file: "/pdfs/hopscotch-vol2.pdf",
    totalPages: 387,
    sections: [
      {
        id: "intro",
        title: "Intro",
        scriptId: "none",
        keys: [
          { id: "p1", label: "Page 1", rootMidi: 48, page: 1, systems: null },
          { id: "p2", label: "Page 2", rootMidi: 48, page: 2, systems: null },
          { id: "p3", label: "Page 3", rootMidi: 48, page: 3, systems: null },
        ],
      },
      // Minor COF order: A E B F# C# G# D# Bb F C G D
      { id: "a_hm",  title: "A Harmonic Minor",               scriptId: "exercise", keys: hopscotchHMKeys(4,   45) },
      { id: "e_hm",  title: "E Harmonic Minor",               scriptId: "exercise", keys: hopscotchHMKeys(36,  52) },
      { id: "b_hm",  title: "B Harmonic Minor",               scriptId: "exercise", keys: hopscotchHMKeys(68,  47) },
      { id: "fs_hm", title: "F\u266f Harmonic Minor",         scriptId: "exercise", keys: hopscotchHMKeys(100, 42) },
      { id: "cs_hm", title: "C\u266f Harmonic Minor",         scriptId: "exercise", keys: hopscotchHMKeys(132, 49) },
      { id: "gs_hm", title: "G\u266f Harmonic Minor",         scriptId: "exercise", keys: hopscotchHMKeys(164, 44) },
      { id: "ds_hm", title: "D\u266f Harmonic Minor",         scriptId: "exercise", keys: hopscotchHMKeys(196, 51) },
      { id: "bb_hm", title: "B\u266d Harmonic Minor",         scriptId: "exercise", keys: hopscotchHMKeys(228, 46) },
      { id: "f_hm",  title: "F Harmonic Minor",               scriptId: "exercise", keys: hopscotchHMKeys(260, 41) },
      { id: "c_hm",  title: "C Harmonic Minor",               scriptId: "exercise", keys: hopscotchHMKeys(292, 48) },
      { id: "g_hm",  title: "G Harmonic Minor",               scriptId: "exercise", keys: hopscotchHMKeys(324, 43) },
      { id: "d_hm",  title: "D Harmonic Minor",               scriptId: "exercise", keys: hopscotchHMKeys(356, 50) },
    ],
  },
  {
    id: "uncaged_part1",
    title: "The UnCAGED System, Part 1",
    file: "/pdfs/uncaged-part1.pdf",
    totalPages: 85,
    sections: [
      {
        id: "intro",
        title: "Intro",
        scriptId: "none",
        keys: [
          { id: "p1", label: "Page 1", rootMidi: 48, page: 1, systems: null },
          { id: "p2", label: "Page 2", rootMidi: 48, page: 2, systems: null },
          { id: "p3", label: "Page 3", rootMidi: 48, page: 3, systems: null },
          { id: "p4", label: "Page 4", rootMidi: 48, page: 4, systems: null },
          { id: "p5", label: "Page 5", rootMidi: 48, page: 5, systems: null },
        ],
      },
      {
        // p6-29: 12 COF keys × 2 voicing pages = 24 pages
        id: "major_triads",
        title: "Major Triads",
        scriptId: "exercise",
        keys: triadKeys(6),
      },
      {
        // p30-53: 12 COF keys × 2 voicing pages = 24 pages
        id: "minor_triads",
        title: "Minor Triads",
        scriptId: "exercise",
        keys: triadKeys(30),
      },
      {
        // p54-77: 12 COF keys × 2 voicing pages = 24 pages
        id: "diminished_triads",
        title: "Diminished Triads",
        scriptId: "exercise",
        keys: triadKeys(54),
      },
      {
        // p78-85: 4 augmented families (symmetric chord) × 2 voicing pages = 8 pages
        id: "augmented_triads",
        title: "Augmented Triads",
        scriptId: "exercise",
        keys: [
          { id: "c_e_gs_closed",  label: "C / E / G\u266f \u2014 Closed",      rootMidi: 48, page: 78, systems: null },
          { id: "c_e_gs_drop2",   label: "C / E / G\u266f \u2014 Drop 2",      rootMidi: 48, page: 79, systems: null },
          { id: "cs_f_a_closed",  label: "C\u266f / F / A \u2014 Closed",      rootMidi: 49, page: 80, systems: null },
          { id: "cs_f_a_drop2",   label: "C\u266f / F / A \u2014 Drop 2",      rootMidi: 49, page: 81, systems: null },
          { id: "d_fs_bb_closed", label: "D / F\u266f / B\u266d \u2014 Closed", rootMidi: 50, page: 82, systems: null },
          { id: "d_fs_bb_drop2",  label: "D / F\u266f / B\u266d \u2014 Drop 2", rootMidi: 50, page: 83, systems: null },
          { id: "eb_g_b_closed",  label: "E\u266d / G / B \u2014 Closed",      rootMidi: 51, page: 84, systems: null },
          { id: "eb_g_b_drop2",   label: "E\u266d / G / B \u2014 Drop 2",      rootMidi: 51, page: 85, systems: null },
        ],
      },
    ],
  },
  {
    id: "uncaged_part2",
    title: "The UnCAGED System, Part 2",
    file: "/pdfs/uncaged-part2.pdf",
    totalPages: 225,
    sections: [
      {
        id: "intro",
        title: "Intro",
        scriptId: "none",
        keys: [
          { id: "p1", label: "Page 1", rootMidi: 48, page: 1, systems: null },
          { id: "p2", label: "Page 2", rootMidi: 48, page: 2, systems: null },
          { id: "p3", label: "Page 3", rootMidi: 48, page: 3, systems: null },
          { id: "p4", label: "Page 4", rootMidi: 48, page: 4, systems: null },
          { id: "p5", label: "Page 5", rootMidi: 48, page: 5, systems: null },
          { id: "p6", label: "Page 6", rootMidi: 48, page: 6, systems: null },
          { id: "p7", label: "Page 7", rootMidi: 48, page: 7, systems: null },
          { id: "p8", label: "Page 8", rootMidi: 48, page: 8, systems: null },
          { id: "p9", label: "Page 9", rootMidi: 48, page: 9, systems: null },
        ],
      },
      // Major COF order: C G D A E B F# Db Ab Eb Bb F
      { id: "c_major",  title: "C Major",          scriptId: "exercise", keys: uncagedPart2Keys(10,  48) },
      { id: "g_major",  title: "G Major",          scriptId: "exercise", keys: uncagedPart2Keys(28,  43) },
      { id: "d_major",  title: "D Major",          scriptId: "exercise", keys: uncagedPart2Keys(46,  50) },
      { id: "a_major",  title: "A Major",          scriptId: "exercise", keys: uncagedPart2Keys(64,  45) },
      { id: "e_major",  title: "E Major",          scriptId: "exercise", keys: uncagedPart2Keys(82,  52) },
      { id: "b_major",  title: "B Major",          scriptId: "exercise", keys: uncagedPart2Keys(100, 47) },
      { id: "fs_major", title: "F\u266f Major",    scriptId: "exercise", keys: uncagedPart2Keys(118, 42) },
      { id: "db_major", title: "D\u266d Major",    scriptId: "exercise", keys: uncagedPart2Keys(136, 49) },
      { id: "ab_major", title: "A\u266d Major",    scriptId: "exercise", keys: uncagedPart2Keys(154, 44) },
      { id: "eb_major", title: "E\u266d Major",    scriptId: "exercise", keys: uncagedPart2Keys(172, 51) },
      { id: "bb_major", title: "B\u266d Major",    scriptId: "exercise", keys: uncagedPart2Keys(190, 46) },
      { id: "f_major",  title: "F Major",          scriptId: "exercise", keys: uncagedPart2Keys(208, 41) },
    ],
  },
];

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

// Seeded LCG random number generator (same seed → same sequence every time).
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// Return `count` practice keys chosen at random, seeded by date ISO string.
// Same date always yields the same set; excludes intro/non-playable sections.
export function getDailyPracticeKeys(dateISO: string, count = 15): PracticeKey[] {
  const allKeys = PDF_BOOKS.flatMap((book) => practiceKeysForBook(book));
  const rng = seededRng(hashStringToInt(dateISO));
  const pool = [...allKeys];
  const limit = Math.min(count, pool.length);
  // Partial Fisher-Yates: only need the first `limit` swaps
  for (let i = 0; i < limit; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, limit);
}

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
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to derive date in timezone");
  }

  return `${year}-${month}-${day}`;
}

export function findBook(bookId: PdfBookId): PdfBook {
  return PDF_BOOKS.find((book) => book.id === bookId) ?? PDF_BOOKS[0];
}

export function findSection(book: PdfBook, sectionId: string): PdfSection {
  return book.sections.find((s) => s.id === sectionId) ?? book.sections[0];
}

export function findKey(section: PdfSection, keyId: string): PdfKeyEntry {
  return section.keys.find((k) => k.id === keyId) ?? section.keys[0];
}

/** All PracticeKey entries for a book (including intro). */
export function keysForBook(book: PdfBook): PracticeKey[] {
  return book.sections.flatMap((section) =>
    section.keys.map((key) => ({
      bookId: book.id,
      sectionId: section.id,
      sectionTitle: section.title,
      scriptId: section.scriptId,
      keyId: key.id,
      label: key.label,
      rootMidi: key.rootMidi,
      page: key.page,
      systems: key.systems,
    })),
  );
}

/** PracticeKey entries excluding intro/non-playable sections. */
export function practiceKeysForBook(book: PdfBook): PracticeKey[] {
  return keysForBook(book).filter((k) => k.scriptId !== "none");
}

export function getTodaysPracticeKey(dateISO: string): PracticeKey {
  const allKeys = PDF_BOOKS.flatMap((book) => practiceKeysForBook(book));
  const hash = hashStringToInt(dateISO);
  return allKeys[hash % allKeys.length];
}

/** Find the section that owns a given page number. */
export function sectionForPage(book: PdfBook, page: number): PdfSection {
  return (
    book.sections.find((section) => section.keys.some((k) => k.page === page)) ??
    book.sections[0]
  );
}
