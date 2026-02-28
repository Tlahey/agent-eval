import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithRouter } from "../test/render";
import { Sidebar } from "./Sidebar";

vi.mock("../lib/api", () => ({
  fetchTestIds: vi.fn(),
}));

import { fetchTestIds } from "../lib/api";

const mockFetchTestIds = vi.mocked(fetchTestIds);

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchTestIds.mockResolvedValue([]);
  });

  it("renders the AgentEval branding", () => {
    renderWithRouter(<Sidebar />);
    expect(screen.getByText("AgentEval")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders the navigation section", () => {
    renderWithRouter(<Sidebar />);
    expect(screen.getByText("Navigation")).toBeInTheDocument();
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("All Runs")).toBeInTheDocument();
  });

  it("renders the Overview link pointing to /", () => {
    renderWithRouter(<Sidebar />);
    const link = screen.getByText("Overview").closest("a");
    expect(link).toHaveAttribute("href", "/");
  });

  it("renders the All Runs link pointing to /runs", () => {
    renderWithRouter(<Sidebar />);
    const link = screen.getByText("All Runs").closest("a");
    expect(link).toHaveAttribute("href", "/runs");
  });

  it("renders the Evaluations section header", () => {
    renderWithRouter(<Sidebar />);
    expect(screen.getByText("Evaluations")).toBeInTheDocument();
  });

  it("fetches and renders evaluation links", async () => {
    mockFetchTestIds.mockResolvedValue(["add close button", "implement search"]);
    renderWithRouter(<Sidebar />);

    await waitFor(() => {
      expect(screen.getByText("add close button")).toBeInTheDocument();
      expect(screen.getByText("implement search")).toBeInTheDocument();
    });
  });

  it("renders evaluation links with correct href", async () => {
    mockFetchTestIds.mockResolvedValue(["add close button"]);
    renderWithRouter(<Sidebar />);

    await waitFor(() => {
      const link = screen.getByText("add close button").closest("a");
      expect(link).toHaveAttribute("href", "/evals/add%20close%20button");
    });
  });

  it("shows empty state while evals have not loaded yet", () => {
    // Never resolve
    mockFetchTestIds.mockReturnValue(new Promise(() => {}));
    renderWithRouter(<Sidebar />);
    expect(screen.getByText("No evaluations yet")).toBeInTheDocument();
  });

  it("renders footer with version", () => {
    renderWithRouter(<Sidebar />);
    expect(screen.getByText(/v0\.1\.0/)).toBeInTheDocument();
  });

  it("renders connection status indicator", () => {
    renderWithRouter(<Sidebar />);
    expect(screen.getByText(/Connected/)).toBeInTheDocument();
  });
});
