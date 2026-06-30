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
import type { Clip, Project, SampleMeta, TrackKind } from "./types";
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
  const kind = opts?.kind ?? "audio";
  tonicStore.setState((s) => {
    const idx = s.project.tracks.length;
    s.project.tracks.push({
      id,
      kind,
      name: opts?.name ?? `Track ${idx + 1}`,
      color: TRACK_COLORS[idx % TRACK_COLORS.length],
      volumeDb: 0,
      pan: 0,
      muted: false,
      soloed: false,
      armed: false,
      clips: [],
      effects: [],
      // Instrument tracks get a default synth so they make sound immediately.
      instrument: kind === "instrument" ? { type: "synth" } : undefined,
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

// ---- samples & clips ----

/** Register a sample's metadata. The blob + decoded buffer live outside the store. */
export function addSample(meta: SampleMeta): void {
  tonicStore.setState((s) => {
    s.project.samples[meta.id] = meta;
  });
}

/** Remove a sample's metadata and any clips that reference it. */
export function removeSample(sampleId: string): void {
  tonicStore.setState((s) => {
    delete s.project.samples[sampleId];
    for (const track of s.project.tracks) {
      track.clips = track.clips.filter((c) => c.audio?.sampleId !== sampleId);
    }
  });
}

/**
 * Add an audio clip referencing a sample to a track. Duration defaults to the sample's
 * full length. Returns the new clip id (or "" if the track/sample is missing).
 */
export function addClip(
  trackId: string,
  opts: {
    sampleId: string;
    startSec?: number;
    durationSec?: number;
    offsetSec?: number;
    gainDb?: number;
  },
): string {
  const id = nanoid();
  let created = false;
  tonicStore.setState((s) => {
    const track = s.project.tracks.find((t) => t.id === trackId);
    const sample = s.project.samples[opts.sampleId];
    if (!track || !sample) return;
    const clip: Clip = {
      id,
      startSec: Math.max(0, opts.startSec ?? 0),
      durationSec: opts.durationSec ?? sample.durationSec,
      audio: {
        sampleId: opts.sampleId,
        offsetSec: opts.offsetSec ?? 0,
        gainDb: opts.gainDb ?? 0,
      },
    };
    track.clips.push(clip);
    created = true;
  });
  return created ? id : "";
}

/** Move a clip to a new start time (seconds, clamped to >= 0). */
export function moveClip(trackId: string, clipId: string, startSec: number): void {
  tonicStore.setState((s) => {
    const track = s.project.tracks.find((t) => t.id === trackId);
    const clip = track?.clips.find((c) => c.id === clipId);
    if (clip) clip.startSec = Math.max(0, startSec);
  });
}

/** Remove a clip from a track. */
export function removeClip(trackId: string, clipId: string): void {
  tonicStore.setState((s) => {
    const track = s.project.tracks.find((t) => t.id === trackId);
    if (track) track.clips = track.clips.filter((c) => c.id !== clipId);
  });
}

// ---- MIDI clips & notes ----

/** Add an empty MIDI clip to a track. Length is `bars` (4 beats each) at the current tempo. */
export function addMidiClip(trackId: string, startSec = 0, bars = 2): string {
  const id = nanoid();
  let created = false;
  tonicStore.setState((s) => {
    const track = s.project.tracks.find((t) => t.id === trackId);
    if (!track) return;
    const secPerBeat = 60 / s.project.tempo;
    track.clips.push({
      id,
      startSec: Math.max(0, startSec),
      durationSec: bars * 4 * secPerBeat,
      midi: { notes: [] },
    });
    created = true;
  });
  return created ? id : "";
}

function findMidiClip(s: { project: Project }, trackId: string, clipId: string) {
  const track = s.project.tracks.find((t) => t.id === trackId);
  const clip = track?.clips.find((c) => c.id === clipId);
  return clip?.midi ? clip : undefined;
}

/** Place a note in a MIDI clip. Returns the note id (or "" if the clip is missing). */
export function placeNote(
  trackId: string,
  clipId: string,
  opts: { pitch: number; startBeats: number; durationBeats?: number; velocity?: number },
): string {
  const id = nanoid();
  let created = false;
  tonicStore.setState((s) => {
    const clip = findMidiClip(s, trackId, clipId);
    if (!clip?.midi) return;
    clip.midi.notes.push({
      id,
      pitch: Math.round(opts.pitch),
      startBeats: Math.max(0, opts.startBeats),
      durationBeats: opts.durationBeats ?? 1,
      velocity: opts.velocity ?? 0.8,
    });
    created = true;
  });
  return created ? id : "";
}

/** Remove a note from a MIDI clip. */
export function removeNote(trackId: string, clipId: string, noteId: string): void {
  tonicStore.setState((s) => {
    const clip = findMidiClip(s, trackId, clipId);
    if (clip?.midi) clip.midi.notes = clip.midi.notes.filter((n) => n.id !== noteId);
  });
}

/** Update a note's pitch / position / length. */
export function updateNote(
  trackId: string,
  clipId: string,
  noteId: string,
  patch: { pitch?: number; startBeats?: number; durationBeats?: number },
): void {
  tonicStore.setState((s) => {
    const clip = findMidiClip(s, trackId, clipId);
    const note = clip?.midi?.notes.find((n) => n.id === noteId);
    if (!note) return;
    if (patch.pitch !== undefined) note.pitch = Math.round(patch.pitch);
    if (patch.startBeats !== undefined) note.startBeats = Math.max(0, patch.startBeats);
    if (patch.durationBeats !== undefined) note.durationBeats = Math.max(0.25, patch.durationBeats);
  });
}

/** Set the project tempo in BPM (clamped to a musical range). */
export function setTempo(bpm: number): void {
  tonicStore.setState((s) => {
    s.project.tempo = clamp(bpm, TEMPO_MIN, TEMPO_MAX);
  });
}

/** Arm / disarm a track for recording. */
export function armTrack(trackId: string, armed: boolean): void {
  tonicStore.setState((s) => {
    const track = s.project.tracks.find((t) => t.id === trackId);
    if (track) track.armed = armed;
  });
}

/** Set the transport loop region (seconds). */
export function setLoopRegion(startSec: number, endSec: number): void {
  tonicStore.setState((s) => {
    const a = Math.max(0, Math.min(startSec, endSec));
    const b = Math.max(startSec, endSec);
    s.project.transport.loop = { startSec: a, endSec: b };
  });
}

/** Clear the transport loop region. */
export function clearLoopRegion(): void {
  tonicStore.setState((s) => {
    s.project.transport.loop = null;
  });
}

/** Start the transport. */
export function play(): void {
  tonicStore.setState((s) => {
    s.project.transport.state = "playing";
  });
}

/** Put the transport into recording state (mic capture is orchestrated by the recorder). */
export function record(): void {
  tonicStore.setState((s) => {
    s.project.transport.state = "recording";
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
    case "addClip": {
      const a = args as ActionPayloads["addClip"];
      const clipId = addClip(a.trackId, a);
      if (!clipId) throw new Error("addClip failed: unknown track or sample id");
      return { clipId };
    }
    case "moveClip": {
      const a = args as ActionPayloads["moveClip"];
      moveClip(a.trackId, a.clipId, a.startSec);
      return {};
    }
    case "removeClip": {
      const a = args as ActionPayloads["removeClip"];
      removeClip(a.trackId, a.clipId);
      return {};
    }
    case "armTrack": {
      const a = args as ActionPayloads["armTrack"];
      armTrack(a.trackId, a.armed);
      return {};
    }
    case "setLoopRegion": {
      const a = args as ActionPayloads["setLoopRegion"];
      setLoopRegion(a.startSec, a.endSec);
      return {};
    }
    case "clearLoopRegion": {
      clearLoopRegion();
      return {};
    }
    case "addMidiClip": {
      const a = args as ActionPayloads["addMidiClip"];
      const clipId = addMidiClip(a.trackId, a.startSec, a.bars);
      if (!clipId) throw new Error("addMidiClip failed: unknown track id");
      return { clipId };
    }
    case "placeNote": {
      const a = args as ActionPayloads["placeNote"];
      const noteId = placeNote(a.trackId, a.clipId, a);
      if (!noteId) throw new Error("placeNote failed: unknown track/clip id");
      return { noteId };
    }
    case "removeNote": {
      const a = args as ActionPayloads["removeNote"];
      removeNote(a.trackId, a.clipId, a.noteId);
      return {};
    }
    case "updateNote": {
      const a = args as ActionPayloads["updateNote"];
      updateNote(a.trackId, a.clipId, a.noteId, a);
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
    case "record":
      record();
      return {};
    case "stop":
      stop();
      return {};
    default:
      throw new Error(`Unknown action: ${String(action)}`);
  }
}
