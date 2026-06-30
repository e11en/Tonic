# Roadmap — Tonic

**Status:** 🟢 Phase 1 in progress · local-first web DAW with a live MCP bridge

High-level phases only. When a phase is picked up, its concrete steps are written out in
`todo.md` (see the documentation workflow in `CLAUDE.md`). The MCP bridge is intentionally pulled
forward to Phase 1 because the "single source of truth + bridge" architecture is the most
distinctive and riskiest part — proving it early validates the whole spine.

---

- [x] **Phase 0 — Scaffold** ✅ *complete*
  Vite + React + TS app, design tokens (JetBrains Mono, palette, textures), UI shells
  (Knob/Fader/Toggle/Button/Panel/LED/Help), static AppShell, state skeletons, and a ping-only
  MCP stub registered in the root `.mcp.json`.

- [x] **Phase 1 — Vertical slice + bridge spine** ✅ *complete*
  Zustand store + `actions.ts` (`addTrack`, `setTrackVolume`, `setTempo`, `play`, `stop`). Minimal
  Tone.js engine (Transport + per-track Channel, reconcile-on-subscribe). Transport bar + one
  working track lane/fader. WS bridge in the MCP server + matching tools. Verified end-to-end via
  an MCP test harness (MCP→app and app→MCP both proven).

- [x] **Phase 2 — Tracks, mixer, persistence** ✅ *complete*
  Multi-track lane list, full mixer with channel strips (volume/pan/mute/solo) + master strip,
  IndexedDB autosave/load. Verified: UI mixer + reload-restores-state in-browser; new MCP tools
  (set_track_pan, mute_track, solo_track, set_master_volume, rename_track, remove_track) via harness.

- [x] **Phase 3 — Samples & playback** ✅ *complete*
  Upload wav/mp3 → decode → IndexedDB + cache. Audio clips on the timeline (Tone.Player), drag to
  move. Sample browser. MCP `add_clip`. Verified: imported a sample, placed a clip, pressed Play
  and measured master output (−20 dB, audible) — audio survives a full reload (buffer re-decoded
  from IndexedDB). MCP list_samples/add_clip/move_clip/remove_clip via harness.

- [x] **Phase 4 — Recording** ✅ *complete*
  Microphone recording (Tone.UserMedia + Tone.Recorder) onto an armed track; loop region; recordings
  become samples + clips. Verified: recordingToClip (post-capture pipeline) with a synthetic blob →
  new sample + clip; loop region engages the transport loop; arm/loop MCP tools via harness. Live
  mic capture needs real hardware + permission (wired, not auto-tested).

- [x] **Phase 5 — Instruments & piano roll** ✅ *complete*
  Instrument track (Tone.PolySynth), piano-roll editor producing MIDI clips scheduled via
  Tone.Part. MCP `place_note`. Verified: instrument track + MIDI clip + notes → Play → audible
  synth melody (−16 dB); piano roll renders/edits notes; MCP add_midi_clip/place_note/remove_note.

- [x] **Phase 6 — Drum machine** ✅ *complete*
  Step sequencer (Tone.Sequence) with a built-in synthesized kit (kick/snare/hi-hat/clap/tom);
  looping pattern clips. Verified: programmed a beat → Play → audible (−12 dB); DrumMachine grid;
  MCP add_drum_track + set_step (kick [0,8], snare [4] confirmed in the running app).

- [ ] **Phase 7 — Effects**
  Per-track effects rack (EQ3/reverb/delay/distortion/chorus/compressor), chain rewiring in the
  reconciler, MCP `add_effect` / `set_effect_param`.

- [ ] **Phase 8 — Web MIDI**
  Web MIDI API input → play instruments live and record into the piano roll.

- [ ] **Phase 9 — Beginner polish**
  Inline help everywhere, presets, onboarding, friendly defaults, empty-state guidance.

---

## Decisions

| Date       | Decision                                                                 | Reason |
|------------|--------------------------------------------------------------------------|--------|
| 2026-06-26 | React + TS + Vite, Tone.js, local-first, MCP live bridge                  | Confirmed with user |
| 2026-06-26 | Own GitHub repo `e11en/Tonic` as a submodule at `projects/tonic/`        | Consistent with racing-game/home-manager |
| 2026-06-26 | `npm run dev` runs Vite only; MCP server spawned via `.mcp.json`         | Avoid WS port 8765 conflict |
| 2026-06-26 | Phase 0 MCP is a ping-only stub; WS bridge + tools in Phase 1            | Valid loading `.mcp.json` entry without bridge complexity |
