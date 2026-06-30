/**
 * Effect node factory + parameter specs.
 *
 * The store keeps each effect as `{ type, enabled, params }`. This module turns that into a
 * Tone node and applies live parameter changes in place, and exposes per-type param specs the
 * UI uses to render knobs. Keeping the specs here means the UI and the audio agree on ranges.
 */
import * as Tone from "tone";
import type { Effect, EffectType } from "@/state/types";

export interface EffectParamSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

export const EFFECT_SPECS: Record<EffectType, { label: string; params: EffectParamSpec[] }> = {
  eq3: {
    label: "EQ",
    params: [
      { key: "low", label: "Low", min: -24, max: 12, step: 0.5, default: 0 },
      { key: "mid", label: "Mid", min: -24, max: 12, step: 0.5, default: 0 },
      { key: "high", label: "High", min: -24, max: 12, step: 0.5, default: 0 },
    ],
  },
  reverb: {
    label: "Reverb",
    params: [
      { key: "decay", label: "Decay", min: 0.1, max: 10, step: 0.1, default: 2 },
      { key: "wet", label: "Mix", min: 0, max: 1, step: 0.01, default: 0.4 },
    ],
  },
  delay: {
    label: "Delay",
    params: [
      { key: "delayTime", label: "Time", min: 0, max: 1, step: 0.01, default: 0.25 },
      { key: "feedback", label: "Fbk", min: 0, max: 0.95, step: 0.01, default: 0.3 },
      { key: "wet", label: "Mix", min: 0, max: 1, step: 0.01, default: 0.4 },
    ],
  },
  distortion: {
    label: "Drive",
    params: [
      { key: "distortion", label: "Amt", min: 0, max: 1, step: 0.01, default: 0.4 },
      { key: "wet", label: "Mix", min: 0, max: 1, step: 0.01, default: 0.6 },
    ],
  },
  chorus: {
    label: "Chorus",
    params: [
      { key: "frequency", label: "Rate", min: 0.1, max: 10, step: 0.1, default: 1.5 },
      { key: "depth", label: "Depth", min: 0, max: 1, step: 0.01, default: 0.7 },
      { key: "wet", label: "Mix", min: 0, max: 1, step: 0.01, default: 0.5 },
    ],
  },
  compressor: {
    label: "Comp",
    params: [
      { key: "threshold", label: "Thr", min: -60, max: 0, step: 1, default: -18 },
      { key: "ratio", label: "Ratio", min: 1, max: 20, step: 0.5, default: 4 },
    ],
  },
};

export const EFFECT_TYPES = Object.keys(EFFECT_SPECS) as EffectType[];

/** Default param map for a new effect of `type`. */
export function defaultParams(type: EffectType): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of EFFECT_SPECS[type].params) out[p.key] = p.default;
  return out;
}

const num = (params: Record<string, number>, key: string, fallback: number) =>
  params[key] ?? fallback;

/** Create a Tone effect node from an Effect descriptor. */
export function createEffectNode(effect: Effect): Tone.ToneAudioNode {
  const p = effect.params;
  switch (effect.type) {
    case "eq3":
      return new Tone.EQ3({ low: num(p, "low", 0), mid: num(p, "mid", 0), high: num(p, "high", 0) });
    case "reverb": {
      const r = new Tone.Reverb({ decay: num(p, "decay", 2) });
      r.wet.value = num(p, "wet", 0.4);
      return r;
    }
    case "delay":
      return new Tone.FeedbackDelay({
        delayTime: num(p, "delayTime", 0.25),
        feedback: num(p, "feedback", 0.3),
        wet: num(p, "wet", 0.4),
      });
    case "distortion":
      return new Tone.Distortion({ distortion: num(p, "distortion", 0.4), wet: num(p, "wet", 0.6) });
    case "chorus": {
      const c = new Tone.Chorus({ frequency: num(p, "frequency", 1.5), depth: num(p, "depth", 0.7) });
      c.wet.value = num(p, "wet", 0.5);
      return c.start();
    }
    case "compressor":
      return new Tone.Compressor({ threshold: num(p, "threshold", -18), ratio: num(p, "ratio", 4) });
  }
}

/** Apply param changes to a live node (no rebuild) where the node supports it. */
export function applyParams(node: Tone.ToneAudioNode, effect: Effect): void {
  const p = effect.params;
  if (node instanceof Tone.EQ3) {
    node.low.value = num(p, "low", 0);
    node.mid.value = num(p, "mid", 0);
    node.high.value = num(p, "high", 0);
  } else if (node instanceof Tone.Reverb) {
    node.wet.value = num(p, "wet", 0.4);
    // decay change requires regenerating the impulse response.
    if (Number(node.decay) !== num(p, "decay", 2)) node.decay = num(p, "decay", 2);
  } else if (node instanceof Tone.FeedbackDelay) {
    node.delayTime.value = num(p, "delayTime", 0.25);
    node.feedback.value = num(p, "feedback", 0.3);
    node.wet.value = num(p, "wet", 0.4);
  } else if (node instanceof Tone.Distortion) {
    node.distortion = num(p, "distortion", 0.4);
    node.wet.value = num(p, "wet", 0.6);
  } else if (node instanceof Tone.Chorus) {
    node.frequency.value = num(p, "frequency", 1.5);
    node.depth = num(p, "depth", 0.7);
    node.wet.value = num(p, "wet", 0.5);
  } else if (node instanceof Tone.Compressor) {
    node.threshold.value = num(p, "threshold", -18);
    node.ratio.value = num(p, "ratio", 4);
  }
}
