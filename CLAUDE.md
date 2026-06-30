# CLAUDE.md — Tonic

Guidance for Claude Code when working in the Tonic project.

---

## What Tonic is

Tonic is a **beginner-friendly, local-first web DAW** (Digital Audio Workstation). The goal is to
be radically simpler and less overwhelming than existing web DAWs (gridsound, openDAW, web-synth,
dawg, EIM). A layperson should be able to start making music immediately: MIDI input, microphone
recording, loops, a piano roll, custom samples (mic or wav/mp3), a drum machine, a multi-track
timeline with per-track volume faders, and effects — all with **inline help buttons** that explain
what things do.

A distinctive feature: a built-in **MCP live bridge** so Claude can drive the *running* browser
app in real time (add tracks, change settings, play/stop) through the exact same action layer the
UI uses.

Visual style follows the **SoundBlocks** design system: skeuomorphic, Teenage-Engineering /
Korg-Volca inspired, JetBrains Mono, knobs / faders / toggles / panel textures.

This repo is a **git submodule** (`git@github.com:e11en/Tonic.git`) mounted at `projects/tonic/`
inside the `home-workspace` monorepo.

---

## Documentation workflow (IMPORTANT — follow exactly)

Tonic uses a strict three-document hierarchy. This is a tighter variant of the workspace
convention:

- **`ROADMAP.md`** — high-level phases only. No detailed steps.
- **`todo.md`** — only the **currently active** phase, written out as concrete, checkable steps
  (`- [ ]`).
- **`CLAUDE.md`** — this file: static reference (what Tonic is, architecture, how to develop).

The loop when picking up work:

1. Pick the next phase from `ROADMAP.md`.
2. **Write it out** in `todo.md` as concrete `- [ ]` steps.
3. **Check items off** in `todo.md` as you complete them.
4. When the phase is done: mark it complete in `ROADMAP.md`, **empty `todo.md`**, and refill it
   with the next phase's steps.

Code and docs in **English**; conversation with the user in **Dutch**.

---

## Architecture (reference — fully implemented from Phase 1)

**Single source of truth:** project state is authoritative. The UI and the MCP bridge are just two
*writers*; the audio engine is a pure *reader/reconciler*. UI clicks and MCP commands are
indistinguishable downstream because both funnel through the same action layer.

```
Claude ──stdio──▶ MCP server ──in-proc──▶ WS bridge ──ws://127.0.0.1:8765──▶ browser
                                                                                │
  React UI ──┐                                                                  │
             ├─▶ actions.ts ─▶ Zustand store ─┬─▶ React re-render (selector)    │
  wsClient ──┘   (only mutation path)         └─▶ audioEngine.reconcile ─▶ Tone.js ─▶ 🔊
                                                     │
  browser pushes snapshot back over WS ◀─────────────┘
```

Key decisions:

- **State:** Zustand **vanilla** store (`createStore`) + `immer` + `subscribeWithSelector`, so the
  plain-TS audio engine and WS client subscribe to the same instance React reads. See
  `src/state/store.ts`.
- **Audio engine is a reconciler:** builds Tone nodes on boot, then diffs store changes by ID.
  Param changes use `rampTo` (no rebuild); only structural changes rebuild a track/effect chain.
- **Audio buffers are NOT in the store** — only `SampleMeta`. Blobs live in IndexedDB; decoded
  buffers in an engine cache. Keeps snapshots small for the bridge.
- **MCP + bridge in one Node process** (`mcp-server/`): `@modelcontextprotocol/sdk` over stdio +
  a `ws` server. The browser is authoritative and pushes snapshots; the bridge keeps
  `lastSnapshot`. **Log only to `console.error`** — stdout is the MCP channel.

Two corrections baked in from planning:

1. `npm run dev` starts **only Vite**. Claude Code spawns the stdio MCP server via `.mcp.json`; the
   WS bridge lives inside that process. Do **not** also launch it via `concurrently` (port fight).
2. Phase 0 ships a minimal **ping-only** MCP stub (no WS) so the `.mcp.json` entry loads cleanly.
   The WS bridge + real tools are Phase 1.

---

## Tech stack

- **Frontend:** React 18 + TypeScript + Vite 6
- **Audio:** Tone.js (built on the Web Audio API) — added in Phase 1
- **State:** Zustand (vanilla) + immer
- **Storage:** local-first — IndexedDB (`idb`) for projects + sample blobs — added in Phase 2
- **MCP:** `@modelcontextprotocol/sdk` (stdio) + `ws` (bridge) in `mcp-server/`
- **Design system:** custom SoundBlocks recreation in `src/ui/` (JetBrains Mono via `@fontsource`)

Path aliases: `@/*` → `src/*`, `@shared/*` → `shared/*`.

---

## Development

```bash
cd projects/tonic
npm install                       # app deps
npm install --prefix mcp-server   # MCP server deps
npm run dev                       # Vite dev server at http://localhost:5173
```

The MCP server is launched by Claude Code via the repo-root `/.mcp.json` (`npx -y tsx
projects/tonic/mcp-server/src/index.ts`). After editing it, restart Claude Code to reload.

Other scripts: `npm run build`, `npm run typecheck`, and in `mcp-server/`: `npm run build`,
`npm run typecheck`.

---

## Project layout

```
src/
  state/      store.ts (vanilla Zustand)  types.ts  [actions.ts, selectors.ts — Phase 1]
  audio/      [engine.ts reconciler + Tone wrappers — Phase 1+]
  bridge/     [wsClient.ts — Phase 1]
  persistence/[db.ts IndexedDB — Phase 2]
  ui/         tokens.css  ui.css  Knob/Fader/Toggle/Button/Panel/LED/Help
  components/ AppShell.tsx (+ shell.css)  [feature views per phase]
  help/       [plain-language help copy]
shared/       protocol.ts (wire contract — placeholder until Phase 1)
mcp-server/   src/index.ts (stdio + ping; WS bridge + tools in Phase 1)
```

---

## Guidelines

- **Single-source-of-truth discipline:** from Phase 1, only `src/state/actions.ts` may write to the
  store. The audio engine and bridge are read-only consumers + action callers. No UI control may
  touch Tone.js directly.
- **Beginner focus:** add a `Help` button next to anything a layperson might not understand.
- **MCP stdio safety:** never `console.log` in `mcp-server/` — use `console.error`.
- Keep `ROADMAP.md` high-level and `todo.md` scoped to the active phase (see workflow above).
