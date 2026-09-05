import { PositionPattern } from "../types";

type PositionSelectorProps = {
  positions: PositionPattern[];
  selectedPositionId: string;
  onSelect: (positionId: string) => void;
};

export function PositionSelector({ positions, selectedPositionId, onSelect }: PositionSelectorProps): JSX.Element {
  return (
    <section className="card">
      <div className="section-heading">Positions</div>
      <div className="chip-row">
        {positions.map((position) => {
          const active = position.positionId === selectedPositionId;
          return (
            <button
              key={position.positionId}
              type="button"
              className={`chip ${active ? "active" : ""}`}
              onClick={() => onSelect(position.positionId)}
              aria-pressed={active}
            >
              {position.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
