/**
 * Audio engine — a pure *reader/reconciler* of the store. It never writes state.
 *
 * On boot it subscribes to the project slice and, on every change, diffs the desired
 * audio graph against the live Tone.js nodes:
 *   - transport tempo + play/stop
 *   - master volume
 *   - one `Tone.Channel` per track, keyed by track id (created / `rampTo`-updated / disposed)
 *
 * Param changes ramp (no node rebuild); only structural changes (a track appearing or
 * disappearing) create/dispose nodes. Phase 1 has no clips yet, so channels are silent
 * carriers — they prove volume/pan/mute reconcile before Phase 3 adds players.
 *
 * Browser autoplay policy: the AudioContext starts suspended. `ensureStarted()` must be
 * called from a user gesture (e.g. the Play button) before sound can be heard.
 */
import * as Tone from "tone";
import { tonicStore } from "@/state/store";
import type { Project } from "@/state/types";

const RAMP_SEC = 0.03;

class AudioEngine {
  private channels = new Map<string, Tone.Channel>();
  private unsubscribe?: () => void;
  private started = false;
  private booted = false;

  /** Subscribe to the store and reconcile immediately. Idempotent. */
  init(): void {
    if (this.booted) return;
    this.booted = true;
    this.unsubscribe = tonicStore.subscribe(
      (s) => s.project,
      (project) => this.reconcile(project),
      { fireImmediately: true },
    );
  }

  /** Unlock the AudioContext. Call from a user gesture. */
  async ensureStarted(): Promise<void> {
    if (this.started) return;
    await Tone.start();
    this.started = true;
    // Re-apply the current transport intent now that the clock can actually run.
    this.reconcile(tonicStore.getState().project);
  }

  isStarted(): boolean {
    return this.started;
  }

  private reconcile(project: Project): void {
    const transport = Tone.getTransport();

    // Tempo + master volume (smooth ramps, no rebuild).
    transport.bpm.rampTo(project.tempo, RAMP_SEC);
    Tone.getDestination().volume.rampTo(project.masterVolumeDb, RAMP_SEC);

    // Transport play/stop. Only the audio context being live lets this make sound.
    if (project.transport.state === "playing" && transport.state !== "started") {
      transport.start();
    } else if (project.transport.state !== "playing" && transport.state === "started") {
      transport.stop();
    }

    // Solo logic: if any track is soloed, only soloed tracks are audible.
    const anySoloed = project.tracks.some((t) => t.soloed);

    // Tracks: diff by id.
    const seen = new Set<string>();
    for (const track of project.tracks) {
      seen.add(track.id);
      let channel = this.channels.get(track.id);
      if (!channel) {
        channel = new Tone.Channel().toDestination();
        this.channels.set(track.id, channel);
      }
      channel.volume.rampTo(track.volumeDb, RAMP_SEC);
      channel.pan.rampTo(track.pan, RAMP_SEC);
      // Effective mute = explicit mute OR (something is soloed and this track isn't).
      channel.mute = track.muted || (anySoloed && !track.soloed);
    }

    // Dispose channels for tracks that no longer exist.
    for (const [id, channel] of this.channels) {
      if (!seen.has(id)) {
        channel.dispose();
        this.channels.delete(id);
      }
    }
  }

  /** Tear down (not used in app lifetime; handy for tests/HMR). */
  dispose(): void {
    this.unsubscribe?.();
    for (const channel of this.channels.values()) channel.dispose();
    this.channels.clear();
    this.booted = false;
  }
}

export const audioEngine = new AudioEngine();
