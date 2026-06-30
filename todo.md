# todo.md — active phase

> See `ROADMAP.md` for all phases. This file holds only the **current** phase, written out as
> concrete steps. When the phase is done, empty this file and refill with the next phase.

## Phase 1 — Vertical slice + bridge spine

**Goal:** prove the single-source-of-truth + live-bridge spine. From Claude (MCP) add a track and
change tempo/volume, and see+hear the running browser app react; a UI fader mutates the same state.

**Status:** code complete + verified end-to-end (via MCP test harness). One step left: the
in-session MCP reload, which needs a Claude Code restart by the user.

### Dependencies
- [x] Add `tone` to the app (`package.json`) and install (`tone@^15`)
- [x] Add `ws` (+ `@types/ws`) to `mcp-server/` and install

### Wire protocol (`shared/protocol.ts`)
- [x] Define the real protocol: `WS_DEFAULT_PORT`/`WS_URL`, `BridgeAction` union, `ActionPayloads`
      per action, `CommandMessage` (bridge→browser), `AckMessage` + `SnapshotMessage` (browser→bridge)
- [x] Mirror the wire literals in `mcp-server/src/protocol.ts` (server has its own tsconfig rootDir)

### State mutation layer (`src/state/actions.ts`) — the ONLY writer
- [x] `addTrack(opts?)`, `setTrackVolume(trackId, db)`, `setTempo(bpm)`, `play()`, `stop()`
- [x] `dispatch(action, args)` — maps a `BridgeAction` to the function; used by the WS bridge so UI
      and bridge share one mutation path
- [x] Sensible clamps (tempo 40–240, volume −60..+6 dB)

### Audio engine (`src/audio/engine.ts`) — pure reconciler on Tone.js
- [x] Subscribe to `store` project slice (`subscribeWithSelector`, fireImmediately)
- [x] Reconcile transport (bpm `rampTo`, play/stop), master volume, and per-track `Tone.Channel`
      diffed by track id (create/update via `rampTo`, dispose removed)
- [x] `ensureStarted()` to unlock the AudioContext on first user gesture (browser autoplay policy)

### WS bridge client (`src/bridge/wsClient.ts`)
- [x] Connect to `ws://127.0.0.1:8765`, auto-reconnect
- [x] On message: `command` → `dispatch` → send `ack`
- [x] Push a `snapshot` on connect and on every store project change

### MCP server — real tools + WS bridge (`mcp-server/`)
- [x] `src/bridge.ts` — `WebSocketServer` on 127.0.0.1:8765, track latest browser socket,
      keep `lastSnapshot`, `command(action,args)` with id + ack/timeout, `getSnapshot()`
- [x] Replace the `ping` stub tools with: `get_project`, `list_tracks`, `add_track`,
      `set_track_volume`, `set_tempo`, `play`, `stop` (zod-validated args)
- [x] Start the WS server alongside the stdio transport; stderr-only logging

### Wire the UI to the store (`src/components/AppShell.tsx`)
- [x] Replace the demo-local `useState` tracks with `useTonic` selectors + `actions.ts` calls
- [x] Transport Play/Stop → `play()`/`stop()` (+ `ensureStarted()`); tempo knob → `setTempo`;
      track faders → `setTrackVolume`; "add track" affordance → `addTrack`
      (pan/mute/solo/master left as no-ops — wired in Phase 2's full mixer)
- [x] Boot the audio engine + bridge client once (`main.tsx`)

### Verification
- [x] `npm run typecheck` + `npm run build` (app) pass
- [x] `npm run typecheck` (mcp-server) passes
- [x] Dev server running; browser app connects to the bridge (no console errors)
- [x] MCP tools all work against the running app — verified via a stdio MCP test harness that
      spawns the new server while the real browser is connected: `set_tempo` (140 BPM),
      `add_track` ×2, `set_track_volume` (−12 dB), `play`, `get_project`, `list_tracks` — all
      visible in the browser (screenshot) with no console errors. NOTE: tracks are silent
      carriers in Phase 1 (no audio sources until Phase 3 clips), so "hear" = transport runs.
- [x] A UI fader mutates the same state MCP reports — dragged Claude Drums to −27.6 dB in the UI;
      a fresh MCP `list_tracks` reported `volumeDb: -27.6375`. One shared store, proven both ways.
- [ ] **Restart Claude Code** so the new MCP tools load in-session (user action), then re-run the
      tools live from the chat against the open app
- [x] Commit + push Phase 1 in the Tonic submodule; bump submodule pointer in home-workspace

### When done
- [ ] Mark Phase 1 complete in `ROADMAP.md`, empty this file, refill with Phase 2 steps
