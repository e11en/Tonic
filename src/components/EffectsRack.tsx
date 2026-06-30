import { useState } from "react";
import { Button, Knob, Panel, Toggle } from "@/ui";
import { useTonic } from "@/state/store";
import { addEffect, removeEffect, setEffectEnabled, setEffectParam } from "@/state/actions";
import { EFFECT_SPECS, EFFECT_TYPES } from "@/audio/effects";
import type { EffectType } from "@/state/types";

interface EffectsRackProps {
  trackId: string;
  onClose: () => void;
}

/**
 * Per-track effects rack. Add effects from the menu; each effect has an enable toggle, a
 * remove button, and knobs for its params. Everything mutates through `actions.ts`, so MCP
 * `add_effect` / `set_effect_param` and the UI edit the same rack.
 */
export function EffectsRack({ trackId, onClose }: EffectsRackProps) {
  const track = useTonic((s) => s.project.tracks.find((t) => t.id === trackId));
  const [pick, setPick] = useState<EffectType>("reverb");

  if (!track) return null;

  return (
    <Panel
      title={`Effects — ${track.name}`}
      texture="brushed"
      actions={
        <Button variant="ghost" onClick={onClose}>
          ✕ Close
        </Button>
      }
    >
      <div className="tn-fx__add">
        <select value={pick} onChange={(e) => setPick(e.target.value as EffectType)}>
          {EFFECT_TYPES.map((t) => (
            <option key={t} value={t}>
              {EFFECT_SPECS[t].label}
            </option>
          ))}
        </select>
        <Button variant="primary" onClick={() => addEffect(trackId, pick)}>
          + Add
        </Button>
      </div>

      {track.effects.length === 0 && (
        <p className="t-label" style={{ marginTop: "var(--space-2)" }}>
          No effects yet. Add one above — it inserts into this track's signal chain.
        </p>
      )}

      <div className="tn-fx__list">
        {track.effects.map((effect) => (
          <div className={`tn-fx__unit${effect.enabled ? "" : " is-bypassed"}`} key={effect.id}>
            <div className="tn-fx__head">
              <span className="tn-fx__name">{EFFECT_SPECS[effect.type].label}</span>
              <Toggle
                checked={effect.enabled}
                onChange={(v) => setEffectEnabled(trackId, effect.id, v)}
                label={effect.enabled ? "on" : "off"}
              />
              <button
                className="tn-fx__del"
                title="Remove effect"
                onClick={() => removeEffect(trackId, effect.id)}
              >
                ×
              </button>
            </div>
            <div className="tn-fx__knobs">
              {EFFECT_SPECS[effect.type].params.map((spec) => (
                <Knob
                  key={spec.key}
                  value={effect.params[spec.key] ?? spec.default}
                  min={spec.min}
                  max={spec.max}
                  onChange={(v) => setEffectParam(trackId, effect.id, spec.key, v)}
                  label={spec.label}
                  size={40}
                  format={(v) => v.toFixed(2)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
