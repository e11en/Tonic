# Roadmap — Tonic

**Status:** 🟢 Phase 0 in progress · local-first web DAW with a live MCP bridge

High-level phases only. When a phase is picked up, its concrete steps are written out in
`todo.md` (see the documentation workflow in `CLAUDE.md`). The MCP bridge is intentionally pulled
forward to Phase 1 because the "single source of truth + bridge" architecture is the most
distinctive and riskiest part — proving it early validates the whole spine.

---

- [ ] **Phase 0 — Scaffold** 🟢 *in progress*
  Vite + React + TS app, design tokens (JetBrains Mono, palette, textures), UI shells
  (Knob/Fader/Toggle/Button/Panel/LED/Help), static AppShell, state skeletons, and a ping-only
  MCP stub registered in the root `.mcp.json`.

- [ ] **Phase 1 — Vertical slice + bridge spine**
  Zustand store + `actions.ts` (`addTrack`, `setTrackVolume`, `setTempo`, `play`, `stop`). Minimal
  Tone.js engine (Transport + per-track Channel, reconcile-on-subscribe). Transport bar + one
  working track lane/fader. WS bridge in the MCP server + matching tools. **Acceptance:** from
  Claude, add a track and change tempo/volume and see+hear the running browser app react.

- [ ] **Phase 2 — Tracks, mixer, persistence**
  Multi-track lane list, full mixer with channel strips (volume/pan/mute/solo) + master strip,
  IndexedDB autosave/load.

- [ ] **Phase 3 — Samples & playback**
  Upload wav/mp3 → decode → IndexedDB + cache. Audio clips on the timeline (Tone.Player), drag to
  move. Sample browser. MCP `add_clip`.

- [ ] **Phase 4 — Recording**
  Microphone recording (getUserMedia) onto an armed track; loop region + loop record; recordings
  become samples + clips.

- [ ] **Phase 5 — Instruments & piano roll**
  Instrument track (PolySynth/Sampler), piano-roll editor producing MIDI clips scheduled via
  Tone.Part. MCP `place_note`.

- [ ] **Phase 6 — Drum machine**
  Step sequencer (Tone.Sequence) with drum-kit samples; pattern clips.

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
