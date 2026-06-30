/**
 * Tonic MCP server — Phase 0 stub.
 *
 * Exposes a single `ping` tool over stdio so the `.mcp.json` registration loads
 * cleanly in Claude Code. Phase 1 adds the WebSocket bridge (ws://127.0.0.1:8765)
 * and the live tools (add_track, set_tempo, set_track_volume, play, stop, ...).
 *
 * IMPORTANT: stdout is the MCP protocol channel. Log ONLY to stderr (console.error).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "tonic",
  version: "0.1.0",
});

server.tool(
  "ping",
  "Health check for the Tonic MCP server. Returns 'tonic alive' to confirm the server is reachable. The live DAW-control tools arrive in Phase 1.",
  async () => ({
    content: [{ type: "text", text: "tonic alive" }],
  }),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr only — never stdout.
  console.error("[tonic-mcp] Phase 0 server ready on stdio (tool: ping).");
}

main().catch((err) => {
  console.error("[tonic-mcp] fatal:", err);
  process.exit(1);
});
