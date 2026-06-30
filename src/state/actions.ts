/**
 * The ONLY mutation surface for Tonic's store.
 *
 * Both writers funnel through here: the React UI calls these functions directly,
 * and the WS bridge calls `dispatch()` (same functions, same store). Downstream —
 * React re-renders and the audio engine reconcile — a UI click and an MCP command
 * are indistinguishable, which is the whole point of the single-source-of-truth spine.
 *
 * Keep this the only file that calls `tonicStore.setState`.
 */
import { nanoid } from "nanoid";
import { tonicStore } from "./store";
import type { Project, TrackKind } from "./types";
import type { ActionPayloads, BridgeAction } from "@shared/protocol";

/** Track strip colors, cycled by index (matches the SoundBlocks palette tokens). */
const TRACK_COLORS = [
  "var(--track-1)",
  "var(--track-2)",
  "var(--track-3)",
  "var(--track-4)",
  "var(--track-5)",
];

const TEMPO_MIN = 40;
const TEMPO_MAX = 240;
const VOLUME_MIN_DB = -60;
const VOLUME_MAX_DB = 6;

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

/**
 * Replace the whole project (used by persistence to hydrate a saved project on boot).
 * Transport is reset to stopped so a reload never resumes playback unexpectedly.
 */
export function loadProjectIntoStore(project: Project): void {
  tonicStore.setState((s) => {
    s.project = project;
    s.project.transport.state = "stopped";
    s.project.transport.positionSec = 0;
  });
}

/** Add a new track and return its id. */
export function addTrack(opts?: { name?: string; kind?: TrackKind }): string {
  const id = nanoid();
  tonicStore.setState((s) => {
    const idx = s.project.tracks.length;
    s.project.tracks.push({
      id,
      kind: opts?.kind ?? "audio",
      name: opts?.name ?? `Track ${idx + 1}`,
      color: TRACK_COLORS[idx % TRACK_COLORS.length],
      volumeDb: 0,
      pan: 0,
      muted: false,
      soloed: false,
      armed: false,
      clips: [],
      effects: [],
    });
  });
  return id;
}

/** Remove a track by id. */
export function removeTrack(trackId: string): void {
  tonicStore.setState((s) => {
    s.project.tracks = s.project.tracks.filter((t) => t.id !== trackId);
  });
}

/** Rename a track. */
export function renameTrack(trackId: string, name: string): void {
  tonicStore.setState((s) => {
    const track = s.project.tracks.find((t) => t.id === trackId);
    if (track) track.name = name;
  });
}

/** Set a track's volume in dB (clamped to the fader range). */
export function setTrackVolume(trackId: string, volumeDb: number): void {
  tonicStore.setState((s) => {
    const track = s.project.tracks.find((t) => t.id === trackId);
    if (track) track.volumeDb = clamp(volumeDb, VOLUME_MIN_DB, VOLUME_MAX_DB);
  });
}

/** Set a track's pan (-1 left .. +1 right). */
export function setTrackPan(trackId: string, pan: number): void {
  tonicStore.setState((s) => {
    const track = s.project.tracks.find((t) => t.id === trackId);
    if (track) track.pan = clamp(pan, -1, 1);
  });
}

/** Mute / unmute a track. */
export function setTrackMute(trackId: string, muted: boolean): void {
  tonicStore.setState((s) => {
    const track = s.project.tracks.find((t) => t.id === trackId);
    if (track) track.muted = muted;
  });
}

/** Solo / unsolo a track. */
export function setTrackSolo(trackId: string, soloed: boolean): void {
  tonicStore.setState((s) => {
    const track = s.project.tracks.find((t) => t.id === trackId);
    if (track) track.soloed = soloed;
  });
}

/** Set the master output volume in dB. */
export function setMasterVolume(volumeDb: number): void {
  tonicStore.setState((s) => {
    s.project.masterVolumeDb = clamp(volumeDb, VOLUME_MIN_DB, VOLUME_MAX_DB);
  });
}

/** Set the project tempo in BPM (clamped to a musical range). */
export function setTempo(bpm: number): void {
  tonicStore.setState((s) => {
    s.project.tempo = clamp(bpm, TEMPO_MIN, TEMPO_MAX);
  });
}

/** Start the transport. */
export function play(): void {
  tonicStore.setState((s) => {
    s.project.transport.state = "playing";
  });
}

/** Stop the transport and rewind to the start. */
export function stop(): void {
  tonicStore.setState((s) => {
    s.project.transport.state = "stopped";
    s.project.transport.positionSec = 0;
  });
}

/**
 * Route a bridge action to its function. Returns a serializable result that the
 * WS bridge sends back in the ack. Throws on unknown actions / bad args so the
 * bridge can reply with `ok: false`.
 */
export function dispatch<A extends BridgeAction>(
  action: A,
  args: ActionPayloads[A],
): unknown {
  switch (action) {
    case "addTrack": {
      const a = args as ActionPayloads["addTrack"];
      return { trackId: addTrack(a) };
    }
    case "removeTrack": {
      const a = args as ActionPayloads["removeTrack"];
      removeTrack(a.trackId);
      return {};
    }
    case "renameTrack": {
      const a = args as ActionPayloads["renameTrack"];
      renameTrack(a.trackId, a.name);
      return {};
    }
    case "setTrackVolume": {
      const a = args as ActionPayloads["setTrackVolume"];
      setTrackVolume(a.trackId, a.volumeDb);
      return {};
    }
    case "setTrackPan": {
      const a = args as ActionPayloads["setTrackPan"];
      setTrackPan(a.trackId, a.pan);
      return {};
    }
    case "setTrackMute": {
      const a = args as ActionPayloads["setTrackMute"];
      setTrackMute(a.trackId, a.muted);
      return {};
    }
    case "setTrackSolo": {
      const a = args as ActionPayloads["setTrackSolo"];
      setTrackSolo(a.trackId, a.soloed);
      return {};
    }
    case "setMasterVolume": {
      const a = args as ActionPayloads["setMasterVolume"];
      setMasterVolume(a.volumeDb);
      return {};
    }
    case "setTempo": {
      const a = args as ActionPayloads["setTempo"];
      setTempo(a.bpm);
      return {};
    }
    case "play":
      play();
      return {};
    case "stop":
      stop();
      return {};
    default:
      throw new Error(`Unknown action: ${String(action)}`);
  }
}
