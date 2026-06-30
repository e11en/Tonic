/**
 * Wire protocol — server-side mirror of the browser's `shared/protocol.ts`.
 *
 * The app and this server are separate TS projects (this one has `rootDir: src`), so the
 * contract is duplicated rather than imported. Keep the `type`/`action` string literals in
 * sync with `shared/protocol.ts`. The server only relays and caches the project snapshot,
 * so the project is typed loosely here.
 */

export const WS_DEFAULT_PORT = 8765;

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
  | "armTrack"
  | "setLoopRegion"
  | "clearLoopRegion"
  | "setTempo"
  | "play"
  | "record"
  | "stop";

export interface CommandMessage {
  type: "command";
  id: string;
  action: BridgeAction;
  args: unknown;
}

export type AckMessage =
  | { type: "ack"; id: string; ok: true; result?: unknown }
  | { type: "ack"; id: string; ok: false; error: string };

/** The serializable project the browser pushes. Shape mirrors the app's `Project`. */
export interface ProjectSnapshot {
  id: string;
  name: string;
  tempo: number;
  timeSignature: [number, number];
  transport: { state: string; positionSec: number; loop: unknown };
  masterVolumeDb: number;
  tracks: Array<{
    id: string;
    kind: string;
    name: string;
    color: string;
    volumeDb: number;
    pan: number;
    muted: boolean;
    soloed: boolean;
    armed: boolean;
    [k: string]: unknown;
  }>;
  samples: Record<string, unknown>;
}

export interface SnapshotMessage {
  type: "snapshot";
  project: ProjectSnapshot;
}

export type BrowserToBridge = AckMessage | SnapshotMessage;
