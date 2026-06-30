import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import "@/ui/tokens.css";
import "@/ui/ui.css";
import App from "@/App";
import { audioEngine } from "@/audio/engine";
import { bridgeClient } from "@/bridge/wsClient";
import { initPersistence } from "@/persistence/db";
import { tonicStore } from "@/state/store";

// Boot the single-source-of-truth spine: the audio engine reconciles the store,
// and the WS bridge lets the MCP server drive the same store the UI does.
audioEngine.init();
bridgeClient.connect();
// Hydrate the last saved project (async) and start autosaving.
void initPersistence();

// Dev-only debug handle for manual/automated verification in the browser console.
if (import.meta.env.DEV) {
  void Promise.all([
    import("@/state/actions"),
    import("@/audio/samples"),
    import("@/audio/recorder"),
  ]).then(([actions, samples, recorder]) => {
    (window as unknown as Record<string, unknown>).__tonic = {
      engine: audioEngine,
      store: tonicStore,
      actions,
      importSampleFile: samples.importSampleFile,
      recorder,
    };
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
