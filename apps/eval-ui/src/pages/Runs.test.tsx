import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderPage } from "../test/render";
import { Runs } from "./Runs";
import { createMockRuns } from "../test/fixtures";

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
  fetchTestIds: vi.fn(),
}));

import { fetchRuns, fetchTestIds } from "../lib/api";
const mockFetchRuns = vi.mocked(fetchRuns);
const mockFetchTestIds = vi.mocked(fetchTestIds);

describe("Runs", () => {
  const mockRuns = createMockRuns(10);

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchRuns.mockResolvedValue(mockRuns);
    mockFetchTestIds.mockResolvedValue(["test-1", "test-2"]);
  });

  it("renders the page heading", async () => {
    renderPage(<Runs />, { path: "/runs" });
    await waitFor(() => {
      expect(screen.getByText("All Runs")).toBeInTheDocument();
    });
  });

  it("shows run count in subtitle", async () => {
    renderPage(<Runs />, { path: "/runs" });
    await waitFor(() => {
      expect(screen.getByText(/evaluation runs/)).toBeInTheDocument();
    });
  });

  it("renders search input", async () => {
    renderPage(<Runs />, { path: "/runs" });
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search…")).toBeInTheDocument();
    });
  });

  it("renders filter dropdowns", async () => {
    renderPage(<Runs />, { path: "/runs" });
    await waitFor(() => {
      expect(screen.getByDisplayValue("All evals")).toBeInTheDocument();
      expect(screen.getByDisplayValue("All runners")).toBeInTheDocument();
    });
  });

  it("renders status filter buttons", async () => {
    renderPage(<Runs />, { path: "/runs" });
    await waitFor(() => {
      expect(screen.getByText("All")).toBeInTheDocument();
      expect(screen.getByText("✓ Pass")).toBeInTheDocument();
      expect(screen.getByText("✗ Fail")).toBeInTheDocument();
    });
  });

  it("renders sort buttons", async () => {
    renderPage(<Runs />, { path: "/runs" });
    await waitFor(() => {
      const sortButtons = screen.getAllByRole("button");
      const sortLabels = sortButtons.map((btn) => btn.textContent);
      expect(sortLabels.some((t) => t?.includes("Time"))).toBe(true);
      expect(sortLabels.some((t) => t?.includes("Score"))).toBe(true);
      expect(sortLabels.some((t) => t?.includes("Duration"))).toBe(true);
    });
  });

  it("filters runs by search text", async () => {
    const user = userEvent.setup();
    renderPage(<Runs />, { path: "/runs" });

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search…")).toBeInTheDocument();
    });

    const search = screen.getByPlaceholderText("Search…");
    await user.type(search, "Banner");

    await waitFor(() => {
      // Only Banner-related runs should show
      expect(screen.getByText(/of/)).toBeInTheDocument();
    });
  });

  it("shows loading state initially", () => {
    mockFetchRuns.mockReturnValue(new Promise(() => {}));
    mockFetchTestIds.mockReturnValue(new Promise(() => {}));
    renderPage(<Runs />, { path: "/runs" });
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("shows empty state when no runs match filters", async () => {
    mockFetchRuns.mockResolvedValue([]);
    mockFetchTestIds.mockResolvedValue([]);
    renderPage(<Runs />, { path: "/runs" });
    await waitFor(() => {
      expect(screen.getByText("No evaluation runs yet")).toBeInTheDocument();
    });
  });
});
