# todo.md — active phase

> See `ROADMAP.md` for all phases. This file holds only the **current** phase, written out as
> concrete steps. When the phase is done, empty this file and refill with the next phase.

## Phase 6 — Drum machine

**Goal:** a step sequencer with a built-in synthesized drum kit (no uploads needed). Pattern clips
loop on a drum track. MCP can toggle steps.

**Status:** in progress.

### State / actions
- [ ] `addDrumTrack()` → drum track + a default 16-step pattern clip (kick/snare/hihat lanes)
- [ ] `toggleStep(trackId, clipId, laneIndex, step)`, `setStep(...)`
- [ ] protocol + dispatch for `addDrumTrack`, `setStep`

### Engine — drum playback
- [ ] Synthesized voices per drum track (kick=MembraneSynth, snare/clap/hihat=Noise/MetalSynth),
      connected to the track channel; create/dispose with the track
- [ ] Per pattern clip: a looping `Tone.Sequence` over the steps, firing the voices whose hit is set;
      diff by id + signature (pattern/tempo) → rebuild on edit, dispose on removal
- [ ] Verify audible via the output meter

### UI — step sequencer
- [ ] DrumMachine grid (lanes × steps); click a step to toggle; lane labels; beat grouping
- [ ] Reuse the clip editor slot: pattern clips open the DrumMachine, MIDI clips open the PianoRoll
- [ ] "+ Add drums" affordance

### MCP
- [ ] `add_drum_track`, `set_step` (and pattern visible in get_project)

### Verification
- [ ] `npm run typecheck` (app + mcp) + `npm run build` pass
- [ ] Browser: add drums → toggle steps → Play → audible beat
- [ ] MCP harness: add_drum_track + set_step → pattern updates + plays
- [ ] Commit + push (submodule + pointer)

### When done
- [ ] Mark Phase 6 complete in `ROADMAP.md`, empty this file, refill with Phase 7 steps
