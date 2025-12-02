import React from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  authorsNote: string;
  onAuthorsNoteChange: (v: string) => void;
  aiInstructions: string;
  onAiInstructionsChange: (v: string) => void;
  fontSize: number;
  onFontSizeChange: (n: number) => void;
};

export default function SettingsModal({
  open,
  onClose,
  authorsNote,
  onAuthorsNoteChange,
  aiInstructions,
  onAiInstructionsChange,
  fontSize,
  onFontSizeChange,
}: Props) {
  if (!open) return null;
  return (
    <div className="ms-modal-backdrop" role="dialog" aria-modal="true">
      <div className="ms-modal">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3>Engine Settings</h3>
          <div>
            <button className="btn" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="ms-field">
          <label>Author's Note (context injected into model)</label>
          <textarea value={authorsNote} onChange={(e) => onAuthorsNoteChange(e.target.value)} placeholder="Tone, important plot hooks, constraints..." />
        </div>

        <div className="ms-field">
          <label>AI Instructions (engine rules)</label>
          <textarea value={aiInstructions} onChange={(e) => onAiInstructionsChange(e.target.value)} placeholder="Second-person, no repetition, short paragraphs..." />
        </div>

        <div className="ms-field">
          <label>Display — Font Size ({fontSize}px)</label>
          <input type="range" min={14} max={20} value={fontSize} onChange={(e) => onFontSizeChange(Number(e.target.value))} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
