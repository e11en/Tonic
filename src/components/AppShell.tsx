import { useState } from "react";
import { Button, Fader, Knob, LED, Panel, Toggle, Help } from "@/ui";
import "./shell.css";

interface DemoTrack {
  id: string;
  name: string;
  color: string;
  volumeDb: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
}

const INITIAL_TRACKS: DemoTrack[] = [
  { id: "t1", name: "Drums", color: "var(--track-1)", volumeDb: -6, pan: 0, muted: false, soloed: false },
  { id: "t2", name: "Bass", color: "var(--track-2)", volumeDb: -8, pan: -0.2, muted: false, soloed: false },
  { id: "t3", name: "Synth", color: "var(--track-3)", volumeDb: -10, pan: 0.3, muted: false, soloed: false },
  { id: "t4", name: "Vocals", color: "var(--track-4)", volumeDb: -4, pan: 0, muted: true, soloed: false },
];

const dbFmt = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)} dB`;
const panFmt = (v: number) => (Math.abs(v) < 0.02 ? "C" : v < 0 ? `L${Math.round(-v * 100)}` : `R${Math.round(v * 100)}`);

/**
 * Phase 0 static showcase. Controls are wired to local state so the design
 * system is visibly interactive. In Phase 1 these bind to the Zustand store
 * via the shared action layer (used by both the UI and the MCP bridge).
 */
export function AppShell() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [playing, setPlaying] = useState(false);
  const [tempo, setTempo] = useState(120);
  const [master, setMaster] = useState(0);
  const [tracks, setTracks] = useState(INITIAL_TRACKS);

  const setTheme2 = (dark: boolean) => {
    const next = dark ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const patch = (id: string, p: Partial<DemoTrack>) =>
    setTracks((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));

  return (
    <div className="tn-app">
      {/* ---- transport ---- */}
      <header className="tn-transport">
        <div className="tn-brand">
          <span className="tn-brand__logo">Tonic</span>
          <span className="tn-brand__tag">make music, simply</span>
        </div>

        <div className="tn-transport__group">
          <Button variant={playing ? "neutral" : "primary"} onClick={() => setPlaying((p) => !p)}>
            {playing ? "■ Stop" : "▶ Play"}
          </Button>
          <LED state={playing ? "blink" : "off"} title="Transport" />
        </div>

        <div className="tn-transport__group">
          <Knob value={tempo} min={40} max={240} onChange={(v) => setTempo(Math.round(v))} label="Tempo" format={(v) => `${Math.round(v)} BPM`} />
          <Help title="Tempo">
            Tempo is the speed of your song, measured in beats per minute (BPM). Higher = faster.
            Turn the knob (or drag up/down) to change it.
          </Help>
        </div>

        <div className="tn-transport__spacer" />

        <div className="tn-transport__group">
          <span className="t-label">Theme</span>
          <Toggle checked={theme === "dark"} onChange={setTheme2} label={theme} />
        </div>
      </header>

      {/* ---- rail + arrangement ---- */}
      <div className="tn-body">
        <nav className="tn-rail" aria-label="Tools">
          <button className="tn-rail__btn" title="Tracks">♪</button>
          <button className="tn-rail__btn" title="Piano roll">⌨</button>
          <button className="tn-rail__btn" title="Samples">📁</button>
          <button className="tn-rail__btn" title="Record">●</button>
          <button className="tn-rail__btn" title="Effects">∿</button>
        </nav>

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
              {tracks.map((t) => (
                <div className="tn-lane" key={t.id}>
                  <div className="tn-lane__head" style={{ ["--track-color" as string]: t.color }}>
                    <LED state={t.muted ? "warn" : "on"} title={t.muted ? "Muted" : "Active"} />
                    <span className="tn-lane__name">{t.name}</span>
                  </div>
                  <div className="tn-lane__strip">
                    {!t.muted && <div className="tn-lane__wave" style={{ ["--track-color" as string]: t.color }} />}
                  </div>
                </div>
              ))}
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
          <Knob value={0} min={-1} max={1} onChange={() => {}} label="Pan" format={panFmt} size={44} />
          <Fader value={master} onChange={setMaster} format={dbFmt} />
          <LED state="on" title="Master" />
        </div>

        {tracks.map((t) => (
          <div className="tn-strip" key={t.id}>
            <div className="tn-strip__name" style={{ color: t.color }}>{t.name}</div>
            <Knob value={t.pan} min={-1} max={1} onChange={(v) => patch(t.id, { pan: v })} label="Pan" format={panFmt} size={44} />
            <Fader value={t.volumeDb} onChange={(v) => patch(t.id, { volumeDb: v })} format={dbFmt} />
            <div className="tn-strip__row">
              <Toggle checked={t.muted} onChange={(v) => patch(t.id, { muted: v })} label="M" />
              <Toggle checked={t.soloed} onChange={(v) => patch(t.id, { soloed: v })} label="S" />
            </div>
            <Button variant="ghost" onClick={() => {}}>+ FX</Button>
          </div>
        ))}
      </section>
    </div>
  );
}
