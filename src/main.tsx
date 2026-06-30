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

// Boot the single-source-of-truth spine: the audio engine reconciles the store,
// and the WS bridge lets the MCP server drive the same store the UI does.
audioEngine.init();
bridgeClient.connect();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
