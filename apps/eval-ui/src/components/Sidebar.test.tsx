import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "./Sidebar";
import { renderWithRouter } from "../test/render";
import * as api from "../lib/api";
import { createMockTree } from "../test/fixtures";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual("../lib/api");
  return {
    ...actual,
    fetchTestTree: vi.fn(),
  };
});

const mockFetchTestTree = vi.mocked(api.fetchTestTree);

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchTestTree.mockResolvedValue(createMockTree());
  });

  it("renders the AgentEval branding", () => {
    renderWithRouter(<Sidebar />);
    expect(screen.getByText("AgentEval")).toBeInTheDocument();
  });

  it("renders the navigation section", () => {
    renderWithRouter(<Sidebar />);
    expect(screen.getByText("Main")).toBeInTheDocument();
  });

  it("renders the Overview link pointing to /", () => {
    renderWithRouter(<Sidebar />);
    const link = screen.getByRole("link", { name: /overview/i });
    expect(link).toHaveAttribute("href", "/");
  });

  it("renders the All Runs link pointing to /runs", () => {
    renderWithRouter(<Sidebar />);
    const link = screen.getByRole("link", { name: /all runs/i });
    expect(link).toHaveAttribute("href", "/runs");
  });

  it("renders the Evaluations section header", () => {
    renderWithRouter(<Sidebar />);
    expect(screen.getByText(/Tree View/i)).toBeInTheDocument();
  });

  it("fetches and renders tree with suite nodes and test links", async () => {
    renderWithRouter(<Sidebar />);

    // Top level suite from createMockTree() is "AB Tests"
    expect(await screen.findByText(/AB Tests/i)).toBeInTheDocument();

    // Expand it to see tests
    const user = userEvent.setup();
    const suiteBtn = await screen.findByText(/AB Tests/i);
    await user.click(suiteBtn);

    // Check for a testId from createMockTree()
    expect(await screen.findByText(/complex-refactoring-task/i)).toBeInTheDocument();
  });

  it("renders footer with version", () => {
    renderWithRouter(<Sidebar />);
    expect(screen.getByText(/v\d+\.\d+\.\d+/)).toBeInTheDocument();
  });

  describe("Theme Selection", () => {
    it("shows the current theme label in the button", () => {
      renderWithRouter(<Sidebar />);
      // Match text nebula in the sidebar
      expect(screen.getAllByText(/nebula/i).length).toBeGreaterThan(0);
    });

    it("opens theme dropdown on click", async () => {
      const user = userEvent.setup();
      renderWithRouter(<Sidebar />);

      const themeBtn = screen.getAllByRole("button", { name: /nebula/i })[0];
      await user.click(themeBtn);

      // Verify that at least one alternative theme is visible
      await waitFor(() => {
        expect(screen.queryAllByText(/midnight/i).length).toBeGreaterThan(0);
      });
    });
  });
});
