import { Outlet, useSearchParams } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { useState } from "react";
import type { LedgerRun } from "./lib/api";
import { RunDetailPanel } from "./components/RunDetailPanel";

export function App() {
  const [selectedRun, setSelectedRun] = useState<LedgerRun | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const handleClose = () => {
    setSelectedRun(null);
    if (searchParams.has("id")) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("id");
      setSearchParams(newParams);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface-0 font-sans text-txt-base antialiased selection:bg-primary/30 selection:text-primary">
      {/* Dynamic Background Accents */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -left-[10%] -top-[10%] h-[40%] w-[40%] rounded-full bg-primary/5 blur-[120px] animate-pulse" />
        <div
          className="absolute -right-[5%] bottom-[10%] h-[30%] w-[30%] rounded-full bg-accent/5 blur-[100px] animate-pulse"
          style={{ animationDelay: "2s" }}
        />
      </div>

      <Sidebar />

      <main className="relative flex-1 overflow-auto custom-scrollbar">
        <div className="min-h-full transition-all duration-500">
          <Outlet context={{ selectedRun, setSelectedRun }} />
        </div>
      </main>

      {selectedRun && (
        <RunDetailPanel
          run={selectedRun}
          onClose={handleClose}
          onOverride={() => {
            // Logic to refresh data if needed, though most pages refetch on mount or use effects
          }}
        />
      )}
    </div>
  );
}

/** Typed hook for child routes */
export type AppContext = {
  selectedRun: LedgerRun | null;
  setSelectedRun: (run: LedgerRun | null) => void;
};
