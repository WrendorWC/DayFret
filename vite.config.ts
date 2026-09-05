import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  preview: {
    host: "127.0.0.1",
    port: 5192,
    strictPort: true,
    headers: {
      // Force the browser to revalidate index.html on every load.
      // JS/CSS are content-hashed so they can stay cached; only HTML needs
      // to stay fresh so Safari's standalone app always picks up new bundles.
      "Cache-Control": "no-cache",
    },
  },
});
