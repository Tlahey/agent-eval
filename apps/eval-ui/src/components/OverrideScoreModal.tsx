import { useState } from "react";
import { X, Pencil } from "lucide-react";
import { ScoreRing } from "./ScoreRing";

interface Props {
  currentScore: number;
  onSubmit: (score: number, reason: string) => void;
  onClose: () => void;
}

export function OverrideScoreModal({ currentScore, onSubmit, onClose }: Props) {
  const [score, setScore] = useState(currentScore);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!reason.trim()) {
      setError("Please provide a reason for the override");
      return;
    }
    onSubmit(score, reason.trim());
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[60] bg-black/50 animate-fade-in" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div
          className="w-full max-w-md rounded-xl border border-border bg-surface-1 shadow-2xl animate-slide-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <Pencil size={16} className="text-primary" />
              <h3 className="text-sm font-bold text-txt-base">Override Score</h3>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-txt-muted transition-colors hover:bg-surface-3 hover:text-txt-base"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="space-y-5 p-5">
            {/* Score preview */}
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-txt-muted">
                  Original
                </p>
                <ScoreRing value={currentScore} size={48} strokeWidth={4} />
              </div>
              <span className="text-txt-muted">→</span>
              <div className="text-center">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-primary">
                  New
                </p>
                <ScoreRing value={score} size={48} strokeWidth={4} />
              </div>
            </div>

            {/* Score slider */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-txt-secondary">
                Score: {score.toFixed(2)}
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={score}
                onChange={(e) => setScore(parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="mt-1 flex justify-between text-[10px] text-txt-muted">
                <span>0.00</span>
                <span>0.50</span>
                <span>1.00</span>
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-txt-secondary">
                Reason <span className="text-err">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Why are you overriding this score?"
                rows={3}
                className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-txt-base placeholder:text-txt-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {error && <p className="mt-1 text-xs text-err">{error}</p>}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
            <button
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-txt-muted transition-colors hover:bg-surface-3 hover:text-txt-base"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-primary/90"
            >
              Save Override
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
