import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderPage } from "../test/render";
import { EvalDetail } from "./EvalDetail";
import { createMockRun } from "../test/fixtures";
import type { LedgerRun } from "../lib/api";

vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="chart-container">{children}</div>
    ),
  };
});

vi.mock("../lib/api", () => ({
  fetchRuns: vi.fn(),
}));

import { fetchRuns } from "../lib/api";
const mockFetchRuns = vi.mocked(fetchRuns);

function createEvalRuns(): LedgerRun[] {
  const runners = ["copilot", "cursor", "claude-code", "aider"];
  return runners.flatMap((runner, ri) =>
    Array.from({ length: 3 }, (_, i) =>
      createMockRun({
        id: ri * 3 + i + 1,
        testId: "create dark mode toggle",
        suitePath: ["Theme"],
        agentRunner: runner,
        score: 0.6 + ri * 0.08 + i * 0.03,
        pass: ri * 3 + i !== 2, // one failure
        timestamp: new Date(Date.now() - (ri * 3 + i) * 86400000).toISOString(),
        durationMs: 30000 + (ri * 3 + i) * 5000,
      }),
    ),
  );
}

describe("EvalDetail", () => {
  const testId = "create dark mode toggle";
  const evalRuns = createEvalRuns();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchRuns.mockResolvedValue(evalRuns);
  });

  it("renders the evaluation name as heading", async () => {
    renderPage(<EvalDetail />, { path: `/evals/${encodeURIComponent(testId)}` });
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: testId })).toBeInTheDocument();
    });
  });

  it("shows run and runner counts", async () => {
    renderPage(<EvalDetail />, { path: `/evals/${encodeURIComponent(testId)}` });
    await waitFor(() => {
      expect(screen.getByText("12")).toBeInTheDocument(); // 12 runs
      expect(screen.getByText(/runners/)).toBeInTheDocument();
    });
  });

  it("renders KPI cards", async () => {
    renderPage(<EvalDetail />, { path: `/evals/${encodeURIComponent(testId)}` });
    await waitFor(() => {
      expect(screen.getByText("Runs")).toBeInTheDocument();
      expect(screen.getByText("Pass Rate")).toBeInTheDocument();
      expect(screen.getByText("Failures")).toBeInTheDocument();
      expect(screen.getByText("Avg Duration")).toBeInTheDocument();
    });
  });

  it("renders chart sections", async () => {
    renderPage(<EvalDetail />, { path: `/evals/${encodeURIComponent(testId)}` });
    await waitFor(() => {
      expect(screen.getByText("Score Trend per Runner")).toBeInTheDocument();
      expect(screen.getByText("Runner Comparison")).toBeInTheDocument();
      expect(screen.getByText("Score Distribution")).toBeInTheDocument();
      expect(screen.getByText("Per-Runner Breakdown")).toBeInTheDocument();
    });
  });

  it("renders per-runner breakdown cards", async () => {
    renderPage(<EvalDetail />, { path: `/evals/${encodeURIComponent(testId)}` });
    await waitFor(() => {
      // Runner names appear in breakdown cards (and in the runs table)
      expect(screen.getAllByText("copilot").length).toBeGreaterThan(0);
      expect(screen.getAllByText("cursor").length).toBeGreaterThan(0);
      expect(screen.getAllByText("claude-code").length).toBeGreaterThan(0);
      expect(screen.getAllByText("aider").length).toBeGreaterThan(0);
    });
  });

  it("renders best/worst run cards", async () => {
    renderPage(<EvalDetail />, { path: `/evals/${encodeURIComponent(testId)}` });
    await waitFor(() => {
      expect(screen.getByText("Best Run")).toBeInTheDocument();
      expect(screen.getByText("Worst Run")).toBeInTheDocument();
    });
  });

  it("renders the All Runs table", async () => {
    renderPage(<EvalDetail />, { path: `/evals/${encodeURIComponent(testId)}` });
    await waitFor(() => {
      expect(screen.getByText("All Runs")).toBeInTheDocument();
    });
  });

  it("shows loading state initially", () => {
    mockFetchRuns.mockReturnValue(new Promise(() => {}));
    renderPage(<EvalDetail />, { path: `/evals/${encodeURIComponent(testId)}` });
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("shows breadcrumb navigation", async () => {
    renderPage(<EvalDetail />, { path: `/evals/${encodeURIComponent(testId)}` });
    await waitFor(() => {
      expect(screen.getByText("Evaluations")).toBeInTheDocument();
    });
  });

  it("shows suite path in breadcrumbs", async () => {
    renderPage(<EvalDetail />, { path: `/evals/${encodeURIComponent(testId)}` });
    await waitFor(() => {
      expect(screen.getByText("Theme")).toBeInTheDocument();
    });
  });

  it("fetches runs filtered by testId", async () => {
    renderPage(<EvalDetail />, { path: `/evals/${encodeURIComponent(testId)}` });
    await waitFor(() => {
      expect(mockFetchRuns).toHaveBeenCalledWith(testId);
    });
  });
});
