import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithRouter } from "../test/render";
import { Sidebar } from "./Sidebar";
import { createMockTree } from "../test/fixtures";

vi.mock("../lib/api", () => ({
  fetchTestTree: vi.fn(),
}));

import { fetchTestTree } from "../lib/api";

const mockFetchTestTree = vi.mocked(fetchTestTree);

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchTestTree.mockResolvedValue([]);
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

  it("fetches and renders tree with suite nodes and test links", async () => {
    mockFetchTestTree.mockResolvedValue(createMockTree());
    renderWithRouter(<Sidebar />);

    await waitFor(() => {
      expect(screen.getByText("UI Components")).toBeInTheDocument();
      expect(screen.getByText("Banner")).toBeInTheDocument();
      expect(screen.getByText("add close button to Banner")).toBeInTheDocument();
      expect(screen.getByText("refactor API service layer")).toBeInTheDocument();
    });
  });

  it("renders test links with correct href", async () => {
    mockFetchTestTree.mockResolvedValue([{ name: "my test", type: "test", testId: "my test" }]);
    renderWithRouter(<Sidebar />);

    await waitFor(() => {
      const link = screen.getByText("my test").closest("a");
      expect(link).toHaveAttribute("href", "/evals/my%20test");
    });
  });

  it("collapses and expands suite nodes on click", async () => {
    const user = userEvent.setup();
    mockFetchTestTree.mockResolvedValue([
      {
        name: "Suite",
        type: "suite",
        children: [{ name: "nested test", type: "test", testId: "nested test" }],
      },
    ]);
    renderWithRouter(<Sidebar />);

    await waitFor(() => {
      expect(screen.getByText("nested test")).toBeInTheDocument();
    });

    // Click to collapse
    await user.click(screen.getByText("Suite"));
    expect(screen.queryByText("nested test")).not.toBeInTheDocument();

    // Click to expand
    await user.click(screen.getByText("Suite"));
    expect(screen.getByText("nested test")).toBeInTheDocument();
  });

  it("shows empty state while evals have not loaded yet", () => {
    mockFetchTestTree.mockReturnValue(new Promise(() => {}));
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
