import { useState } from "react";
import { Button, Fader, Knob, LED, Panel, Toggle, Help } from "@/ui";
import { useTonic } from "@/state/store";
import {
  addTrack,
  removeTrack,
  renameTrack,
  setTempo,
  setTrackVolume,
  setTrackPan,
  setTrackMute,
  setTrackSolo,
  setMasterVolume,
  play,
  stop,
} from "@/state/actions";
import { audioEngine } from "@/audio/engine";
import { ClipBlock } from "./ClipBlock";
import { SampleBrowser } from "./SampleBrowser";
import "./shell.css";

const dbFmt = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)} dB`;
const panFmt = (v: number) =>
  Math.abs(v) < 0.02 ? "C" : v < 0 ? `L${Math.round(-v * 100)}` : `R${Math.round(v * 100)}`;

/** Timeline horizontal scale: pixels per second. */
const PX_PER_SEC = 16;

type SidePanel = "samples" | null;

/**
 * The app shell, bound to the Zustand store via `useTonic` selectors. Every control
 * mutates through `actions.ts` — the exact same path the MCP bridge uses — so a UI
 * fader and an MCP `set_track_volume` command change one shared state.
 */
export function AppShell() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [sidePanel, setSidePanel] = useState<SidePanel>("samples");

  // Store-bound state (single source of truth).
  const tempo = useTonic((s) => s.project.tempo);
  const playing = useTonic((s) => s.project.transport.state === "playing");
  const tracks = useTonic((s) => s.project.tracks);
  const samples = useTonic((s) => s.project.samples);
  const masterVolume = useTonic((s) => s.project.masterVolumeDb);

  const togglePanel = (p: SidePanel) => setSidePanel((cur) => (cur === p ? null : p));

  const promptRename = (id: string, current: string) => {
    const name = window.prompt("Track name", current);
    if (name && name.trim()) renameTrack(id, name.trim());
  };

  const setThemeMode = (dark: boolean) => {
    const next = dark ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const togglePlay = async () => {
    // Unlock the AudioContext on this user gesture before starting the transport.
    await audioEngine.ensureStarted();
    if (playing) stop();
    else play();
  };

  return (
    <div className="tn-app">
      {/* ---- transport ---- */}
      <header className="tn-transport">
        <div className="tn-brand">
          <span className="tn-brand__logo">Tonic</span>
          <span className="tn-brand__tag">make music, simply</span>
        </div>

        <div className="tn-transport__group">
          <Button variant={playing ? "neutral" : "primary"} onClick={togglePlay}>
            {playing ? "■ Stop" : "▶ Play"}
          </Button>
          <LED state={playing ? "blink" : "off"} title="Transport" />
        </div>

        <div className="tn-transport__group">
          <Knob
            value={tempo}
            min={40}
            max={240}
            onChange={(v) => setTempo(Math.round(v))}
            label="Tempo"
            format={(v) => `${Math.round(v)} BPM`}
          />
          <Help title="Tempo">
            Tempo is the speed of your song, measured in beats per minute (BPM). Higher = faster.
            Turn the knob (or drag up/down) to change it.
          </Help>
        </div>

        <div className="tn-transport__spacer" />

        <div className="tn-transport__group">
          <span className="t-label">Theme</span>
          <Toggle checked={theme === "dark"} onChange={setThemeMode} label={theme} />
        </div>
      </header>

      {/* ---- rail + arrangement ---- */}
      <div className="tn-body">
        <nav className="tn-rail" aria-label="Tools">
          <button className="tn-rail__btn" title="Tracks">♪</button>
          <button className="tn-rail__btn" title="Piano roll">⌨</button>
          <button
            className={`tn-rail__btn${sidePanel === "samples" ? " is-active" : ""}`}
            title="Samples"
            onClick={() => togglePanel("samples")}
          >
            📁
          </button>
          <button className="tn-rail__btn" title="Record">●</button>
          <button className="tn-rail__btn" title="Effects">∿</button>
        </nav>

        {sidePanel === "samples" && (
          <aside className="tn-sidebar" aria-label="Samples">
            <SampleBrowser />
          </aside>
        )}

        <main className="tn-arrange">
          <Panel
            title="Arrangement"
            texture="dots"
            actions={
              <Help title="Tracks &amp; the timeline">
                Each row is a track — one instrument or recording. The colored bar is the audio on
                that track over time. Use the mixer below to balance their volumes.
              </Help>
            }
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {tracks.length === 0 && (
                <p className="t-label" style={{ padding: "var(--space-3)" }}>
                  No tracks yet. Click “+ Add track” to start.
                </p>
              )}
              {tracks.map((t) => (
                <div className="tn-lane" key={t.id}>
                  <div className="tn-lane__head" style={{ ["--track-color" as string]: t.color }}>
                    <LED
                      state={t.soloed ? "blink" : t.muted ? "warn" : "on"}
                      title={t.soloed ? "Soloed" : t.muted ? "Muted" : "Active"}
                    />
                    <span
                      className="tn-lane__name"
                      title="Double-click to rename"
                      onDoubleClick={() => promptRename(t.id, t.name)}
                    >
                      {t.name}
                    </span>
                    <button
                      className="tn-lane__remove"
                      title="Remove track"
                      onClick={() => removeTrack(t.id)}
                    >
                      ×
                    </button>
                  </div>
                  <div className="tn-lane__strip">
                    {t.clips.length === 0 && !t.muted && (
                      <div className="tn-lane__wave" style={{ ["--track-color" as string]: t.color }} />
                    )}
                    {t.clips.map((c) => (
                      <ClipBlock
                        key={c.id}
                        trackId={t.id}
                        clip={c}
                        label={c.audio ? samples[c.audio.sampleId]?.name ?? "clip" : "clip"}
                        color={t.color}
                        pxPerSec={PX_PER_SEC}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ paddingTop: "var(--space-2)" }}>
                <Button variant="ghost" onClick={() => addTrack()}>
                  + Add track
                </Button>
              </div>
            </div>
          </Panel>
        </main>
      </div>

      {/* ---- mixer ---- */}
      <section className="tn-mixer" aria-label="Mixer">
        <div className="tn-strip">
          <div className="tn-strip__name">
            Master
            <Help title="Master volume">
              The master fader sets the overall loudness of everything combined. Pull it down if the
              sound is distorting (clipping).
            </Help>
          </div>
          <div className="tn-strip__pan-placeholder" />
          <Fader value={masterVolume} onChange={setMasterVolume} format={dbFmt} />
          <LED state="on" title="Master" />
        </div>

        {tracks.map((t) => (
          <div className="tn-strip" key={t.id}>
            <div
              className="tn-strip__name"
              style={{ color: t.color }}
              title="Double-click to rename"
              onDoubleClick={() => promptRename(t.id, t.name)}
            >
              {t.name}
            </div>
            <Knob
              value={t.pan}
              min={-1}
              max={1}
              onChange={(v) => setTrackPan(t.id, v)}
              label="Pan"
              format={panFmt}
              size={44}
            />
            <Fader value={t.volumeDb} onChange={(v) => setTrackVolume(t.id, v)} format={dbFmt} />
            <div className="tn-strip__row">
              <Toggle checked={t.muted} onChange={(v) => setTrackMute(t.id, v)} label="M" />
              <Toggle checked={t.soloed} onChange={(v) => setTrackSolo(t.id, v)} label="S" />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
