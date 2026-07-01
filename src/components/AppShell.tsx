import { useState } from "react";
import { Button, Fader, Knob, LED, Panel, Toggle, Help } from "@/ui";
import { useTonic, tonicStore } from "@/state/store";
import {
  addTrack,
  removeTrack,
  renameTrack,
  armTrack,
  setTempo,
  setTrackVolume,
  setTrackPan,
  setTrackMute,
  setTrackSolo,
  setMasterVolume,
  setLoopRegion,
  clearLoopRegion,
  addMidiClip,
  addDrumTrack,
  newProject,
  addBeatStarter,
  addSynthStarter,
  play,
  stop,
} from "@/state/actions";
import { audioEngine } from "@/audio/engine";
import { startRecording, stopRecording, isRecording } from "@/audio/recorder";
import { ClipBlock } from "./ClipBlock";
import { SampleBrowser } from "./SampleBrowser";
import { PianoRoll } from "./PianoRoll";
import { DrumMachine } from "./DrumMachine";
import { EffectsRack } from "./EffectsRack";
import { WelcomeOverlay } from "./WelcomeOverlay";
import "./shell.css";

const ONBOARD_KEY = "tonic.onboarded";

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
  const [editorClip, setEditorClip] = useState<{ trackId: string; clipId: string } | null>(null);
  const [fxTrack, setFxTrack] = useState<string | null>(null);
  const [mixerOpen, setMixerOpen] = useState(true);
  const [showWelcome, setShowWelcome] = useState(() => {
    try {
      return localStorage.getItem(ONBOARD_KEY) !== "1";
    } catch {
      return true;
    }
  });

  const dismissWelcome = () => {
    setShowWelcome(false);
    try {
      localStorage.setItem(ONBOARD_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const confirmNewProject = () => {
    if (window.confirm("Start a new project? This clears the current one.")) {
      newProject();
      setEditorClip(null);
      setFxTrack(null);
    }
  };

  // Store-bound state (single source of truth).
  const tempo = useTonic((s) => s.project.tempo);
  const playing = useTonic((s) => s.project.transport.state === "playing");
  const tracks = useTonic((s) => s.project.tracks);
  const samples = useTonic((s) => s.project.samples);
  const masterVolume = useTonic((s) => s.project.masterVolumeDb);
  const transportState = useTonic((s) => s.project.transport.state);
  const loop = useTonic((s) => s.project.transport.loop);
  const recording = transportState === "recording";

  const togglePanel = (p: SidePanel) => setSidePanel((cur) => (cur === p ? null : p));

  const toggleRecord = async () => {
    if (isRecording()) {
      await stopRecording();
      return;
    }
    // Record onto the first armed track; if none, arm the first track.
    let target = tracks.find((t) => t.armed)?.id;
    if (!target) {
      target = tracks[0]?.id;
      if (target) armTrack(target, true);
    }
    if (!target) {
      window.alert("Add a track first, then record onto it.");
      return;
    }
    try {
      await startRecording(target, 0);
    } catch {
      window.alert("Could not access the microphone. Check the browser's mic permission.");
    }
  };

  const toggleLoop = () => {
    if (loop) clearLoopRegion();
    else setLoopRegion(0, 4); // default 4-second loop region
  };

  const addInstrument = () => {
    const trackId = addTrack({ kind: "instrument", name: "Synth" });
    const clipId = addMidiClip(trackId, 0, 2);
    if (clipId) setEditorClip({ trackId, clipId });
  };

  const addMidiClipAndEdit = (trackId: string) => {
    const clipId = addMidiClip(trackId, 0, 2);
    if (clipId) setEditorClip({ trackId, clipId });
  };

  const addDrums = () => {
    const trackId = addDrumTrack();
    // The drum track is created with one pattern clip — open it in the editor.
    const track = tonicStore.getState().project.tracks.find((t) => t.id === trackId);
    const clipId = track?.clips[0]?.id;
    if (clipId) setEditorClip({ trackId, clipId });
  };

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
          <Button
            variant={recording ? "neutral" : "ghost"}
            onClick={() => void toggleRecord()}
            title="Record from microphone onto the armed track"
          >
            {recording ? "■ Stop rec" : "● Rec"}
          </Button>
          <Button
            variant={loop ? "primary" : "ghost"}
            onClick={toggleLoop}
            title="Toggle a loop region"
          >
            ↻ Loop
          </Button>
          <LED state={recording ? "warn" : playing ? "blink" : "off"} title="Transport" />
        </div>

        <div className="tn-transport__group">
          <Knob
            value={tempo}
            min={40}
            max={240}
            onChange={(v) => setTempo(Math.round(v))}
            label="Tempo"
            format={(v) => `${Math.round(v)} BPM`}
            size={38}
          />
          <Help title="Tempo">
            Tempo is the speed of your song, measured in beats per minute (BPM). Higher = faster.
            Turn the knob (or drag up/down) to change it.
          </Help>
        </div>

        <div className="tn-transport__spacer" />

        <div className="tn-transport__group">
          <Button variant="ghost" onClick={confirmNewProject} title="Start a new project">
            ＋ New
          </Button>
          <Button variant="ghost" onClick={() => setShowWelcome(true)} title="Help & welcome">
            ?
          </Button>
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
                <div className="tn-empty">
                  <p className="tn-empty__title">Your song is empty — pick a starting point:</p>
                  <div className="tn-empty__actions">
                    <Button variant="primary" onClick={addBeatStarter}>
                      🥁 Start with a beat
                    </Button>
                    <Button variant="primary" onClick={addSynthStarter}>
                      🎹 Start with a synth
                    </Button>
                    <Button variant="ghost" onClick={() => addTrack()}>
                      Empty audio track
                    </Button>
                  </div>
                  <p className="t-label">
                    Or open <strong>Samples</strong> (📁 on the left) to upload your own audio.
                  </p>
                </div>
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
                    {t.kind === "instrument" && (
                      <button
                        className="tn-lane__midi"
                        title="Add a MIDI clip and edit notes"
                        onClick={() => addMidiClipAndEdit(t.id)}
                      >
                        ♪+
                      </button>
                    )}
                    <button
                      className={`tn-lane__arm${t.armed ? " is-armed" : ""}`}
                      title={t.armed ? "Armed for recording" : "Arm for recording"}
                      onClick={() => armTrack(t.id, !t.armed)}
                    >
                      ●
                    </button>
                    <button
                      className="tn-lane__remove"
                      title="Remove track"
                      onClick={() => removeTrack(t.id)}
                    >
                      ×
                    </button>
                  </div>
                  <div className="tn-lane__strip">
                    {loop && (
                      <div
                        className="tn-loop-band"
                        style={{
                          left: loop.startSec * PX_PER_SEC,
                          width: (loop.endSec - loop.startSec) * PX_PER_SEC,
                        }}
                      />
                    )}
                    {t.clips.length === 0 && !t.muted && (
                      <div className="tn-lane__wave" style={{ ["--track-color" as string]: t.color }} />
                    )}
                    {t.clips.map((c) => (
                      <ClipBlock
                        key={c.id}
                        trackId={t.id}
                        clip={c}
                        label={
                          c.audio
                            ? samples[c.audio.sampleId]?.name ?? "clip"
                            : c.pattern
                              ? "▦ beat"
                              : `♪ ${c.midi?.notes.length ?? 0}`
                        }
                        color={t.color}
                        pxPerSec={PX_PER_SEC}
                        onOpen={
                          c.midi || c.pattern
                            ? () => setEditorClip({ trackId: t.id, clipId: c.id })
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ paddingTop: "var(--space-2)", display: "flex", gap: "var(--space-2)" }}>
                <Button variant="ghost" onClick={() => addTrack()}>
                  + Add track
                </Button>
                <Button variant="ghost" onClick={addInstrument}>
                  + Add instrument
                </Button>
                <Button variant="ghost" onClick={addDrums}>
                  + Add drums
                </Button>
              </div>
            </div>
          </Panel>

          {editorClip &&
            (() => {
              const track = tracks.find((t) => t.id === editorClip.trackId);
              const clip = track?.clips.find((c) => c.id === editorClip.clipId);
              if (clip?.pattern) {
                return (
                  <DrumMachine
                    trackId={editorClip.trackId}
                    clipId={editorClip.clipId}
                    onClose={() => setEditorClip(null)}
                  />
                );
              }
              return (
                <PianoRoll
                  trackId={editorClip.trackId}
                  clipId={editorClip.clipId}
                  onClose={() => setEditorClip(null)}
                />
              );
            })()}
        </main>
      </div>

      {/* ---- mixer (collapsible bottom dock) ---- */}
      <section className={`tn-mixer${mixerOpen ? "" : " is-collapsed"}`} aria-label="Mixer">
        <button
          className="tn-mixer__toggle"
          onClick={() => setMixerOpen((o) => !o)}
          title={mixerOpen ? "Hide mixer" : "Show mixer"}
        >
          {mixerOpen ? "▾" : "▸"} Mixer <span className="t-label">· {tracks.length} track{tracks.length === 1 ? "" : "s"}</span>
        </button>
        <div className="tn-mixer__strips">
        <div className="tn-strip">
          <div className="tn-strip__name">
            Master
            <Help title="Master volume">
              The master fader sets the overall loudness of everything combined. Pull it down if the
              sound is distorting (clipping).
            </Help>
          </div>
          <div className="tn-strip__pan-placeholder" />
          <Fader value={masterVolume} onChange={setMasterVolume} format={dbFmt} height={104} />
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
            <Fader value={t.volumeDb} onChange={(v) => setTrackVolume(t.id, v)} format={dbFmt} height={104} />
            <div className="tn-strip__row">
              <Toggle checked={t.muted} onChange={(v) => setTrackMute(t.id, v)} label="M" />
              <Toggle checked={t.soloed} onChange={(v) => setTrackSolo(t.id, v)} label="S" />
            </div>
            <Button
              variant={fxTrack === t.id ? "primary" : "ghost"}
              onClick={() => setFxTrack((cur) => (cur === t.id ? null : t.id))}
              title="Effects rack"
            >
              FX{t.effects.length ? ` ${t.effects.length}` : ""}
            </Button>
          </div>
        ))}
        </div>
      </section>

      {fxTrack && (
        <div className="tn-fx-overlay">
          <EffectsRack trackId={fxTrack} onClose={() => setFxTrack(null)} />
        </div>
      )}

      {showWelcome && (
        <WelcomeOverlay
          onClose={dismissWelcome}
          onBeat={addBeatStarter}
          onSynth={addSynthStarter}
        />
      )}
    </div>
  );
}
