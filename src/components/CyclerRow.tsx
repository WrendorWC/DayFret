type CyclerRowProps = {
  caption: string; // text shown between the arrows
  ariaLabel: string; // what is being cycled, for screen readers
  count: number; // number of options; < 2 disables the arrows
  onStep: (delta: number) => void;
};

// Compact "‹ caption ›" stepper used under each chord diagram.
export function CyclerRow({ caption, ariaLabel, count, onStep }: CyclerRowProps): JSX.Element {
  return (
    <div className="cycler-row">
      <button
        type="button"
        className="cycler-button"
        onClick={() => onStep(-1)}
        disabled={count < 2}
        aria-label={`Previous ${ariaLabel}`}
      >
        ‹
      </button>
      <span className="cycler-caption">{caption}</span>
      <button
        type="button"
        className="cycler-button"
        onClick={() => onStep(1)}
        disabled={count < 2}
        aria-label={`Next ${ariaLabel}`}
      >
        ›
      </button>
    </div>
  );
}
