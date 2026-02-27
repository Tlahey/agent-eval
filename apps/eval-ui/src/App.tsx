import { Outlet } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { useState } from "react";
import type { LedgerRun } from "./lib/api";
import { RunDetailPanel } from "./components/RunDetailPanel";

export function App() {
  const [selectedRun, setSelectedRun] = useState<LedgerRun | null>(null);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-0">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet context={{ selectedRun, setSelectedRun }} />
      </main>
      {selectedRun && <RunDetailPanel run={selectedRun} onClose={() => setSelectedRun(null)} />}
    </div>
  );
}

/** Typed hook for child routes */
export type AppContext = {
  selectedRun: LedgerRun | null;
  setSelectedRun: (run: LedgerRun | null) => void;
};
