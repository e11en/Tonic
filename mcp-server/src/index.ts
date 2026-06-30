/**
 * Tonic MCP server — Phase 1.
 *
 * Runs a stdio MCP server AND the WebSocket bridge (ws://127.0.0.1:8765) in one process.
 * The browser app connects to the bridge; these tools drive the *running* app through the
 * same action layer the UI uses. Read tools answer from the latest pushed snapshot.
 *
 * IMPORTANT: stdout is the MCP protocol channel. Log ONLY to stderr (console.error).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Bridge } from "./bridge.js";

const bridge = new Bridge();

const server = new McpServer({
  name: "tonic",
  version: "0.1.0",
});

const json = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

// ---- Read tools (answer from the last snapshot the browser pushed) ----

server.tool(
  "get_project",
  "Get the full current Tonic project state (tempo, transport, tracks, master volume) " +
    "as last pushed by the running browser app.",
  async () => {
    const snapshot = bridge.getSnapshot();
    if (!snapshot) {
      return json({
        connected: bridge.isConnected(),
        note: "No snapshot yet. Open http://localhost:5173 with the dev server running.",
      });
    }
    return json(snapshot);
  },
);

server.tool(
  "list_tracks",
  "List the tracks in the current Tonic project (id, name, kind, volume in dB, pan, muted).",
  async () => {
    const snapshot = bridge.getSnapshot();
    if (!snapshot) return json({ tracks: [], note: "No snapshot yet." });
    const tracks = snapshot.tracks.map((t) => ({
      id: t.id,
      name: t.name,
      kind: t.kind,
      volumeDb: t.volumeDb,
      pan: t.pan,
      muted: t.muted,
    }));
    return json({ count: tracks.length, tracks });
  },
);

server.tool(
  "list_samples",
  "List the audio samples available in the current Tonic project (id, name, duration). " +
    "Samples are uploaded in the app UI; reference their ids when adding clips.",
  async () => {
    const snapshot = bridge.getSnapshot();
    const samples = snapshot ? Object.values(snapshot.samples ?? {}) : [];
    return json({ count: samples.length, samples });
  },
);

// ---- Write tools (send a command to the running app, await its ack) ----

server.tool(
  "add_track",
  "Add a new track to the running Tonic project. Returns the new track id.",
  {
    name: z.string().optional().describe("Track name (default: 'Track N')"),
    kind: z
      .enum(["audio", "instrument", "drum"])
      .optional()
      .describe("Track kind (default: 'audio')"),
  },
  async ({ name, kind }) => {
    const result = await bridge.command("addTrack", { name, kind });
    return json(result);
  },
);

server.tool(
  "remove_track",
  "Remove a track from the running Tonic project.",
  { trackId: z.string().describe("The track id (from list_tracks / get_project)") },
  async ({ trackId }) => {
    await bridge.command("removeTrack", { trackId });
    return json({ ok: true, trackId });
  },
);

server.tool(
  "rename_track",
  "Rename a track on the running Tonic project.",
  {
    trackId: z.string().describe("The track id"),
    name: z.string().describe("The new track name"),
  },
  async ({ trackId, name }) => {
    await bridge.command("renameTrack", { trackId, name });
    return json({ ok: true, trackId, name });
  },
);

server.tool(
  "set_track_volume",
  "Set a track's volume in decibels (clamped to -60..+6 dB) on the running Tonic project.",
  {
    trackId: z.string().describe("The track id (from list_tracks / get_project)"),
    volumeDb: z.number().describe("Volume in dB, e.g. 0 = unity, -6 = quieter, -Infinity-ish = -60"),
  },
  async ({ trackId, volumeDb }) => {
    await bridge.command("setTrackVolume", { trackId, volumeDb });
    return json({ ok: true, trackId, volumeDb });
  },
);

server.tool(
  "set_track_pan",
  "Set a track's stereo pan (-1 = hard left, 0 = center, +1 = hard right).",
  {
    trackId: z.string().describe("The track id"),
    pan: z.number().min(-1).max(1).describe("Pan, -1..1"),
  },
  async ({ trackId, pan }) => {
    await bridge.command("setTrackPan", { trackId, pan });
    return json({ ok: true, trackId, pan });
  },
);

server.tool(
  "mute_track",
  "Mute or unmute a track on the running Tonic project.",
  {
    trackId: z.string().describe("The track id"),
    muted: z.boolean().describe("true to mute, false to unmute"),
  },
  async ({ trackId, muted }) => {
    await bridge.command("setTrackMute", { trackId, muted });
    return json({ ok: true, trackId, muted });
  },
);

server.tool(
  "solo_track",
  "Solo or unsolo a track. When any track is soloed, only soloed tracks are audible.",
  {
    trackId: z.string().describe("The track id"),
    soloed: z.boolean().describe("true to solo, false to unsolo"),
  },
  async ({ trackId, soloed }) => {
    await bridge.command("setTrackSolo", { trackId, soloed });
    return json({ ok: true, trackId, soloed });
  },
);

server.tool(
  "set_master_volume",
  "Set the master output volume in dB (clamped to -60..+6).",
  { volumeDb: z.number().describe("Master volume in dB") },
  async ({ volumeDb }) => {
    await bridge.command("setMasterVolume", { volumeDb });
    return json({ ok: true, volumeDb });
  },
);

server.tool(
  "set_tempo",
  "Set the project tempo in BPM (clamped to 40..240) on the running Tonic project.",
  {
    bpm: z.number().describe("Beats per minute, e.g. 120"),
  },
  async ({ bpm }) => {
    await bridge.command("setTempo", { bpm });
    return json({ ok: true, bpm });
  },
);

server.tool(
  "add_clip",
  "Place an audio clip (referencing an uploaded sample) on a track's timeline. " +
    "Use list_samples for sample ids and list_tracks for track ids. Returns the new clip id.",
  {
    trackId: z.string().describe("The track id"),
    sampleId: z.string().describe("The sample id (from list_samples)"),
    startSec: z.number().min(0).optional().describe("Start time on the timeline in seconds (default 0)"),
    durationSec: z.number().min(0).optional().describe("Clip length in seconds (default: full sample)"),
  },
  async ({ trackId, sampleId, startSec, durationSec }) => {
    const result = await bridge.command("addClip", { trackId, sampleId, startSec, durationSec });
    return json(result);
  },
);

server.tool(
  "move_clip",
  "Move a clip to a new start time (seconds) on its track.",
  {
    trackId: z.string().describe("The track id"),
    clipId: z.string().describe("The clip id"),
    startSec: z.number().min(0).describe("New start time in seconds"),
  },
  async ({ trackId, clipId, startSec }) => {
    await bridge.command("moveClip", { trackId, clipId, startSec });
    return json({ ok: true, trackId, clipId, startSec });
  },
);

server.tool(
  "remove_clip",
  "Remove a clip from a track.",
  {
    trackId: z.string().describe("The track id"),
    clipId: z.string().describe("The clip id"),
  },
  async ({ trackId, clipId }) => {
    await bridge.command("removeClip", { trackId, clipId });
    return json({ ok: true, trackId, clipId });
  },
);

server.tool(
  "add_midi_clip",
  "Add an empty MIDI clip to an instrument track (create one with add_track kind:\"instrument\"). " +
    "Returns the new clip id; then use place_note to add notes.",
  {
    trackId: z.string().describe("The instrument track id"),
    startSec: z.number().min(0).optional().describe("Start time on the timeline (default 0)"),
    bars: z.number().min(1).optional().describe("Clip length in bars of 4 beats (default 2)"),
  },
  async ({ trackId, startSec, bars }) => {
    const result = await bridge.command("addMidiClip", { trackId, startSec, bars });
    return json(result);
  },
);

server.tool(
  "place_note",
  "Place a MIDI note in a clip. Pitch is a MIDI note number (60 = middle C). startBeats is the " +
    "position in quarter-note beats from the clip start. Returns the note id.",
  {
    trackId: z.string().describe("The instrument track id"),
    clipId: z.string().describe("The MIDI clip id"),
    pitch: z.number().int().min(0).max(127).describe("MIDI note number (60 = middle C / C4)"),
    startBeats: z.number().min(0).describe("Start position in beats from the clip start"),
    durationBeats: z.number().min(0.25).optional().describe("Note length in beats (default 1)"),
    velocity: z.number().min(0).max(1).optional().describe("Velocity 0..1 (default 0.8)"),
  },
  async ({ trackId, clipId, pitch, startBeats, durationBeats, velocity }) => {
    const result = await bridge.command("placeNote", {
      trackId,
      clipId,
      pitch,
      startBeats,
      durationBeats,
      velocity,
    });
    return json(result);
  },
);

server.tool(
  "remove_note",
  "Remove a note from a MIDI clip.",
  {
    trackId: z.string().describe("The instrument track id"),
    clipId: z.string().describe("The MIDI clip id"),
    noteId: z.string().describe("The note id"),
  },
  async ({ trackId, clipId, noteId }) => {
    await bridge.command("removeNote", { trackId, clipId, noteId });
    return json({ ok: true, trackId, clipId, noteId });
  },
);

server.tool(
  "add_drum_track",
  "Add a drum track with an empty 16-step pattern (kick/snare/hi-hat lanes). Returns the track id; " +
    "the pattern clip is the track's first clip. Use set_step to program the beat.",
  { name: z.string().optional().describe("Track name (default 'Drums')") },
  async ({ name }) => {
    const result = await bridge.command("addDrumTrack", { name });
    return json(result);
  },
);

server.tool(
  "set_step",
  "Toggle a step in a drum pattern. laneIndex 0=kick, 1=snare, 2=hi-hat (default kit); step is " +
    "0-based (0..15). Get the clipId from get_project (the drum track's first clip).",
  {
    trackId: z.string().describe("The drum track id"),
    clipId: z.string().describe("The pattern clip id"),
    laneIndex: z.number().int().min(0).describe("Lane index (0=kick, 1=snare, 2=hi-hat)"),
    step: z.number().int().min(0).describe("Step index, 0-based"),
    on: z.boolean().describe("true to enable the hit, false to clear it"),
  },
  async ({ trackId, clipId, laneIndex, step, on }) => {
    await bridge.command("setStep", { trackId, clipId, laneIndex, step, on });
    return json({ ok: true, trackId, clipId, laneIndex, step, on });
  },
);

server.tool(
  "arm_track",
  "Arm or disarm a track for recording (the Rec button records onto the armed track).",
  {
    trackId: z.string().describe("The track id"),
    armed: z.boolean().describe("true to arm, false to disarm"),
  },
  async ({ trackId, armed }) => {
    await bridge.command("armTrack", { trackId, armed });
    return json({ ok: true, trackId, armed });
  },
);

server.tool(
  "set_loop_region",
  "Set the transport loop region in seconds (playback loops between start and end).",
  {
    startSec: z.number().min(0).describe("Loop start in seconds"),
    endSec: z.number().min(0).describe("Loop end in seconds"),
  },
  async ({ startSec, endSec }) => {
    await bridge.command("setLoopRegion", { startSec, endSec });
    return json({ ok: true, startSec, endSec });
  },
);

server.tool(
  "clear_loop_region",
  "Clear the transport loop region (stop looping).",
  async () => {
    await bridge.command("clearLoopRegion", {});
    return json({ ok: true });
  },
);

server.tool(
  "play",
  "Start the transport (play) on the running Tonic project.",
  async () => {
    await bridge.command("play", {});
    return json({ ok: true, transport: "playing" });
  },
);

server.tool(
  "stop",
  "Stop the transport and rewind on the running Tonic project.",
  async () => {
    await bridge.command("stop", {});
    return json({ ok: true, transport: "stopped" });
  },
);

async function main() {
  bridge.start();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[tonic-mcp] server ready on stdio (tools: get_project, list_tracks, add_track, " +
    "remove_track, rename_track, set_track_volume, set_track_pan, mute_track, solo_track, " +
    "set_master_volume, set_tempo, play, stop).");
}

main().catch((err) => {
  console.error("[tonic-mcp] fatal:", err);
  process.exit(1);
});
