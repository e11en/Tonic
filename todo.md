# todo.md — active phase

> See `ROADMAP.md` for all phases. This file holds only the **current** phase, written out as
> concrete steps. When the phase is done, empty this file and refill with the next phase.

## Phase 0 — Scaffold

**Status:** functionally complete — verifying.

### Git / repo
- [x] Add Tonic as a git submodule at `projects/tonic/` → `git@github.com:e11en/Tonic.git`
- [x] Register submodule in `.gitmodules` and `home-workspace/.git/config`

### App scaffold
- [x] `package.json` (React 18 + TS + Vite 6, Fase 0 dep subset)
- [x] `tsconfig.json` with `@/` and `@shared/` path aliases
- [x] `vite.config.ts` (react plugin + alias resolution)
- [x] `index.html`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`
- [x] `.gitignore`, `.env.example`

### SoundBlocks design system
- [x] `src/ui/tokens.css` — JetBrains Mono, palette (light/dark), spacing, radii, panel textures
- [x] `src/ui/ui.css` — component styles
- [x] UI shells: `Knob`, `Fader`, `Toggle`, `Button`, `Panel`, `LED`, `Help` (+ `useDragValue`)
- [x] `src/components/AppShell.tsx` — static showcase (transport, tracks, mixer strips)

### State skeletons
- [x] `src/state/types.ts` — Project/Track/Clip/Note/Effect/SampleMeta
- [x] `src/state/store.ts` — vanilla Zustand + immer + subscribeWithSelector, initial Project
- [x] `shared/protocol.ts` — placeholder wire types (so `@shared` resolves)

### MCP stub
- [x] `mcp-server/package.json`, `mcp-server/tsconfig.json`
- [x] `mcp-server/src/index.ts` — stdio `McpServer` + `ping` tool (stderr-only logging)
- [x] Add `tonic` entry to repo-root `/.mcp.json` (run via `npx -y tsx`)

### Verification
- [x] `npm install` (app) and `npm install --prefix mcp-server` succeed
- [x] `npm run typecheck` passes (app + mcp-server)
- [x] `npm run build` produces a bundle
- [x] MCP `ping` returns `"tonic alive"` over the stdio protocol
- [ ] Restart Claude Code → `tonic` MCP server loads and `ping` is callable
- [ ] Browser visual check via the Claude-in-Chrome extension (design system renders)
- [ ] Commit + push Phase 0 in the Tonic submodule; commit submodule pointer in home-workspace

### When done
- [ ] Mark Phase 0 complete in `ROADMAP.md`, empty this file, refill with Phase 1 steps
