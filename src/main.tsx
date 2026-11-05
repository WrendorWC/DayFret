import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { LabelModeProvider } from "./hooks/useLabelMode";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LabelModeProvider>
      <App />
    </LabelModeProvider>
  </React.StrictMode>,
);
