import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderPage } from "../test/render";
import { Overview } from "./Overview";
import { createMockRuns, createMockStats } from "../test/fixtures";

// Mock recharts to avoid SVG measurement issues in jsdom
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
  fetchStats: vi.fn(),
}));

import { fetchRuns, fetchStats } from "../lib/api";

const mockFetchRuns = vi.mocked(fetchRuns);
const mockFetchStats = vi.mocked(fetchStats);

describe("Overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchRuns.mockResolvedValue(createMockRuns(10));
    mockFetchStats.mockResolvedValue(createMockStats());
  });

  it("renders the Dashboard heading", async () => {
    renderPage(<Overview />, { path: "/" });
    await waitFor(() => {
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
    });
  });

  it("renders KPI cards after data loads", async () => {
    renderPage(<Overview />, { path: "/" });
    await waitFor(() => {
      expect(screen.getByText("Total Runs")).toBeInTheDocument();
      expect(screen.getByText("Average Score")).toBeInTheDocument();
      expect(screen.getByText("Pass Rate")).toBeInTheDocument();
      expect(screen.getByText("Avg Duration")).toBeInTheDocument();
    });
  });

  it("shows the total run count", async () => {
    renderPage(<Overview />, { path: "/" });
    await waitFor(() => {
      expect(screen.getAllByText("10").length).toBeGreaterThan(0);
    });
  });

  it("renders chart section titles", async () => {
    renderPage(<Overview />, { path: "/" });
    await waitFor(() => {
      expect(screen.getByText("Score Trend")).toBeInTheDocument();
      expect(screen.getByText("Distribution")).toBeInTheDocument();
      expect(screen.getByText("Performance Ranking")).toBeInTheDocument();
    });
  });

  it("renders the Recent Runs section", async () => {
    renderPage(<Overview />, { path: "/" });
    await waitFor(() => {
      expect(screen.getByText("Recent Activity")).toBeInTheDocument();
      expect(screen.getByText("View Full Ledger")).toBeInTheDocument();
    });
  });

  it("renders View all link pointing to /runs", async () => {
    renderPage(<Overview />, { path: "/" });
    await waitFor(() => {
      const link = screen.getByText("View Full Ledger").closest("a");
      expect(link).toHaveAttribute("href", "/runs");
    });
  });

  it("shows loading state initially", () => {
    mockFetchRuns.mockReturnValue(new Promise(() => {}));
    mockFetchStats.mockReturnValue(new Promise(() => {}));
    renderPage(<Overview />, { path: "/" });
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("shows empty state when no runs", async () => {
    mockFetchRuns.mockResolvedValue([]);
    mockFetchStats.mockResolvedValue([]);
    renderPage(<Overview />, { path: "/" });
    await waitFor(() => {
      expect(screen.getByText("No evaluation runs found")).toBeInTheDocument();
    });
  });
});
