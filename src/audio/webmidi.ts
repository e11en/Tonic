/**
 * Web MIDI input (UI/hardware side).
 *
 * A MIDI keyboard plays the *target* instrument track live (transient — straight to the synth),
 * and while the transport is recording, played notes are captured into the target MIDI clip via
 * `placeNote`. `handleMidiMessage` is split out so the parse → trigger path is testable without
 * a physical device.
 */
import { audioEngine } from "@/audio/engine";
import { placeNote } from "@/state/actions";
import { tonicStore } from "@/state/store";

interface MidiTarget {
  trackId: string;
  clipId?: string; // when set + recording, played notes are captured here
}

let access: MIDIAccess | null = null;
let target: MidiTarget | null = null;
// Notes currently held down (for computing recorded duration), keyed by pitch.
const heldNotes = new Map<number, { startBeats: number }>();

export function setMidiTarget(t: MidiTarget | null): void {
  target = t;
}

export function isMidiEnabled(): boolean {
  return access !== null;
}

export function listInputs(): { id: string; name: string }[] {
  if (!access) return [];
  return Array.from(access.inputs.values()).map((i) => ({ id: i.id, name: i.name ?? i.id }));
}

/** Request Web MIDI access and attach to all inputs. Needs a real device + permission. */
export async function enableMidi(): Promise<{ ok: boolean; inputs: { id: string; name: string }[]; error?: string }> {
  if (!navigator.requestMIDIAccess) {
    return { ok: false, inputs: [], error: "Web MIDI is not supported in this browser." };
  }
  try {
    access = await navigator.requestMIDIAccess();
    await audioEngine.ensureStarted();
    attachAll();
    access.onstatechange = attachAll;
    return { ok: true, inputs: listInputs() };
  } catch (err) {
    return { ok: false, inputs: [], error: err instanceof Error ? err.message : String(err) };
  }
}

function attachAll(): void {
  if (!access) return;
  for (const input of access.inputs.values()) {
    input.onmidimessage = (e: MIDIMessageEvent) => {
      if (e.data) handleMidiMessage(Array.from(e.data));
    };
  }
}

/**
 * Parse one MIDI message and act on it. Exported for testing.
 * status 0x90 = note on, 0x80 = note off (note on with velocity 0 also = note off).
 */
export function handleMidiMessage(data: number[]): void {
  const [status, d1, d2] = data;
  const command = status & 0xf0;
  const pitch = d1;
  const velocity = (d2 ?? 0) / 127;

  if (command === 0x90 && velocity > 0) {
    noteOn(pitch, velocity);
  } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
    noteOff(pitch);
  }
}

function currentBeatInClip(clipId: string): number {
  const project = tonicStore.getState().project;
  const secPerBeat = 60 / project.tempo;
  let clipStart = 0;
  for (const track of project.tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) {
      clipStart = clip.startSec;
      break;
    }
  }
  return Math.max(0, (audioEngine.transportSeconds() - clipStart) / secPerBeat);
}

function noteOn(pitch: number, velocity: number): void {
  if (!target) return;
  audioEngine.noteOn(target.trackId, pitch, velocity);
  // Capture into the clip while recording.
  if (target.clipId && tonicStore.getState().project.transport.state === "recording") {
    heldNotes.set(pitch, { startBeats: currentBeatInClip(target.clipId) });
  }
}

function noteOff(pitch: number): void {
  if (!target) return;
  audioEngine.noteOff(target.trackId, pitch);
  const held = heldNotes.get(pitch);
  if (held && target.clipId) {
    heldNotes.delete(pitch);
    const end = currentBeatInClip(target.clipId);
    placeNote(target.trackId, target.clipId, {
      pitch,
      startBeats: held.startBeats,
      durationBeats: Math.max(0.25, end - held.startBeats),
    });
  }
}
