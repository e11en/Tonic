# todo.md — active phase

> See `ROADMAP.md` for all phases. This file holds only the **current** phase, written out as
> concrete steps. When the phase is done, empty this file and refill with the next phase.

## Phase 3 — Samples & playback

**Goal:** upload audio, see clips on a timeline, and actually hear them play through the mixer.
First phase that produces sound.

**Status:** in progress.

### State / actions
- [ ] `addSample(meta)`, `removeSample(id)` (store holds only `SampleMeta`)
- [ ] `addClip(trackId, {sampleId, startSec, durationSec?, offsetSec?, gainDb?})` → returns clip id
      (duration defaults to the sample's duration)
- [ ] `moveClip(trackId, clipId, startSec)`, `removeClip(trackId, clipId)`
- [ ] Extend `dispatch()` + protocol for `addClip`, `moveClip`, `removeClip`

### Sample pipeline (`src/audio/samples.ts`)
- [ ] `importSampleFile(file)`: decode via AudioContext, cache the Tone buffer in the engine,
      save the blob to IndexedDB, `addSample(meta)`; return sample id

### Engine — clip playback
- [ ] Buffer cache keyed by sample id; `cacheBuffer` + lazy `loadSampleBuffer` (from IndexedDB)
      that re-reconciles when a buffer finishes loading (so restored projects play)
- [ ] Per-clip `Tone.Player` connected to the track channel, `sync().start(startSec, offsetSec)`;
      diff clips by id + a signature (sampleId/start/offset/duration) → rebuild on change, dispose
      on removal

### UI
- [ ] Rail buttons select an active side panel; 📁 opens a Sample browser
- [ ] Sample browser: upload (wav/mp3) + list (name, duration); "add to track" affordance
- [ ] Timeline: render clips as positioned blocks in the lane strip (px/sec scale), drag
      horizontally to move (→ `moveClip`), double-click to remove

### MCP
- [ ] `list_samples`, `add_clip` (trackId, sampleId, startSec), `remove_clip`
- [ ] (uploading binary audio stays a UI action — note this in tool descriptions)

### Verification
- [ ] `npm run typecheck` (app + mcp) + `npm run build` pass
- [ ] Browser: upload a sample → clip appears → Play → audible; drag clip; reload → restored + plays
- [ ] MCP harness: `add_clip` against an uploaded sample shows + plays
- [ ] Commit + push (submodule + pointer)

### When done
- [ ] Mark Phase 3 complete in `ROADMAP.md`, empty this file, refill with Phase 4 steps
