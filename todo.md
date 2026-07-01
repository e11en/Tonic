# todo.md — active phase

> See `ROADMAP.md` for all phases. This file holds only the **current** phase, written out as
> concrete steps. When the phase is done, empty this file and refill with the next phase.

## Phase 8 — Web MIDI

**Goal:** play instrument tracks live from a MIDI keyboard, and record played notes into the piano
roll. (Hardware input is a UI concern — no MCP tools.)

**Status:** in progress.

### Engine — live note triggering
- [ ] `noteOn(trackId, pitch, velocity)` / `noteOff(trackId, pitch)` → trigger the track's PolySynth
      directly (transient performance, not store state)

### Web MIDI module (`src/audio/webmidi.ts`)
- [ ] `enableMidi()` via `navigator.requestMIDIAccess()`; list + select inputs
- [ ] `handleMidiMessage([status,d1,d2])` — parse note on/off → engine note trigger; testable
      without hardware
- [ ] Target instrument track + optional record clip; while transport is "recording", capture
      played notes into the clip (start/duration in beats from the transport position) via `placeNote`

### UI
- [ ] Piano roll: "Enable MIDI" button + input selector + status; sets the MIDI target to this
      track/clip so the keyboard plays this instrument (and records when armed/recording)

### Verification
- [ ] `npm run typecheck` + `npm run build` pass
- [ ] `noteOn/noteOff` produce sound (output meter)
- [ ] Simulated MIDI message → live note sounds; during recording → a note lands in the clip
- [ ] Honest note: real device enable needs hardware/permission (wired, not auto-tested)
- [ ] Commit + push (submodule + pointer)

### When done
- [ ] Mark Phase 8 complete in `ROADMAP.md`, empty this file, refill with Phase 9 steps
