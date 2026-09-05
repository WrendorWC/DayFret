import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Builds ONLY the standalone chords app (chords.html) into dist-chords/.
// publicDir is disabled so nothing from public/ — including the copyrighted
// practice PDFs — is ever copied into this build.
export default defineConfig({
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: "dist-chords",
    emptyOutDir: true,
    rollupOptions: {
      input: "chords.html",
    },
  },
});
