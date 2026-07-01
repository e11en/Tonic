import { Button } from "@/ui";

interface WelcomeOverlayProps {
  onClose: () => void;
  onBeat: () => void;
  onSynth: () => void;
}

/**
 * First-run welcome. Explains the basics in plain language and offers one-click starters so a
 * beginner hears something immediately. Reopenable from the header "?".
 */
export function WelcomeOverlay({ onClose, onBeat, onSynth }: WelcomeOverlayProps) {
  return (
    <div className="tn-welcome">
      <div className="tn-welcome__card">
        <h1 className="tn-welcome__title">Welcome to Tonic</h1>
        <p className="tn-welcome__tag">make music, simply</p>

        <ul className="tn-welcome__list">
          <li>
            <strong>Tracks</strong> are the rows of your song — a drum beat, a synth, or a recording.
          </li>
          <li>
            The <strong>mixer</strong> at the bottom balances how loud each track is.
          </li>
          <li>
            Press <strong>▶ Play</strong> to hear everything together. <strong>● Rec</strong> records
            your microphone.
          </li>
          <li>
            See a <strong>?</strong> anywhere? Click it — every control explains itself.
          </li>
        </ul>

        <p className="tn-welcome__prompt">Start with a ready-made idea, or a blank canvas:</p>
        <div className="tn-welcome__actions">
          <Button
            variant="primary"
            onClick={() => {
              onBeat();
              onClose();
            }}
          >
            🥁 Start with a beat
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onSynth();
              onClose();
            }}
          >
            🎹 Start with a synth
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Blank project
          </Button>
        </div>
      </div>
    </div>
  );
}
