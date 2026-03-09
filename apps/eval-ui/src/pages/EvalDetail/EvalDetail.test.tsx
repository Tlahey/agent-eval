import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderPage } from "../../test/render";
import { EvalDetail } from "./EvalDetail";
import { createMockRun } from "../../test/fixtures";
import * as api from "../../lib/api";

// Mock the API
vi.mock("../../lib/api", async () => {
  const actual = await vi.importActual("../../lib/api");
  return {
    ...actual,
    fetchRuns: vi.fn(),
    fetchStats: vi.fn(),
  };
});

// Mock Recharts to avoid SVG errors in JSDOM
vi.mock("recharts", async () => {
  const actual = await vi.importActual("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => (
      <div style={{ width: 800, height: 400 }}>{children}</div>
    ),
  };
});

const mockFetchRuns = vi.mocked(api.fetchRuns);

describe("EvalDetail", () => {
  const testId = "create dark mode toggle";
  const mockRuns = [
    createMockRun({ id: 1, testId, agentRunner: "gpt-4o", variantName: "Baseline", score: 0.8 }),
    createMockRun({
      id: 2,
      testId,
      agentRunner: "claude-3-5-sonnet",
      variantName: "Expert",
      score: 0.9,
    }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchRuns.mockResolvedValue(mockRuns);
  });

  it("renders the test ID in the heading", async () => {
    renderPage(<EvalDetail />, { path: `/evals/${encodeURIComponent(testId)}` });
    await waitFor(() => {
      const heading = screen.getByRole("heading", { level: 1, name: testId });
      expect(heading).toBeInTheDocument();
    });
  });

  it("shows variants count", async () => {
    renderPage(<EvalDetail />, { path: `/evals/${encodeURIComponent(testId)}` });
    await waitFor(() => {
      expect(screen.getByText(/2 Variants/i)).toBeInTheDocument();
    });
  });

  it("renders the variations grid", async () => {
    renderPage(<EvalDetail />, { path: `/evals/${encodeURIComponent(testId)}` });
    await waitFor(() => {
      expect(screen.getByText("Experiment Variations")).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 3, name: "Baseline" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 3, name: "Expert" })).toBeInTheDocument();
    });
  });

  it("renders the analytics section", async () => {
    renderPage(<EvalDetail />, { path: `/evals/${encodeURIComponent(testId)}` });
    await waitFor(() => {
      expect(screen.getByText("Deep Analytics")).toBeInTheDocument();
      expect(screen.getByText("Historical Performance")).toBeInTheDocument();
      expect(screen.getByText("Capabilities Matrix")).toBeInTheDocument();
      expect(screen.getByText("Score Distribution")).toBeInTheDocument();
    });
  });

  it("renders the run history section", async () => {
    renderPage(<EvalDetail />, { path: `/evals/${encodeURIComponent(testId)}` });
    await waitFor(() => {
      expect(screen.getByText("Run History")).toBeInTheDocument();
    });
  });

  it("shows empty state when no runs", async () => {
    mockFetchRuns.mockResolvedValue([]);
    renderPage(<EvalDetail />, { path: `/evals/${encodeURIComponent(testId)}` });
    await waitFor(() => {
      expect(screen.getByText("No evaluation runs found")).toBeInTheDocument();
    });
  });
});
