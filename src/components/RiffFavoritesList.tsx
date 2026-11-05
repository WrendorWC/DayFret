import { useEffect, useState } from "react";
import { RIFF_COMPLEXITY, RIFF_FEELS } from "../music/riffs";
import { SCALE_KEYS, SCALES } from "../music/scales";
import { prettyNote } from "../music/chordFinder";
import { SavedRiff } from "../hooks/useRiffFavorites";

// Favourites in two tiers, by whatever is most useful to look things up by
// today. Each grouping picks a sensible second tier, and every riff's line
// shows only what its headings don't already say.
type GroupBy = "feel" | "key" | "level" | "date";

const GROUPINGS: Array<{ id: GroupBy; label: string }> = [
  { id: "feel", label: "Feel" },
  { id: "key", label: "Key" },
  { id: "level", label: "Difficulty" },
  { id: "date", label: "Date saved" },
];

const STORAGE_KEY = "dayfret.riffFavoritesGroupBy";

type Field = "feel" | "key" | "level" | "position" | "date";

// A heading: what it says, and a sort key so groups come out in a musical
// order (Rock before Blues, C before D♭, Simple before Brutal), not
// alphabetically
type Tier = { label: string; order: string };

const feelTier = (f: SavedRiff): Tier => {
  const i = RIFF_FEELS.findIndex((x) => x.id === f.feelId);
  return { label: RIFF_FEELS[i]?.name ?? f.feelId, order: String(i).padStart(2, "0") };
};
const keyTier = (f: SavedRiff): Tier => {
  const pc = SCALE_KEYS.find((k) => k.label === f.keyLabel)?.pitchClass ?? 0;
  const scale = SCALES.find((s) => s.id === f.scaleId);
  return {
    label: `${prettyNote(f.keyLabel)} ${scale?.name ?? f.scaleId}`,
    order: `${String(pc).padStart(2, "0")} ${scale?.name ?? ""}`,
  };
};
const levelTier = (f: SavedRiff): Tier => ({
  label: RIFF_COMPLEXITY.find((c) => c.level === f.complexity)?.name ?? "",
  order: String(f.complexity),
});
const monthTier = (f: SavedRiff): Tier => {
  const d = new Date(f.savedAt);
  return {
    label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    // Newest month first
    order: String(99999999 - (d.getFullYear() * 100 + d.getMonth())),
  };
};

const PLAN: Record<GroupBy, { first: (f: SavedRiff) => Tier; second?: (f: SavedRiff) => Tier; shown: Field[] }> = {
  feel: { first: feelTier, second: keyTier, shown: ["position", "level", "date"] },
  key: { first: keyTier, second: feelTier, shown: ["position", "level", "date"] },
  level: { first: levelTier, second: feelTier, shown: ["key", "position", "date"] },
  date: { first: monthTier, shown: ["feel", "key", "position", "level", "date"] },
};

// "position 3", or "positions 3–5" for a riff that travels
export function positionLabel(start: number, span: number, count = 5): string {
  if (span <= 1) return `position ${start}`;
  const end = ((start - 1 + span - 1) % count) + 1;
  return `positions ${start}–${end}`;
}

function describe(f: SavedRiff, fields: Field[]): JSX.Element {
  const parts: Array<JSX.Element | string> = [];
  for (const field of fields) {
    if (field === "feel") parts.push(<strong key="feel">{feelTier(f).label}</strong>);
    if (field === "key") parts.push(`in ${keyTier(f).label}`);
    if (field === "position") parts.push(positionLabel(f.boxNumber, f.span ?? 1));
    if (field === "level") parts.push(levelTier(f).label);
  }
  const when = new Date(f.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && (fields[i] === "key" && fields[i - 1] === "feel" ? " " : " · ")}
          {p}
        </span>
      ))}
      {fields.includes("date") && <span className="riff-favorite-date">saved {when}</span>}
    </>
  );
}

type Group = { tier: Tier; items: SavedRiff[] };

function groupBy(list: SavedRiff[], tier: (f: SavedRiff) => Tier): Group[] {
  const map = new Map<string, Group>();
  for (const f of list) {
    const t = tier(f);
    if (!map.has(t.label)) map.set(t.label, { tier: t, items: [] });
    map.get(t.label)!.items.push(f);
  }
  return [...map.values()].sort((a, b) => a.tier.order.localeCompare(b.tier.order));
}

export function RiffFavoritesList({
  favorites,
  activeId,
  onOpen,
  onRemove,
}: {
  favorites: SavedRiff[];
  activeId: string | null;
  onOpen: (f: SavedRiff) => void;
  onRemove: (f: SavedRiff) => void;
}): JSX.Element | null {
  const [by, setBy] = useState<GroupBy>(() => {
    try {
      const v = window.localStorage.getItem(STORAGE_KEY);
      return GROUPINGS.some((g) => g.id === v) ? (v as GroupBy) : "feel";
    } catch {
      return "feel";
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, by);
    } catch {
      // the choice then lasts for the session
    }
  }, [by]);

  if (favorites.length === 0) return null;

  const plan = PLAN[by];
  const newestFirst = [...favorites].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  const groups = groupBy(newestFirst, plan.first);
  // A short list opens everything; a long one opens only the group holding
  // the riff on screen, or the first, so it stays scannable
  const openAll = favorites.length <= 8;

  const row = (f: SavedRiff) => (
    <li key={f.id} className={`riff-favorite${activeId === f.id ? " active" : ""}`}>
      <button type="button" className="riff-favorite-open" onClick={() => onOpen(f)}>
        {describe(f, plan.shown)}
      </button>
      <button
        type="button"
        className="riff-favorite-remove"
        onClick={() => onRemove(f)}
        aria-label="Remove from favorites"
        title="Remove from favorites"
      >
        ×
      </button>
    </li>
  );

  return (
    <div className="riff-favorites">
      <div className="label-toggle-row finder-row">
        <span className="label-toggle-caption">Favorite riffs ({favorites.length})</span>
        <span className="label-toggle-caption riff-favorites-by">Group by:</span>
        <div className="segmented">
          {GROUPINGS.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`segment${by === g.id ? " active" : ""}`}
              onClick={() => setBy(g.id)}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {groups.map((g, gi) => {
        const holdsActive = g.items.some((f) => f.id === activeId);
        return (
          // Keyed by grouping too, so switching grouping resets which are open
          <details
            key={`${by}:${g.tier.label}`}
            className="riff-favorite-group"
            open={openAll || holdsActive || (activeId === null && gi === 0)}
          >
            <summary>
              {g.tier.label} <span className="riff-favorite-count">{g.items.length}</span>
            </summary>
            {plan.second ? (
              groupBy(g.items, plan.second).map((sub) => (
                <div key={sub.tier.label} className="riff-favorite-subgroup">
                  <div className="riff-favorite-subhead">
                    {sub.tier.label} <span className="riff-favorite-count">{sub.items.length}</span>
                  </div>
                  <ul className="riff-favorite-list">{sub.items.map(row)}</ul>
                </div>
              ))
            ) : (
              <ul className="riff-favorite-list">{g.items.map(row)}</ul>
            )}
          </details>
        );
      })}
    </div>
  );
}
