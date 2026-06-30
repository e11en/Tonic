# todo.md — active phase

> See `ROADMAP.md` for all phases. This file holds only the **current** phase, written out as
> concrete steps. When the phase is done, empty this file and refill with the next phase.

## Phase 5 — Instruments & piano roll

**Goal:** instrument tracks that play synthesized notes; a piano-roll editor to place MIDI notes;
notes scheduled via Tone.Part. MCP `place_note`.

**Status:** in progress.

### State / actions
- [ ] `addTrack` sets a default `InstrumentConfig` when kind is "instrument"
- [ ] `addMidiClip(trackId, startSec, bars?)` → clip with `midi:{notes:[]}`
- [ ] `placeNote(trackId, clipId, {pitch, startBeats, durationBeats?, velocity?})` → note id
- [ ] `removeNote(trackId, clipId, noteId)`, `updateNote(...)` (move/resize)
- [ ] protocol + dispatch for `addMidiClip`, `placeNote`, `removeNote`, `updateNote`

### Engine — instrument playback
- [ ] Per instrument track: a `Tone.PolySynth` connected to the track channel (create/dispose)
- [ ] Per MIDI clip: a `Tone.Part` of note events, `start(clip.startSec)`, beats→seconds via tempo;
      diff by id + signature (notes/tempo/start) → rebuild on change, dispose on removal
- [ ] Verify sound via output meter

### UI — piano roll
- [ ] Rail ⌨ opens the piano roll for a selected MIDI clip
- [ ] Grid: ~2 octaves × beats; click empty cell → place note, click note → remove
- [ ] "Add instrument" affordance (adds an instrument track); double-click an instrument lane to
      add a MIDI clip and open the roll

### MCP
- [ ] `add_midi_clip`, `place_note`, `remove_note` (instrument tracks via add_track kind:"instrument")

### Verification
- [ ] `npm run typecheck` (app + mcp) + `npm run build` pass
- [ ] Browser: add instrument track → MIDI clip → place notes in the roll → Play → audible synth
- [ ] MCP harness: add_track(instrument) + add_midi_clip + place_note → notes appear + play
- [ ] Commit + push (submodule + pointer)

### When done
- [ ] Mark Phase 5 complete in `ROADMAP.md`, empty this file, refill with Phase 6 steps
