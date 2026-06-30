# todo.md — active phase

> See `ROADMAP.md` for all phases. This file holds only the **current** phase, written out as
> concrete steps. When the phase is done, empty this file and refill with the next phase.

## Phase 4 — Recording

**Goal:** record the microphone onto an armed track; recordings become samples + clips. Loop region
so playback (and recording) can loop.

**Status:** in progress.

### State / actions
- [ ] `armTrack(trackId, armed)`; `setLoopRegion(startSec, endSec)`, `clearLoopRegion()`
- [ ] transport `record()` (state "recording") + reuse `stop()`
- [ ] protocol + dispatch for `armTrack`, `setLoopRegion`, `clearLoopRegion`

### Engine
- [ ] Treat "recording" like "playing" for the transport clock (start/stop)
- [ ] Apply loop region: `transport.loop`/`loopStart`/`loopEnd`; clear when null
- [ ] Expose loop state in `debugInfo()`

### Recorder (`src/audio/recorder.ts`) — UI/hardware side
- [ ] `startRecording(trackId, startSec)`: `Tone.UserMedia` → `Tone.Recorder`, set state recording
- [ ] `stopRecording()`: stop recorder → Blob → `recordingToClip`
- [ ] `recordingToClip(blob, trackId, startSec)`: decode + cache + persist as sample, then addClip
      (separately testable without a real mic)

### UI
- [ ] Lane head: arm toggle (R)
- [ ] Transport: Record button (records onto an armed track; arms the first track if none)
- [ ] Loop region control (set/clear) + visual loop marker on the timeline
- [ ] Recording indicator (LED/state)

### MCP
- [ ] `arm_track`, `set_loop_region`, `clear_loop_region` (mic capture stays a UI action)

### Verification
- [ ] `npm run typecheck` (app + mcp) + `npm run build` pass
- [ ] Loop region: set via MCP/UI → engine transport loops (debugInfo)
- [ ] `recordingToClip` with a synthetic blob → new sample + clip appears + plays
- [ ] arm toggle works; honest note on real-mic capture (needs hardware/permission)
- [ ] Commit + push (submodule + pointer)

### When done
- [ ] Mark Phase 4 complete in `ROADMAP.md`, empty this file, refill with Phase 5 steps
