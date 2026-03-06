import { Outlet } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import { RunDetailPanel } from "../components/RunDetailPanel";
import { useRunSelection } from "../lib/contexts/RunContext";

export function MainLayout() {
  const { selectedRun, closeRunDetail } = useRunSelection();

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
          <Outlet />
        </div>
      </main>

      {selectedRun && (
        <RunDetailPanel
          run={selectedRun}
          onClose={closeRunDetail}
          onOverride={() => {
            // Re-fetching logic could be triggered here if needed via an EventEmitter or similar
          }}
        />
      )}
    </div>
  );
}
