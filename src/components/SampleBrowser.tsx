import { useRef, useState } from "react";
import { Button, Panel, Help } from "@/ui";
import { useTonic } from "@/state/store";
import { addClip, removeSample } from "@/state/actions";
import { importSampleFile, isAudioFile } from "@/audio/samples";

const fmtDur = (s: number) => `${s.toFixed(1)}s`;

/**
 * Sample browser side panel. Upload wav/mp3, then drop a sample onto a track as a clip.
 * Uploading is a UI action (binary audio doesn't travel over the MCP bridge).
 */
export function SampleBrowser() {
  // Select the stable record reference; derive the array in render to avoid the
  // Zustand "new snapshot every render" infinite-loop footgun.
  const samplesMap = useTonic((s) => s.project.samples);
  const samples = Object.values(samplesMap);
  const tracks = useTonic((s) => s.project.tracks);
  const fileInput = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<string>("");
  const [busy, setBusy] = useState(false);

  // Default the target track to the first one if unset / stale.
  const targetId = tracks.some((t) => t.id === target) ? target : tracks[0]?.id ?? "";

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      if (isAudioFile(file)) await importSampleFile(file);
    }
    setBusy(false);
    if (fileInput.current) fileInput.current.value = "";
  };

  const addToTrack = (sampleId: string) => {
    if (!targetId) return;
    // Append after the last clip on the target track so they don't stack at 0.
    const track = tracks.find((t) => t.id === targetId);
    const end = track
      ? track.clips.reduce((m, c) => Math.max(m, c.startSec + c.durationSec), 0)
      : 0;
    addClip(targetId, { sampleId, startSec: end });
  };

  return (
    <Panel
      title="Samples"
      texture="brushed"
      actions={
        <Help title="Samples">
          Upload audio files (wav, mp3…). Each becomes a reusable sample. Pick a target track and
          add it as a clip on the timeline — then press Play to hear it.
        </Help>
      }
    >
      <div className="tn-samples">
        <input
          ref={fileInput}
          type="file"
          accept="audio/*,.wav,.mp3,.ogg,.flac,.m4a"
          multiple
          style={{ display: "none" }}
          onChange={(e) => void onFiles(e.target.files)}
        />
        <Button variant="primary" onClick={() => fileInput.current?.click()}>
          {busy ? "Importing…" : "⤓ Upload audio"}
        </Button>

        {tracks.length > 0 && (
          <label className="tn-samples__target">
            <span className="t-label">Add to</span>
            <select value={targetId} onChange={(e) => setTarget(e.target.value)}>
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <ul className="tn-samples__list">
          {samples.length === 0 && (
            <li className="t-label tn-samples__empty">No samples yet. Upload to begin.</li>
          )}
          {samples.map((s) => (
            <li className="tn-samples__item" key={s.id}>
              <div className="tn-samples__meta">
                <span className="tn-samples__name">{s.name}</span>
                <span className="t-label">{fmtDur(s.durationSec)}</span>
              </div>
              <div className="tn-samples__actions">
                <Button
                  variant="ghost"
                  onClick={() => addToTrack(s.id)}
                  disabled={tracks.length === 0}
                >
                  + Add
                </Button>
                <button
                  className="tn-samples__del"
                  title="Delete sample"
                  onClick={() => removeSample(s.id)}
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
