import { Button, Panel } from "@/ui";
import { useTonic } from "@/state/store";
import { setStep } from "@/state/actions";
import type { DrumVoice } from "@/state/types";

interface DrumMachineProps {
  trackId: string;
  clipId: string;
  onClose: () => void;
}

const VOICE_LABEL: Record<DrumVoice, string> = {
  kick: "Kick",
  snare: "Snare",
  hihat: "Hi-hat",
  clap: "Clap",
  tom: "Tom",
};

/**
 * Step sequencer for a drum pattern clip. Click a step to toggle it; the engine's
 * Tone.Sequence loops the pattern. Mutates through `actions.setStep`, so MCP `set_step`
 * and UI clicks edit the same pattern.
 */
export function DrumMachine({ trackId, clipId, onClose }: DrumMachineProps) {
  const clip = useTonic((s) =>
    s.project.tracks.find((t) => t.id === trackId)?.clips.find((c) => c.id === clipId),
  );

  if (!clip?.pattern) {
    return (
      <Panel title="Drum machine">
        <p className="t-label">No pattern selected.</p>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </Panel>
    );
  }

  const { steps, lanes } = clip.pattern;

  return (
    <Panel
      title="Drum machine"
      texture="grille"
      actions={
        <Button variant="ghost" onClick={onClose}>
          ✕ Close
        </Button>
      }
    >
      <div className="tn-drum">
        {lanes.map((lane, laneIndex) => (
          <div className="tn-drum__lane" key={laneIndex}>
            <span className="tn-drum__label">{VOICE_LABEL[lane.voice]}</span>
            <div className="tn-drum__steps">
              {lane.hits.map((on, step) => (
                <button
                  key={step}
                  className={`tn-drum__step${on ? " is-on" : ""}${step % 4 === 0 ? " is-beat" : ""}`}
                  title={`${VOICE_LABEL[lane.voice]} · step ${step + 1}`}
                  onClick={() => setStep(trackId, clipId, laneIndex, step, !on)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="t-label" style={{ marginTop: "var(--space-2)" }}>
        {steps} steps · loops every bar. Press Play to hear the beat.
      </p>
    </Panel>
  );
}
