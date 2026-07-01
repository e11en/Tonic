import { useEffect, useState } from "react";
import { Button, Panel } from "@/ui";
import { useTonic } from "@/state/store";
import { placeNote, removeNote } from "@/state/actions";
import { enableMidi, setMidiTarget, isMidiEnabled } from "@/audio/webmidi";

interface PianoRollProps {
  trackId: string;
  clipId: string;
  onClose: () => void;
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const noteName = (midi: number) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
const isBlackKey = (midi: number) => [1, 3, 6, 8, 10].includes(midi % 12);

// Two octaves, high pitch at the top.
const TOP_PITCH = 83; // B5
const BOTTOM_PITCH = 60; // C4
const PITCHES = Array.from({ length: TOP_PITCH - BOTTOM_PITCH + 1 }, (_, i) => TOP_PITCH - i);

const CELL_W = 34;
const ROW_H = 16;

/**
 * Simple step-style piano roll. Click an empty cell to add a one-beat note; click a
 * note to remove it. Everything mutates through `actions.ts`, so MCP `place_note` and
 * UI clicks edit the same clip.
 */
export function PianoRoll({ trackId, clipId, onClose }: PianoRollProps) {
  const tempo = useTonic((s) => s.project.tempo);
  const clip = useTonic((s) =>
    s.project.tracks.find((t) => t.id === trackId)?.clips.find((c) => c.id === clipId),
  );
  const [midiStatus, setMidiStatus] = useState<string>(isMidiEnabled() ? "on" : "");

  // Route MIDI input to this clip/track while the roll is open.
  useEffect(() => {
    setMidiTarget({ trackId, clipId });
    return () => setMidiTarget(null);
  }, [trackId, clipId]);

  const onEnableMidi = async () => {
    const res = await enableMidi();
    setMidiStatus(
      res.ok ? (res.inputs.length ? `on · ${res.inputs.map((i) => i.name).join(", ")}` : "on · no devices") : res.error ?? "failed",
    );
  };

  if (!clip?.midi) {
    return (
      <Panel title="Piano roll">
        <p className="t-label">No MIDI clip selected.</p>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </Panel>
    );
  }

  const secPerBeat = 60 / tempo;
  const beats = Math.max(8, Math.round(clip.durationSec / secPerBeat));
  const notes = clip.midi.notes;

  // Index notes by the cell they start in for quick toggle.
  const noteAt = (pitch: number, beat: number) =>
    notes.find((n) => n.pitch === pitch && Math.floor(n.startBeats) === beat);

  const toggle = (pitch: number, beat: number) => {
    const existing = noteAt(pitch, beat);
    if (existing) removeNote(trackId, clipId, existing.id);
    else placeNote(trackId, clipId, { pitch, startBeats: beat, durationBeats: 1 });
  };

  return (
    <Panel
      title="Piano roll"
      texture="grille"
      actions={
        <Button variant="ghost" onClick={onClose}>
          ✕ Close
        </Button>
      }
    >
      <div className="tn-roll__bar">
        <p className="t-label">
          Click a cell to add a note, click it again to remove. {notes.length} note
          {notes.length === 1 ? "" : "s"}.
        </p>
        <Button variant={midiStatus.startsWith("on") ? "neutral" : "ghost"} onClick={() => void onEnableMidi()}>
          🎹 {midiStatus.startsWith("on") ? "MIDI on" : "Enable MIDI"}
        </Button>
      </div>
      {midiStatus && !midiStatus.startsWith("on") && (
        <p className="t-label" style={{ color: "var(--track-4, #e5534b)" }}>
          {midiStatus}
        </p>
      )}
      <div className="tn-roll" style={{ gridTemplateColumns: `48px repeat(${beats}, ${CELL_W}px)` }}>
        {PITCHES.map((pitch) => (
          <div className="tn-roll__row" key={pitch} style={{ display: "contents" }}>
            <div className={`tn-roll__label${isBlackKey(pitch) ? " is-black" : ""}`}>
              {noteName(pitch)}
            </div>
            {Array.from({ length: beats }, (_, beat) => {
              const on = !!noteAt(pitch, beat);
              return (
                <button
                  key={beat}
                  className={`tn-roll__cell${on ? " is-on" : ""}${
                    isBlackKey(pitch) ? " is-black" : ""
                  }${beat % 4 === 0 ? " is-bar" : ""}`}
                  style={{ height: ROW_H }}
                  title={`${noteName(pitch)} · beat ${beat + 1}`}
                  onClick={() => toggle(pitch, beat)}
                />
              );
            })}
          </div>
        ))}
      </div>
    </Panel>
  );
}
