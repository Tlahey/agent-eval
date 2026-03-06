import { createContext, useContext, useState, ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import type { LedgerRun } from "../api";

interface RunContextType {
  selectedRun: LedgerRun | null;
  setSelectedRun: (run: LedgerRun | null) => void;
  closeRunDetail: () => void;
}

const RunContext = createContext<RunContextType | undefined>(undefined);

export function RunProvider({ children }: { children: ReactNode }) {
  const [selectedRun, setSelectedRun] = useState<LedgerRun | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const closeRunDetail = () => {
    setSelectedRun(null);
    if (searchParams.has("id")) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("id");
      setSearchParams(newParams, { replace: true });
    }
  };

  const handleSetSelectedRun = (run: LedgerRun | null) => {
    setSelectedRun(run);
    if (run?.id) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set("id", run.id.toString());
      setSearchParams(newParams, { replace: true });
    }
  };

  return (
    <RunContext.Provider
      value={{ selectedRun, setSelectedRun: handleSetSelectedRun, closeRunDetail }}
    >
      {children}
    </RunContext.Provider>
  );
}

export function useRunSelection() {
  const context = useContext(RunContext);
  if (context === undefined) {
    throw new Error("useRunSelection must be used within a RunProvider");
  }
  return context;
}
