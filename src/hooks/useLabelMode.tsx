import { createContext, ReactNode, useContext, useEffect, useState } from "react";

export type LabelMode = "intervals" | "notes";

// One setting for every diagram in the app: whether the dots read as intervals
// (R, b3, 5 …) or note names. It used to be a separate toggle per page, so
// switching to note names on the scale and then opening a chord put you back
// on intervals. Remembered between visits.
const STORAGE_KEY = "dayfret.labelMode";

function readStored(): LabelMode {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "notes" ? "notes" : "intervals";
  } catch {
    return "intervals";
  }
}

const LabelModeContext = createContext<[LabelMode, (m: LabelMode) => void]>(["intervals", () => {}]);

export function LabelModeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [mode, setMode] = useState<LabelMode>(readStored);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Storage can be unavailable (private window, some file:// setups); the
      // setting then just lasts for the session.
    }
  }, [mode]);

  return <LabelModeContext.Provider value={[mode, setMode]}>{children}</LabelModeContext.Provider>;
}

export function useLabelMode(): LabelMode {
  return useContext(LabelModeContext)[0];
}

export function LabelToggle({ caption = "Labels:" }: { caption?: string }): JSX.Element {
  const [mode, setMode] = useContext(LabelModeContext);
  return (
    <>
      <span className="label-toggle-caption">{caption}</span>
      <div className="segmented">
        <button
          type="button"
          className={`segment${mode === "intervals" ? " active" : ""}`}
          onClick={() => setMode("intervals")}
        >
          Intervals
        </button>
        <button
          type="button"
          className={`segment${mode === "notes" ? " active" : ""}`}
          onClick={() => setMode("notes")}
        >
          Notes
        </button>
      </div>
    </>
  );
}
