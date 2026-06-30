/**
 * WebSocket bridge (server side), co-located in the MCP server process.
 *
 * The browser app connects here as a WS client. This bridge:
 *   - tracks the most recent connected browser socket;
 *   - caches the latest `snapshot` the browser pushes (so read tools are instant);
 *   - sends `command` messages and resolves the matching `ack` (with a timeout).
 *
 * IMPORTANT: stdout is the MCP protocol channel — log ONLY to stderr.
 */
import { WebSocketServer, WebSocket } from "ws";
import {
  WS_DEFAULT_PORT,
  type BridgeAction,
  type BrowserToBridge,
  type ProjectSnapshot,
} from "./protocol.js";

interface Pending {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class Bridge {
  private wss: WebSocketServer | null = null;
  private socket: WebSocket | null = null;
  private lastSnapshot: ProjectSnapshot | null = null;
  private pending = new Map<string, Pending>();
  private seq = 0;

  start(port = WS_DEFAULT_PORT): void {
    this.wss = new WebSocketServer({ host: "127.0.0.1", port });
    this.wss.on("listening", () => {
      console.error(`[tonic-mcp] WS bridge listening on ws://127.0.0.1:${port}`);
    });
    this.wss.on("error", (err) => {
      console.error("[tonic-mcp] WS bridge error:", err);
    });
    this.wss.on("connection", (ws) => {
      console.error("[tonic-mcp] browser connected to bridge");
      this.socket = ws;
      ws.on("message", (data) => this.onMessage(data.toString()));
      ws.on("close", () => {
        if (this.socket === ws) this.socket = null;
        console.error("[tonic-mcp] browser disconnected from bridge");
      });
      ws.on("error", (err) => console.error("[tonic-mcp] socket error:", err));
    });
  }

  private onMessage(raw: string): void {
    let msg: BrowserToBridge;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.type === "snapshot") {
      this.lastSnapshot = msg.project;
    } else if (msg.type === "ack") {
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(msg.id);
      if (msg.ok) pending.resolve(msg.result);
      else pending.reject(new Error(msg.error));
    }
  }

  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  getSnapshot(): ProjectSnapshot | null {
    return this.lastSnapshot;
  }

  /** Send a command to the browser and resolve with its ack result. */
  command(action: BridgeAction, args: unknown, timeoutMs = 5000): Promise<unknown> {
    if (!this.isConnected()) {
      return Promise.reject(
        new Error(
          "No Tonic browser connected. Start the dev server (npm run dev) and open " +
            "http://localhost:5173, then retry.",
        ),
      );
    }
    const id = `c${++this.seq}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Command "${action}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.socket!.send(JSON.stringify({ type: "command", id, action, args }));
    });
  }
}
