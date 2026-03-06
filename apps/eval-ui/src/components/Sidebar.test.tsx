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
    expect(screen.getByText("Overview")).toBeInTheDocument();
  });

  it("renders the navigation section", () => {
    renderWithRouter(<Sidebar />);
    expect(screen.getByText("Main")).toBeInTheDocument();
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

    // Top level suite
    expect(await screen.findByText("UI Components")).toBeInTheDocument();

    // Expand it to see tests
    await userEvent.click(screen.getByText("UI Components"));
    expect(await screen.findByText("Banner")).toBeInTheDocument();
  });

  it("renders test links with correct href", async () => {
    mockFetchTestTree.mockResolvedValue([{ name: "my test", type: "test", testId: "my test" }]);
    renderWithRouter(<Sidebar />);

    const link = await screen.findByText("my test");
    expect(link.closest("a")).toHaveAttribute("href", "/evals/my%20test");
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

    // Initially collapsed
    await waitFor(() => {
      expect(screen.getByText("Suite")).toBeInTheDocument();
    });
    expect(screen.queryByText("nested test")).not.toBeInTheDocument();

    // Click to expand
    await user.click(screen.getByText("Suite"));
    expect(await screen.findByText("nested test")).toBeInTheDocument();

    // Click to collapse
    await user.click(screen.getByText("Suite"));
    expect(screen.queryByText("nested test")).not.toBeInTheDocument();
  });

  it("shows empty state while evals have not loaded yet", () => {
    mockFetchTestTree.mockReturnValue(new Promise(() => {}));
    renderWithRouter(<Sidebar />);
    expect(screen.getByText("No evaluations yet")).toBeInTheDocument();
  });

  it("renders footer with version", () => {
    renderWithRouter(<Sidebar />);
    expect(screen.getByText(/v\d+\.\d+\.\d+/)).toBeInTheDocument();
  });

  describe("Theme Selection", () => {
    it("shows the current theme label in the button", () => {
      renderWithRouter(<Sidebar />);
      // Button shows the theme ID capitalized/formatted
      expect(screen.getByText(/nebula/i)).toBeInTheDocument();
    });

    it("opens the theme menu on click", async () => {
      const user = userEvent.setup();
      renderWithRouter(<Sidebar />);

      const themeBtn = screen.getByRole("button", { name: /nebula/i });
      await user.click(themeBtn);

      expect(screen.getByText("Pure Light")).toBeInTheDocument();
      expect(screen.getByText("High Contrast")).toBeInTheDocument();
      expect(screen.getByText("Solarized Light")).toBeInTheDocument();
      expect(screen.getByText("Terra Earth")).toBeInTheDocument();
      expect(screen.getByText("Admiral Navy")).toBeInTheDocument();
      expect(screen.getByText("Vibrant Energy")).toBeInTheDocument();
      expect(screen.getByText("Nord Frost")).toBeInTheDocument();
    });

    it("changes the document theme and localStorage on selection", async () => {
      const user = userEvent.setup();
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

      renderWithRouter(<Sidebar />);

      const themeBtn = screen.getByRole("button", { name: /nebula/i });
      await user.click(themeBtn);

      const highContrastBtn = screen.getByText("High Contrast");
      await user.click(highContrastBtn);

      expect(document.documentElement.getAttribute("data-theme")).toBe("high-contrast");
      expect(setItemSpy).toHaveBeenCalledWith("agent-eval-theme", "high-contrast");
      expect(screen.getByText(/high contrast/i)).toBeInTheDocument();
    });
  });
});
