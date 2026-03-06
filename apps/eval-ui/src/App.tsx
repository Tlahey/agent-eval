import { RunProvider } from "./lib/contexts/RunContext";
import { MainLayout } from "./layouts/MainLayout";

export function App() {
  return (
    <RunProvider>
      <MainLayout />
    </RunProvider>
  );
}
