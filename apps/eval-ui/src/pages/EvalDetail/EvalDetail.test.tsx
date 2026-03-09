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

const mockFetchRuns = vi.mocked(api.fetchRuns);

describe("EvalDetail", () => {
  const testId = "create dark mode toggle";
  const mockRuns = [
    createMockRun({ id: 1, testId, agentRunner: "copilot", variantName: "Baseline" }),
    createMockRun({ id: 2, testId, agentRunner: "cursor", variantName: "Expert" }),
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
      // Look for headings level 3 for variant names to avoid table cell matches
      expect(screen.getByRole("heading", { level: 3, name: "Baseline" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 3, name: "Expert" })).toBeInTheDocument();
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
