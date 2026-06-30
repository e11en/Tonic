# todo.md — active phase

> See `ROADMAP.md` for all phases. This file holds only the **current** phase, written out as
> concrete steps. When the phase is done, empty this file and refill with the next phase.

## Phase 7 — Effects

**Goal:** a per-track effects rack (EQ3, reverb, delay, distortion, chorus, compressor) inserted in
the signal chain, editable live. MCP add_effect / set_effect_param.

**Status:** in progress.

### Effects module (`src/audio/effects.ts`)
- [ ] `EFFECT_SPECS` (params + ranges per type), `defaultParams(type)`
- [ ] `createEffectNode(effect)` → Tone node; `applyParams(node, type, params)` for live edits

### Engine — chain rewiring
- [ ] Per track: a `trackInput` Gain that all sources (players/instruments/drum kits) feed
- [ ] Chain: trackInput → enabled effects → channel (vol/pan/mute) → master
- [ ] reconcileEffects: rebuild the chain only on structural change (type/enabled/order); apply
      param changes live in place; dispose nodes with the track

### State / actions
- [ ] `addEffect(trackId, type)`, `removeEffect`, `setEffectEnabled`, `setEffectParam`
- [ ] protocol + dispatch

### UI — effects rack
- [ ] Mixer strip "FX" button opens the rack for that track
- [ ] Rack: add-effect menu; per effect: enable toggle, remove, param knobs (from EFFECT_SPECS)

### MCP
- [ ] `add_effect`, `remove_effect`, `set_effect_enabled`, `set_effect_param`

### Verification
- [ ] `npm run typecheck` (app + mcp) + `npm run build` pass
- [ ] Browser: add an effect to a sounding track → audible change; tweak params live
- [ ] MCP harness: add_effect + set_effect_param reflected in get_project + chain
- [ ] Commit + push (submodule + pointer)

### When done
- [ ] Mark Phase 7 complete in `ROADMAP.md`, empty this file, refill with Phase 8 steps
