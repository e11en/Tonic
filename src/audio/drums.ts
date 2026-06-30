/**
 * Built-in synthesized drum kit. Lets a beginner make a beat with zero uploads.
 * Each drum track gets one kit (a handful of Tone synths) connected to its channel;
 * the engine's Tone.Sequence triggers voices per step.
 */
import * as Tone from "tone";
import type { DrumVoice } from "@/state/types";

export interface DrumKitNodes {
  trigger(voice: DrumVoice, time: number): void;
  dispose(): void;
}

/** Build a drum kit feeding `dest` (a track channel). */
export function createDrumKit(dest: Tone.InputNode): DrumKitNodes {
  const kick = new Tone.MembraneSynth({ octaves: 6, pitchDecay: 0.05 }).connect(dest);

  const snare = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
  }).connect(dest);

  // Hi-hat: short white noise through a high-pass filter.
  const hatFilter = new Tone.Filter(7000, "highpass").connect(dest);
  const hihat = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0 },
  }).connect(hatFilter);
  hihat.volume.value = -8;

  const clap = new Tone.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.001, decay: 0.13, sustain: 0 },
  }).connect(dest);

  const tom = new Tone.MembraneSynth({ octaves: 4, pitchDecay: 0.1 }).connect(dest);

  return {
    trigger(voice, time) {
      switch (voice) {
        case "kick":
          kick.triggerAttackRelease("C1", "8n", time);
          break;
        case "snare":
          snare.triggerAttackRelease("8n", time);
          break;
        case "hihat":
          hihat.triggerAttackRelease("16n", time);
          break;
        case "clap":
          clap.triggerAttackRelease("16n", time);
          break;
        case "tom":
          tom.triggerAttackRelease("G2", "8n", time);
          break;
      }
    },
    dispose() {
      kick.dispose();
      snare.dispose();
      hihat.dispose();
      hatFilter.dispose();
      clap.dispose();
      tom.dispose();
    },
  };
}
