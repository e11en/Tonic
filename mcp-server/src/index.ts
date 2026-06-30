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
