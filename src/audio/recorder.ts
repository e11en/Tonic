/**
 * Microphone recording (UI/hardware side).
 *
 * Capturing the mic is a UI action, not an MCP command (hardware doesn't cross the bridge).
 * Flow: open `Tone.UserMedia` → `Tone.Recorder` → stop yields a Blob → decode it into a sample
 * and drop a clip on the armed track. `recordingToClip` is split out so the post-capture
 * pipeline is testable without a real microphone.
 */
import * as Tone from "tone";
import { audioEngine } from "@/audio/engine";
import { importAudioBlob } from "@/audio/samples";
import { addClip, record, stop } from "@/state/actions";

interface Session {
  mic: Tone.UserMedia;
  recorder: Tone.Recorder;
  trackId: string;
  startSec: number;
}

let session: Session | null = null;

export function isRecording(): boolean {
  return session !== null;
}

/** Decode a recorded blob into a sample and place it as a clip on the track. */
export async function recordingToClip(
  blob: Blob,
  trackId: string,
  startSec: number,
): Promise<string | null> {
  const sampleId = await importAudioBlob(
    blob,
    `recording-${new Date().toISOString().slice(11, 19)}.webm`,
    "mic",
  );
  if (!sampleId) return null;
  addClip(trackId, { sampleId, startSec });
  return sampleId;
}

/** Open the mic and start recording onto a track. */
export async function startRecording(trackId: string, startSec = 0): Promise<void> {
  if (session) return;
  await audioEngine.ensureStarted();
  const mic = new Tone.UserMedia();
  await mic.open(); // prompts for mic permission
  const recorder = new Tone.Recorder();
  mic.connect(recorder);
  recorder.start();
  session = { mic, recorder, trackId, startSec };
  record();
}

/** Stop recording; returns the new sample id (clip added to the armed track). */
export async function stopRecording(): Promise<string | null> {
  if (!session) return null;
  const { mic, recorder, trackId, startSec } = session;
  const blob = await recorder.stop();
  mic.close();
  mic.dispose();
  recorder.dispose();
  session = null;
  stop();
  return recordingToClip(blob, trackId, startSec);
}
