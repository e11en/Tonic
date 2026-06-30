/**
 * Core project state types for Tonic.
 * The store holds only serializable data — audio buffers live in IndexedDB and an
 * engine-side cache, never here (keeps snapshots small for the MCP bridge).
 *
 * NOTE (Phase 0): these types describe the full intended shape. The mutation layer
 * (`actions.ts`) and audio engine that consume them arrive in Phase 1.
 */

export type ID = string;

export type TransportState = "stopped" | "playing" | "recording";
export type TrackKind = "audio" | "instrument" | "drum";

export interface LoopRegion {
  startSec: number;
  endSec: number;
}

export interface Note {
  id: ID;
  pitch: number; // MIDI note number
  startBeats: number;
  durationBeats: number;
  velocity: number; // 0..1
}

export interface DrumLane {
  sampleId: ID;
  hits: boolean[]; // length === steps
}

export interface DrumPattern {
  steps: number;
  lanes: DrumLane[];
}

export interface Clip {
  id: ID;
  startSec: number;
  durationSec: number;
  loop?: boolean;
  // exactly one of the following describes the clip content:
  audio?: { sampleId: ID; offsetSec: number; gainDb: number };
  midi?: { notes: Note[] };
  pattern?: DrumPattern;
}

export type EffectType =
  | "eq3"
  | "reverb"
  | "delay"
  | "distortion"
  | "chorus"
  | "compressor";

export interface Effect {
  id: ID;
  type: EffectType;
  enabled: boolean;
  params: Record<string, number>;
}

export interface InstrumentConfig {
  type: "synth" | "sampler";
  synthParams?: Record<string, number>;
  samplerMap?: Record<number, ID>; // midi pitch -> sampleId
}

export interface DrumKit {
  laneSamples: ID[];
}

export interface Track {
  id: ID;
  kind: TrackKind;
  name: string;
  color: string;
  volumeDb: number;
  pan: number; // -1..1
  muted: boolean;
  soloed: boolean;
  armed: boolean;
  clips: Clip[];
  effects: Effect[];
  instrument?: InstrumentConfig;
  drumKit?: DrumKit;
}

export interface SampleMeta {
  id: ID;
  name: string;
  source: "mic" | "upload";
  durationSec: number;
  channels: number;
}

export interface Project {
  id: ID;
  name: string;
  tempo: number; // BPM
  timeSignature: [number, number];
  transport: {
    state: TransportState;
    positionSec: number;
    loop: LoopRegion | null;
  };
  masterVolumeDb: number;
  tracks: Track[];
  samples: Record<ID, SampleMeta>;
}
