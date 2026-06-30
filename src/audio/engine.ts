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
import { loadSampleBlob } from "@/persistence/db";
import type { Project } from "@/state/types";

const RAMP_SEC = 0.03;

/** Decode raw audio bytes into a Tone buffer (used by upload + restore paths). */
export async function decodeToToneBuffer(
  arrayBuffer: ArrayBuffer,
): Promise<Tone.ToneAudioBuffer> {
  const ctx = Tone.getContext().rawContext as unknown as BaseAudioContext;
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  return new Tone.ToneAudioBuffer(audioBuffer);
}

interface PlayerEntry {
  player: Tone.Player;
  sig: string;
}

class AudioEngine {
  private channels = new Map<string, Tone.Channel>();
  private buffers = new Map<string, Tone.ToneAudioBuffer>();
  private loadingBuffers = new Set<string>();
  private players = new Map<string, PlayerEntry>(); // keyed by clip id
  private unsubscribe?: () => void;
  private started = false;
  private booted = false;
  private meter: Tone.Meter | null = null;
  private master: Tone.Channel | null = null;

  /** Subscribe to the store and reconcile immediately. Idempotent. */
  init(): void {
    if (this.booted) return;
    this.booted = true;
    // Master bus: every track channel feeds this, then a meter (for level
    // measurement), then the speakers. Inline so the meter sees real signal.
    this.master = new Tone.Channel();
    this.meter = new Tone.Meter({ channels: 1 });
    this.master.chain(this.meter, Tone.getDestination());
    this.unsubscribe = tonicStore.subscribe(
      (s) => s.project,
      (project) => this.reconcile(project),
      { fireImmediately: true },
    );
  }

  /** Current master output level in dB (−Infinity when silent). */
  outputLevelDb(): number {
    const v = this.meter?.getValue();
    if (v === undefined) return -Infinity;
    return Array.isArray(v) ? Math.max(...v) : v;
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

  /** Snapshot of engine internals for debugging/verification (dev only). */
  debugInfo(): {
    started: boolean;
    contextState: string;
    transportState: string;
    channels: number;
    players: number;
    buffers: number;
  } {
    return {
      started: this.started,
      contextState: Tone.getContext().state,
      transportState: Tone.getTransport().state,
      channels: this.channels.size,
      players: this.players.size,
      buffers: this.buffers.size,
    };
  }

  /** Store a decoded buffer for a sample id (called by the upload pipeline). */
  cacheBuffer(sampleId: string, buffer: Tone.ToneAudioBuffer): void {
    this.buffers.get(sampleId)?.dispose();
    this.buffers.set(sampleId, buffer);
    // A buffer just became available — rebuild any clips waiting on it.
    this.reconcile(tonicStore.getState().project);
  }

  /** Lazily load + decode a sample blob from IndexedDB, then re-reconcile. */
  private ensureBuffer(sampleId: string): void {
    if (this.buffers.has(sampleId) || this.loadingBuffers.has(sampleId)) return;
    this.loadingBuffers.add(sampleId);
    loadSampleBlob(sampleId)
      .then(async (blob) => {
        if (blob) {
          const buf = await decodeToToneBuffer(await blob.arrayBuffer());
          this.buffers.set(sampleId, buf);
        }
      })
      .catch((err) => console.error("[tonic] sample load failed:", sampleId, err))
      .finally(() => {
        this.loadingBuffers.delete(sampleId);
        this.reconcile(tonicStore.getState().project);
      });
  }

  private reconcile(project: Project): void {
    const transport = Tone.getTransport();

    // Tempo + master volume (smooth ramps, no rebuild).
    transport.bpm.rampTo(project.tempo, RAMP_SEC);
    this.master?.volume.rampTo(project.masterVolumeDb, RAMP_SEC);

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
        channel = new Tone.Channel();
        if (this.master) channel.connect(this.master);
        else channel.toDestination();
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

    this.reconcileClips(project);
  }

  /** Build/update/dispose per-clip Tone.Players, synced to the transport. */
  private reconcileClips(project: Project): void {
    const seenClips = new Set<string>();

    for (const track of project.tracks) {
      const channel = this.channels.get(track.id);
      if (!channel) continue;
      for (const clip of track.clips) {
        if (!clip.audio) continue; // Phase 3 handles audio clips only
        seenClips.add(clip.id);

        const buffer = this.buffers.get(clip.audio.sampleId);
        if (!buffer || !buffer.loaded) {
          this.ensureBuffer(clip.audio.sampleId);
          continue; // a later reconcile builds the player once decoded
        }

        const sig = [
          track.id,
          clip.audio.sampleId,
          clip.startSec,
          clip.durationSec,
          clip.audio.offsetSec,
          clip.audio.gainDb,
        ].join("|");

        const existing = this.players.get(clip.id);
        if (existing && existing.sig === sig) continue;
        existing?.player.dispose();

        const player = new Tone.Player(buffer).connect(channel);
        player.volume.value = clip.audio.gainDb;
        // Schedule on the transport timeline: start at clip.startSec, reading from
        // offsetSec into the sample, for durationSec.
        player.sync().start(clip.startSec, clip.audio.offsetSec, clip.durationSec);
        this.players.set(clip.id, { player, sig });
      }
    }

    // Dispose players whose clips were removed.
    for (const [clipId, entry] of this.players) {
      if (!seenClips.has(clipId)) {
        entry.player.dispose();
        this.players.delete(clipId);
      }
    }
  }

  /** Tear down (not used in app lifetime; handy for tests/HMR). */
  dispose(): void {
    this.unsubscribe?.();
    for (const entry of this.players.values()) entry.player.dispose();
    this.players.clear();
    for (const channel of this.channels.values()) channel.dispose();
    this.channels.clear();
    for (const buffer of this.buffers.values()) buffer.dispose();
    this.buffers.clear();
    this.meter?.dispose();
    this.master?.dispose();
    this.meter = null;
    this.master = null;
    this.booted = false;
  }
}

export const audioEngine = new AudioEngine();
