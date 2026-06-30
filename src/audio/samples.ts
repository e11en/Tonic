/**
 * Sample import pipeline (UI side).
 *
 * Uploading binary audio is a UI action (not an MCP command). The flow:
 *   file -> decode (AudioContext) -> cache the Tone buffer in the engine
 *        -> persist the blob to IndexedDB -> register SampleMeta in the store.
 *
 * The store only ever holds the lightweight `SampleMeta`; the decoded buffer lives in
 * the engine cache and the raw blob in IndexedDB (so it survives a reload).
 */
import { nanoid } from "nanoid";
import { audioEngine, decodeToToneBuffer } from "@/audio/engine";
import { saveSampleBlob } from "@/persistence/db";
import { addSample } from "@/state/actions";
import type { SampleMeta } from "@/state/types";

const AUDIO_EXT = /\.(wav|mp3|ogg|flac|m4a|aac|webm)$/i;

export function isAudioFile(file: File): boolean {
  return file.type.startsWith("audio/") || AUDIO_EXT.test(file.name);
}

/**
 * Decode an audio blob, cache its buffer in the engine, persist the blob to IndexedDB,
 * and register its SampleMeta. Returns the new sample id, or null on failure.
 * Shared by file upload and microphone recording.
 */
export async function importAudioBlob(
  blob: Blob,
  name: string,
  source: SampleMeta["source"] = "upload",
): Promise<string | null> {
  try {
    const id = nanoid();
    const arrayBuffer = await blob.arrayBuffer();
    // decodeAudioData detaches the buffer, so decode from a copy and keep the blob.
    const buffer = await decodeToToneBuffer(arrayBuffer.slice(0));

    audioEngine.cacheBuffer(id, buffer);
    await saveSampleBlob(id, blob);

    const meta: SampleMeta = {
      id,
      name,
      source,
      durationSec: buffer.duration,
      channels: buffer.numberOfChannels,
    };
    addSample(meta);
    return id;
  } catch (err) {
    console.error("[tonic] sample import failed:", name, err);
    return null;
  }
}

/** Import one audio file. Returns the new sample id, or null on failure. */
export function importSampleFile(file: File): Promise<string | null> {
  return importAudioBlob(file, file.name, "upload");
}
