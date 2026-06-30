/**
 * Wire protocol shared by the browser app and the MCP server's WebSocket bridge.
 *
 * The browser is the WS *client* and the authoritative state owner; the MCP server
 * runs the WS *server* on 127.0.0.1:8765. Two message directions:
 *
 *   bridge  -> browser : CommandMessage   ("please run this action")
 *   browser -> bridge  : AckMessage       (result/error of a command)
 *                        SnapshotMessage  (full project, on connect + after every change)
 *
 * NOTE: `mcp-server/` has its own tsconfig (`rootDir: src`) and cannot import this file,
 * so it mirrors the same `type`/`action` string literals in `mcp-server/src/protocol.ts`.
 * Keep the two in sync — they are the actual wire contract.
 */

import type { Project, TrackKind } from "@/state/types";

export const WS_DEFAULT_PORT = 8765;
export const WS_URL = `ws://127.0.0.1:${WS_DEFAULT_PORT}`;

/** Mutating/transport actions the bridge can ask the running app to perform. */
export type BridgeAction =
  | "addTrack"
  | "removeTrack"
  | "renameTrack"
  | "setTrackVolume"
  | "setTrackPan"
  | "setTrackMute"
  | "setTrackSolo"
  | "setMasterVolume"
  | "addClip"
  | "moveClip"
  | "removeClip"
  | "setTempo"
  | "play"
  | "stop";

/** Argument shape per action — keeps the UI, the bridge, and `dispatch` honest. */
export interface ActionPayloads {
  addTrack: { name?: string; kind?: TrackKind };
  removeTrack: { trackId: string };
  renameTrack: { trackId: string; name: string };
  setTrackVolume: { trackId: string; volumeDb: number };
  setTrackPan: { trackId: string; pan: number };
  setTrackMute: { trackId: string; muted: boolean };
  setTrackSolo: { trackId: string; soloed: boolean };
  setMasterVolume: { volumeDb: number };
  addClip: {
    trackId: string;
    sampleId: string;
    startSec?: number;
    durationSec?: number;
    offsetSec?: number;
    gainDb?: number;
  };
  moveClip: { trackId: string; clipId: string; startSec: number };
  removeClip: { trackId: string; clipId: string };
  setTempo: { bpm: number };
  play: Record<string, never>;
  stop: Record<string, never>;
}

/** bridge -> browser: run this action and ack with the result. */
export interface CommandMessage<A extends BridgeAction = BridgeAction> {
  type: "command";
  id: string;
  action: A;
  args: ActionPayloads[A];
}

/** browser -> bridge: outcome of a command. */
export type AckMessage =
  | { type: "ack"; id: string; ok: true; result?: unknown }
  | { type: "ack"; id: string; ok: false; error: string };

/** browser -> bridge: the full current project, sent on connect and after every change. */
export interface SnapshotMessage {
  type: "snapshot";
  project: Project;
}

export type BridgeToBrowser = CommandMessage;
export type BrowserToBridge = AckMessage | SnapshotMessage;
