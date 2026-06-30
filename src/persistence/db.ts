/**
 * Local-first persistence (IndexedDB via `idb`).
 *
 * Stores:
 *   - `projects` (key = project id) — the serializable project state
 *   - `samples`  (key = sample id)  — raw audio blobs (used from Phase 3 on)
 *   - `meta`     (key/value)        — e.g. the last-opened project id
 *
 * The store stays the single source of truth; this module only mirrors it to disk.
 * Autosave debounces store changes so rapid fader drags don't thrash IndexedDB.
 */
import { openDB, type IDBPDatabase } from "idb";
import { tonicStore } from "@/state/store";
import { loadProjectIntoStore } from "@/state/actions";
import type { Project } from "@/state/types";

const DB_NAME = "tonic";
const DB_VERSION = 1;
const LAST_PROJECT_KEY = "lastProjectId";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("projects")) {
          db.createObjectStore("projects", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("samples")) {
          db.createObjectStore("samples"); // key = sample id (out-of-line)
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta");
        }
      },
    });
  }
  return dbPromise;
}

export async function saveProject(project: Project): Promise<void> {
  const db = await getDB();
  // structuredClone to strip immer draft proxies / functions.
  await db.put("projects", JSON.parse(JSON.stringify(project)));
  await db.put("meta", project.id, LAST_PROJECT_KEY);
}

export async function loadProject(id: string): Promise<Project | undefined> {
  const db = await getDB();
  return db.get("projects", id);
}

export async function loadLastProject(): Promise<Project | undefined> {
  const db = await getDB();
  const id = (await db.get("meta", LAST_PROJECT_KEY)) as string | undefined;
  if (!id) return undefined;
  return db.get("projects", id);
}

// ---- raw sample blobs (Phase 3+) ----

export async function saveSampleBlob(id: string, blob: Blob): Promise<void> {
  const db = await getDB();
  await db.put("samples", blob, id);
}

export async function loadSampleBlob(id: string): Promise<Blob | undefined> {
  const db = await getDB();
  return db.get("samples", id);
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Boot persistence: hydrate the last project (if any) into the store, then start
 * autosaving on every change (debounced). Returns once hydration is done so the
 * engine reconciles against the restored project.
 */
export async function initPersistence(): Promise<void> {
  try {
    const saved = await loadLastProject();
    if (saved && Array.isArray(saved.tracks)) {
      loadProjectIntoStore(saved);
    }
  } catch (err) {
    console.error("[tonic] persistence load failed:", err);
  }

  // Autosave on project changes (debounced).
  tonicStore.subscribe(
    (s) => s.project,
    (project) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void saveProject(project).catch((err) =>
          console.error("[tonic] autosave failed:", err),
        );
      }, 500);
    },
  );
}
