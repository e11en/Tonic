# todo.md — active phase

> See `ROADMAP.md` for all phases. This file holds only the **current** phase, written out as
> concrete steps. When the phase is done, empty this file and refill with the next phase.

## Phase 2 — Tracks, mixer, persistence

**Goal:** a real multi-track mixer (volume/pan/mute/solo + master) all bound through `actions.ts`,
plus local-first persistence so a project survives a reload.

**Status:** in progress.

### Actions (extend the single mutation layer)
- [ ] `setTrackPan`, `setTrackMute`, `setTrackSolo`, `renameTrack`, `removeTrack`
- [ ] `setMasterVolume`
- [ ] Extend `dispatch()` + protocol `BridgeAction`/`ActionPayloads` for the new ones

### Engine
- [ ] Respect solo: if any track soloed, only soloed tracks sound (others effectively muted)
- [ ] Master volume already reconciled — confirm

### Mixer UI
- [ ] Wire master fader → `setMasterVolume`; per-track pan/mute/solo → actions
- [ ] Track header: rename (double-click) + remove (×) affordance
- [ ] Reflect soloed state visually (LED/strip)

### Persistence (`src/persistence/db.ts`)
- [ ] `idb` wrapper: open DB `tonic`, store `projects` (key = project id)
- [ ] `saveProject(project)` / `loadProject(id)` / `loadLastProject()`
- [ ] Autosave: subscribe to store, debounce ~500ms, write current project
- [ ] On boot: load last project into the store before first paint (or hydrate + reconcile)

### MCP
- [ ] New tools: `set_track_pan`, `mute_track`, `solo_track`, `rename_track`, `remove_track`,
      `set_master_volume`

### Verification
- [ ] `npm run typecheck` (app + mcp) + `npm run build` pass
- [ ] Browser: add tracks, move faders/pan, mute/solo, reload page → state restored
- [ ] MCP harness: new tools mutate the running app
- [ ] Commit + push (submodule + pointer)

### When done
- [ ] Mark Phase 2 complete in `ROADMAP.md`, empty this file, refill with Phase 3 steps
