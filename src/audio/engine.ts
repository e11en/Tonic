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
import { createDrumKit, type DrumKitNodes } from "@/audio/drums";
import { createEffectNode, applyParams } from "@/audio/effects";
import type { Project, Track } from "@/state/types";

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

interface PartEntry {
  part: Tone.Part;
  sig: string;
}

interface SequenceEntry {
  seq: Tone.Sequence<number>;
  sig: string;
}

interface EffectChainEntry {
  structSig: string;
  nodes: Map<string, Tone.ToneAudioNode>; // keyed by effect id, only enabled effects
}

class AudioEngine {
  private channels = new Map<string, Tone.Channel>();
  private inputs = new Map<string, Tone.Gain>(); // per-track effects-chain input bus
  private effectChains = new Map<string, EffectChainEntry>();
  private buffers = new Map<string, Tone.ToneAudioBuffer>();
  private loadingBuffers = new Set<string>();
  private players = new Map<string, PlayerEntry>(); // keyed by clip id
  private instruments = new Map<string, Tone.PolySynth>(); // keyed by track id
  private parts = new Map<string, PartEntry>(); // keyed by clip id
  private drumKits = new Map<string, DrumKitNodes>(); // keyed by track id
  private sequences = new Map<string, SequenceEntry>(); // keyed by clip id
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
    this.meter = new Tone.Meter();
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
    loop: boolean;
    loopStart: number;
    loopEnd: number;
    channels: number;
    players: number;
    buffers: number;
    instruments: number;
    parts: number;
  } {
    const transport = Tone.getTransport();
    return {
      started: this.started,
      contextState: Tone.getContext().state,
      transportState: transport.state,
      loop: transport.loop,
      loopStart: Number(transport.loopStart),
      loopEnd: Number(transport.loopEnd),
      channels: this.channels.size,
      players: this.players.size,
      buffers: this.buffers.size,
      instruments: this.instruments.size,
      parts: this.parts.size,
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

    // Loop region.
    const loop = project.transport.loop;
    if (loop) {
      transport.loop = true;
      transport.loopStart = loop.startSec;
      transport.loopEnd = loop.endSec;
    } else {
      transport.loop = false;
    }

    // Transport run/stop. "playing" and "recording" both run the clock.
    const running = project.transport.state === "playing" || project.transport.state === "recording";
    if (running && transport.state !== "started") {
      transport.start();
    } else if (!running && transport.state === "started") {
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

      // Per-track input bus: all sources feed this, then the effects chain, then the channel.
      let input = this.inputs.get(track.id);
      if (!input) {
        input = new Tone.Gain();
        this.inputs.set(track.id, input);
      }
      this.reconcileEffects(track, input, channel);

      // Instrument tracks get a PolySynth feeding the input bus.
      if (track.kind === "instrument") {
        if (!this.instruments.has(track.id)) {
          const synth = new Tone.PolySynth(Tone.Synth).connect(input);
          this.instruments.set(track.id, synth);
        }
      } else if (this.instruments.has(track.id)) {
        this.instruments.get(track.id)!.dispose();
        this.instruments.delete(track.id);
      }

      // Drum tracks get a synthesized kit feeding the input bus.
      if (track.kind === "drum") {
        if (!this.drumKits.has(track.id)) {
          this.drumKits.set(track.id, createDrumKit(input));
        }
      } else if (this.drumKits.has(track.id)) {
        this.drumKits.get(track.id)!.dispose();
        this.drumKits.delete(track.id);
      }
    }

    // Dispose channels (+ inputs + effects + instruments + drum kits) for removed tracks.
    for (const [id, channel] of this.channels) {
      if (!seen.has(id)) {
        channel.dispose();
        this.channels.delete(id);
        this.inputs.get(id)?.dispose();
        this.inputs.delete(id);
        this.effectChains.get(id)?.nodes.forEach((n) => n.dispose());
        this.effectChains.delete(id);
        this.instruments.get(id)?.dispose();
        this.instruments.delete(id);
        this.drumKits.get(id)?.dispose();
        this.drumKits.delete(id);
      }
    }

    this.reconcileClips(project);
  }

  /**
   * Wire a track's effect chain: input → [enabled effects] → channel. Rebuild only on a
   * structural change (which effects, their order, enabled state); apply param edits live.
   */
  private reconcileEffects(track: Track, input: Tone.Gain, channel: Tone.Channel): void {
    const enabled = track.effects.filter((e) => e.enabled);
    const structSig = enabled.map((e) => `${e.id}:${e.type}`).join(",");
    const existing = this.effectChains.get(track.id);

    if (!existing || existing.structSig !== structSig) {
      // Rebuild the chain.
      input.disconnect();
      existing?.nodes.forEach((n) => n.dispose());
      const nodes = new Map<string, Tone.ToneAudioNode>();
      for (const effect of enabled) nodes.set(effect.id, createEffectNode(effect));
      // input → e1 → e2 → ... → channel
      input.chain(...enabled.map((e) => nodes.get(e.id)!), channel);
      for (const effect of enabled) applyParams(nodes.get(effect.id)!, effect);
      this.effectChains.set(track.id, { structSig, nodes });
      return;
    }

    // Structure unchanged — apply live param edits in place.
    for (const effect of enabled) {
      const node = existing.nodes.get(effect.id);
      if (node) applyParams(node, effect);
    }
  }

  /** Build/update/dispose per-clip audio Players and MIDI Parts, synced to the transport. */
  private reconcileClips(project: Project): void {
    const seenPlayers = new Set<string>();
    const seenParts = new Set<string>();
    const seenSeqs = new Set<string>();
    const secPerBeat = 60 / project.tempo;

    for (const track of project.tracks) {
      const input = this.inputs.get(track.id);
      if (!input) continue;

      for (const clip of track.clips) {
        if (clip.audio) {
          seenPlayers.add(clip.id);
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
          const player = new Tone.Player(buffer).connect(input);
          player.volume.value = clip.audio.gainDb;
          player.sync().start(clip.startSec, clip.audio.offsetSec, clip.durationSec);
          this.players.set(clip.id, { player, sig });
        } else if (clip.midi) {
          const synth = this.instruments.get(track.id);
          if (!synth) continue; // only instrument tracks play MIDI
          seenParts.add(clip.id);

          // Signature includes tempo + every note, so any edit rebuilds the part.
          const sig = [
            track.id,
            clip.startSec,
            project.tempo,
            clip.midi.notes
              .map((n) => `${n.pitch}@${n.startBeats}:${n.durationBeats}/${n.velocity}`)
              .join(","),
          ].join("|");
          const existing = this.parts.get(clip.id);
          if (existing && existing.sig === sig) continue;
          existing?.part.dispose();

          const events = clip.midi.notes.map((n) => ({
            time: n.startBeats * secPerBeat,
            pitch: Tone.Frequency(n.pitch, "midi").toFrequency(),
            dur: n.durationBeats * secPerBeat,
            vel: n.velocity,
          }));
          const part = new Tone.Part((time, ev) => {
            synth.triggerAttackRelease(ev.pitch, ev.dur, time, ev.vel);
          }, events);
          part.start(clip.startSec);
          this.parts.set(clip.id, { part, sig });
        } else if (clip.pattern) {
          const kit = this.drumKits.get(track.id);
          if (!kit) continue; // only drum tracks play patterns
          seenSeqs.add(clip.id);

          const pattern = clip.pattern;
          const sig = [track.id, clip.startSec, pattern.steps, JSON.stringify(pattern.lanes)].join("|");
          const existing = this.sequences.get(clip.id);
          if (existing && existing.sig === sig) continue;
          existing?.seq.dispose();

          const steps = Array.from({ length: pattern.steps }, (_, i) => i);
          const seq = new Tone.Sequence<number>(
            (time, step) => {
              for (const lane of pattern.lanes) {
                if (lane.hits[step]) kit.trigger(lane.voice, time);
              }
            },
            steps,
            "16n",
          );
          seq.start(clip.startSec); // loops every bar by default
          this.sequences.set(clip.id, { seq, sig });
        }
      }
    }

    // Dispose players + parts whose clips were removed.
    for (const [clipId, entry] of this.players) {
      if (!seenPlayers.has(clipId)) {
        entry.player.dispose();
        this.players.delete(clipId);
      }
    }
    for (const [clipId, entry] of this.parts) {
      if (!seenParts.has(clipId)) {
        entry.part.dispose();
        this.parts.delete(clipId);
      }
    }
    for (const [clipId, entry] of this.sequences) {
      if (!seenSeqs.has(clipId)) {
        entry.seq.dispose();
        this.sequences.delete(clipId);
      }
    }
  }

  /** Tear down (not used in app lifetime; handy for tests/HMR). */
  dispose(): void {
    this.unsubscribe?.();
    for (const entry of this.players.values()) entry.player.dispose();
    this.players.clear();
    for (const entry of this.parts.values()) entry.part.dispose();
    this.parts.clear();
    for (const synth of this.instruments.values()) synth.dispose();
    this.instruments.clear();
    for (const entry of this.sequences.values()) entry.seq.dispose();
    this.sequences.clear();
    for (const kit of this.drumKits.values()) kit.dispose();
    this.drumKits.clear();
    for (const entry of this.effectChains.values()) entry.nodes.forEach((n) => n.dispose());
    this.effectChains.clear();
    for (const input of this.inputs.values()) input.dispose();
    this.inputs.clear();
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
