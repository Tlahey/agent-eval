import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderPage } from "../test/render";
import { EvalDetail } from "./EvalDetail";
import { createMockRun } from "../test/fixtures";
import * as api from "../lib/api";

// Recharts ResponsiveContainer needs ResizeObserver in the test environment
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual("../lib/api");
  return {
    ...actual,
    fetchRuns: vi.fn(),
    fetchStats: vi.fn(),
  };
});

const mockFetchRuns = vi.mocked(api.fetchRuns);
const mockFetchStats = vi.mocked(api.fetchStats);

describe("EvalDetail", () => {
  const testId = "create dark mode toggle";
  const mockRuns = [
    createMockRun({ id: 1, testId, agentRunner: "copilot" }),
    createMockRun({ id: 2, testId, agentRunner: "cursor" }),
    createMockRun({ id: 3, testId, agentRunner: "claude-code" }),
    createMockRun({ id: 4, testId, agentRunner: "aider" }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchRuns.mockResolvedValue(mockRuns);
    mockFetchStats.mockResolvedValue([
      { agentRunner: "copilot", totalRuns: 1, avgScore: 0.8, passRate: 1.0 },
      { agentRunner: "cursor", totalRuns: 1, avgScore: 0.7, passRate: 1.0 },
      { agentRunner: "claude-code", totalRuns: 1, avgScore: 0.9, passRate: 1.0 },
      { agentRunner: "aider", totalRuns: 1, avgScore: 0.6, passRate: 1.0 },
    ]);
  });

  it("renders the test ID in the heading", async () => {
    renderPage(<EvalDetail />, { path: `/evals/${encodeURIComponent(testId)}` });
    await waitFor(() => {
      // Find the heading specifically to avoid matching table cells
      const heading = screen.getByRole("heading", { level: 1, name: testId });
      expect(heading).toBeInTheDocument();
    });
  });

  it("shows run and runner counts", async () => {
    renderPage(<EvalDetail />, { path: `/evals/${encodeURIComponent(testId)}` });
    await waitFor(() => {
      expect(screen.getByText(/4 Total executions/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Runners/i).length).toBeGreaterThan(0);
    });
  });

  it("renders KPI cards", async () => {
    renderPage(<EvalDetail />, { path: `/evals/${encodeURIComponent(testId)}` });
    await waitFor(() => {
      expect(screen.getByText("Avg Score")).toBeInTheDocument();
      expect(screen.getByText("Pass Rate")).toBeInTheDocument();
    });
  });

  it("renders chart sections", async () => {
    renderPage(<EvalDetail />, { path: `/evals/${encodeURIComponent(testId)}` });
    await waitFor(() => {
      expect(screen.getByText("Historical Performance")).toBeInTheDocument();
      expect(screen.getByText("Capabilities Matrix")).toBeInTheDocument();
      expect(screen.getByText("Score Distribution")).toBeInTheDocument();
      expect(screen.getByText("Runner Breakdown")).toBeInTheDocument();
    });
  });

  it("renders per-runner breakdown cards", async () => {
    renderPage(<EvalDetail />, { path: `/evals/${encodeURIComponent(testId)}` });
    await waitFor(() => {
      expect(screen.getAllByText("copilot").length).toBeGreaterThan(0);
      expect(screen.getAllByText("cursor").length).toBeGreaterThan(0);
      expect(screen.getAllByText("claude-code").length).toBeGreaterThan(0);
      expect(screen.getAllByText("aider").length).toBeGreaterThan(0);
    });
  });

  it("renders best/worst run cards", async () => {
    renderPage(<EvalDetail />, { path: `/evals/${encodeURIComponent(testId)}` });
    await waitFor(() => {
      expect(screen.getByText("Optimal Performance")).toBeInTheDocument();
      expect(screen.getByText("Critical Failure")).toBeInTheDocument();
    });
  });

  it("renders the All Runs table", async () => {
    renderPage(<EvalDetail />, { path: `/evals/${encodeURIComponent(testId)}` });
    await waitFor(() => {
      expect(screen.getByText("Execution History")).toBeInTheDocument();
    });
  });

  it("shows loading state initially", () => {
    mockFetchRuns.mockReturnValue(new Promise(() => {}));
    renderPage(<EvalDetail />, { path: `/evals/${encodeURIComponent(testId)}` });
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("shows empty state when no runs", async () => {
    mockFetchRuns.mockResolvedValue([]);
    renderPage(<EvalDetail />, { path: `/evals/${encodeURIComponent(testId)}` });
    await waitFor(() => {
      expect(screen.getByText("No evaluation runs found")).toBeInTheDocument();
    });
  });

  it("fetches runs filtered by testId", async () => {
    renderPage(<EvalDetail />, { path: `/evals/${encodeURIComponent(testId)}` });
    await waitFor(() => {
      expect(mockFetchRuns).toHaveBeenCalledWith(testId);
    });
  });
});
