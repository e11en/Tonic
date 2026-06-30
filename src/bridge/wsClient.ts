/**
 * WebSocket bridge client (browser side).
 *
 * Connects to the MCP server's WS bridge at ws://127.0.0.1:8765 and:
 *   - on `command` messages, runs the action through `dispatch` (the same mutation
 *     path the UI uses) and replies with an `ack`;
 *   - pushes a `snapshot` of the project on connect and after every store change.
 *
 * The bridge is optional: if the MCP server isn't running the app works fine and just
 * keeps retrying in the background. Nothing here writes state except via `dispatch`.
 */
import { WS_URL } from "@shared/protocol";
import type { BridgeToBrowser, BrowserToBridge } from "@shared/protocol";
import { dispatch } from "@/state/actions";
import { tonicStore } from "@/state/store";

const RECONNECT_MS = 2000;

class BridgeClient {
  private ws: WebSocket | null = null;
  private unsubscribe?: () => void;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private booted = false;

  /** Start connecting (and auto-reconnecting). Idempotent. */
  connect(): void {
    if (this.booted) return;
    this.booted = true;
    this.open();
  }

  private open(): void {
    let ws: WebSocket;
    try {
      ws = new WebSocket(WS_URL);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.sendSnapshot();
      // Push a fresh snapshot whenever the project changes.
      this.unsubscribe?.();
      this.unsubscribe = tonicStore.subscribe(
        (s) => s.project,
        () => this.sendSnapshot(),
      );
    };

    ws.onmessage = (event) => {
      let msg: BridgeToBrowser;
      try {
        msg = JSON.parse(typeof event.data === "string" ? event.data : "");
      } catch {
        return;
      }
      this.handle(msg);
    };

    ws.onclose = () => {
      this.unsubscribe?.();
      this.unsubscribe = undefined;
      this.ws = null;
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      // Close triggers the reconnect path; avoid noisy logs during dev.
      ws.close();
    };
  }

  private handle(msg: BridgeToBrowser): void {
    if (msg.type !== "command") return;
    try {
      const result = dispatch(msg.action, msg.args);
      this.send({ type: "ack", id: msg.id, ok: true, result });
    } catch (err) {
      this.send({
        type: "ack",
        id: msg.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private sendSnapshot(): void {
    this.send({ type: "snapshot", project: tonicStore.getState().project });
  }

  private send(msg: BrowserToBridge): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private scheduleReconnect(): void {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.open(), RECONNECT_MS);
  }
}

export const bridgeClient = new BridgeClient();
