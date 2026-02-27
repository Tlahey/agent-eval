import { Outlet, NavLink } from "react-router-dom";

export function App() {
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-surface-alt px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-text-base">🧪 AgentEval</h1>
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-text-inverse">
              Dashboard
            </span>
          </div>
          <nav className="flex gap-4">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `text-sm font-medium transition-colors ${
                  isActive ? "text-primary" : "text-text-muted hover:text-text-base"
                }`
              }
            >
              Runs
            </NavLink>
            <NavLink
              to="/analytics"
              className={({ isActive }) =>
                `text-sm font-medium transition-colors ${
                  isActive ? "text-primary" : "text-text-muted hover:text-text-base"
                }`
              }
            >
              Analytics
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-6">
        <Outlet />
      </main>
    </div>
  );
}
