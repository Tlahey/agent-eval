import { useEffect, useState } from "react";
import { fetchRuns, fetchTestIds, type LedgerRun } from "../lib/api";
import { RunDetailModal } from "../components/RunDetailModal";

export function Dashboard() {
  const [runs, setRuns] = useState<LedgerRun[]>([]);
  const [testIds, setTestIds] = useState<string[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string>("");
  const [selectedRun, setSelectedRun] = useState<LedgerRun | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTestIds().then(setTestIds).catch(console.error);
  }, []);

  useEffect(() => {
    fetchRuns(selectedTestId || undefined)
      .then((data) => {
        setRuns(data);
        setLoading(false);
      })
      .catch(console.error);
  }, [selectedTestId]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-base">Evaluation Runs</h2>
        <select
          value={selectedTestId}
          onChange={(e) => setSelectedTestId(e.target.value)}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-base"
        >
          <option value="">All tests</option>
          {testIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-text-muted">Loading…</p>
      ) : runs.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface-alt p-8 text-center">
          <p className="text-text-muted">
            No runs yet. Execute{" "}
            <code className="rounded bg-surface px-1 py-0.5 text-xs">agenteval run</code> to get
            started.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-alt">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-text-muted">Test</th>
                <th className="px-4 py-3 text-left font-medium text-text-muted">Agent</th>
                <th className="px-4 py-3 text-left font-medium text-text-muted">Score</th>
                <th className="px-4 py-3 text-left font-medium text-text-muted">Status</th>
                <th className="px-4 py-3 text-left font-medium text-text-muted">Duration</th>
                <th className="px-4 py-3 text-left font-medium text-text-muted">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {runs.map((run, i) => (
                <tr
                  key={run.id ?? i}
                  onClick={() => setSelectedRun(run)}
                  className="cursor-pointer transition-colors hover:bg-surface-alt"
                >
                  <td className="px-4 py-3 font-medium text-text-base">{run.testId}</td>
                  <td className="px-4 py-3 text-text-muted">{run.agentRunner}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`font-mono font-medium ${run.score >= 0.7 ? "text-success" : run.score >= 0.4 ? "text-warning" : "text-danger"}`}
                    >
                      {run.score.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${run.pass ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
                    >
                      {run.pass ? "PASS" : "FAIL"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {(run.durationMs / 1000).toFixed(1)}s
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {new Date(run.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedRun && <RunDetailModal run={selectedRun} onClose={() => setSelectedRun(null)} />}
    </div>
  );
}
