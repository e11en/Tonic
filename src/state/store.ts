import { createStore } from "zustand/vanilla";
import { subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { useStore } from "zustand";
import { nanoid } from "nanoid";
import type { Project } from "./types";

/**
 * Single source of truth for Tonic.
 *
 * Created as a VANILLA store so non-React consumers (the audio engine and the
 * WebSocket bridge client, added in Phase 1) can subscribe to the exact same
 * instance that React reads. `subscribeWithSelector` lets those consumers react
 * only to the slices they care about.
 *
 * Phase 0: holds an initial Project only. The mutation surface (`actions.ts`)
 * is intentionally not here yet — it is the single place both UI and the MCP
 * bridge will call to change state in Phase 1.
 */

export interface TonicState {
  project: Project;
}

function createInitialProject(): Project {
  return {
    id: nanoid(),
    name: "Untitled",
    tempo: 120,
    timeSignature: [4, 4],
    transport: { state: "stopped", positionSec: 0, loop: null },
    masterVolumeDb: 0,
    tracks: [],
    samples: {},
  };
}

export const tonicStore = createStore<TonicState>()(
  subscribeWithSelector(
    immer(() => ({
      project: createInitialProject(),
    })),
  ),
);

/** React binding. Use with a selector to avoid unnecessary re-renders. */
export function useTonic<T>(selector: (state: TonicState) => T): T {
  return useStore(tonicStore, selector);
}
