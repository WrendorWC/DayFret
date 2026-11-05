import React from "react";
import ReactDOM from "react-dom/client";
import ChordsApp from "./ChordsApp";
import { LabelModeProvider } from "../hooks/useLabelMode";
import "../index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LabelModeProvider>
      <ChordsApp />
    </LabelModeProvider>
  </React.StrictMode>,
);
