/**
 * Wire protocol shared by the browser app and the MCP server's WebSocket bridge.
 *
 * PLACEHOLDER (Phase 0): the bridge is not built yet. These types fix the contract
 * so the `@shared` path alias resolves and Phase 1 can fill in the real messages.
 *
 * Intended Phase 1 shape:
 *   bridge -> browser: { type: "command"; id; action; args }
 *   browser -> bridge: { type: "ack"; id; ok; result?/error? }
 *                      { type: "snapshot"; project }
 */

import type { Project } from "@/state/types";

export const WS_DEFAULT_PORT = 8765;

export type BridgeToBrowser = {
  type: "command";
  id: string;
  action: string;
  args: unknown[];
};

export type BrowserToBridge =
  | { type: "ack"; id: string; ok: true; result?: unknown }
  | { type: "ack"; id: string; ok: false; error: string }
  | { type: "snapshot"; project: Project };
