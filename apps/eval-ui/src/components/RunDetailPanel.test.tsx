import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RunDetailPanel } from "./RunDetailPanel";
import { createMockRun } from "../test/fixtures";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual("../lib/api");
  return {
    ...actual,
    overrideScore: vi.fn().mockResolvedValue({
      score: 0.9,
      pass: true,
      status: "PASS",
      reason: "test",
      timestamp: "2025-01-01",
    }),
    fetchRuns: vi.fn().mockResolvedValue([]),
  };
});

describe("RunDetailPanel", () => {
  const defaultRun = createMockRun();

  it("renders the test ID in the header", () => {
    render(<RunDetailPanel run={defaultRun} onClose={vi.fn()} />);
    expect(screen.getByText(defaultRun.testId)).toBeInTheDocument();
  });

  it("renders the agent runner name", () => {
    render(<RunDetailPanel run={defaultRun} onClose={vi.fn()} />);
    expect(screen.getByText(defaultRun.agentRunner)).toBeInTheDocument();
  });

  it("renders the judge model", () => {
    render(<RunDetailPanel run={defaultRun} onClose={vi.fn()} />);
    expect(screen.getByText(defaultRun.judgeModel)).toBeInTheDocument();
  });

  it("shows PASS badge for passing runs", () => {
    const run = createMockRun({ pass: true });
    render(<RunDetailPanel run={run} onClose={vi.fn()} />);
    expect(screen.getByText("Above Threshold")).toBeInTheDocument();
  });

  it("shows FAIL badge for failing runs", () => {
    const run = createMockRun({ score: 0.3 });
    render(<RunDetailPanel run={run} onClose={vi.fn()} />);
    expect(screen.getByText("Below Threshold")).toBeInTheDocument();
  });

  it("renders the active tabs", () => {
    render(<RunDetailPanel run={defaultRun} onClose={vi.fn()} />);
    expect(screen.getByText("Analysis")).toBeInTheDocument();
    expect(screen.getByText("Modifications")).toBeInTheDocument();
    expect(screen.getByText("Verifications")).toBeInTheDocument();
    expect(screen.getByText("Telemetry")).toBeInTheDocument();
  });

  it("defaults to showing the Analysis tab content", () => {
    render(<RunDetailPanel run={defaultRun} onClose={vi.fn()} />);
    // Analysis tab is active by default
    expect(screen.getByText("Judgment Analysis")).toBeInTheDocument();
    expect(screen.getByText("Strategic Feedback")).toBeInTheDocument();
  });

  it("switches to Modifications tab on click", async () => {
    const user = userEvent.setup();
    render(<RunDetailPanel run={defaultRun} onClose={vi.fn()} />);

    await user.click(screen.getByText("Modifications"));
    // Look for the filename in the DiffViewer header
    expect(screen.getByText(defaultRun.changedFiles[0])).toBeInTheDocument();
  });

  it("shows improvement content in analysis tab", () => {
    render(<RunDetailPanel run={defaultRun} onClose={vi.fn()} />);
    expect(screen.getByText(defaultRun.improvement)).toBeInTheDocument();
  });

  it("shows placeholder when no improvement available", () => {
    const run = createMockRun({ improvement: "", score: 1.0 });
    render(<RunDetailPanel run={run} onClose={vi.fn()} />);
    expect(
      screen.getByText("Optimal solution achieved. No enhancements required."),
    ).toBeInTheDocument();
  });

  it("shows task count badge on Verifications tab", () => {
    render(<RunDetailPanel run={defaultRun} onClose={vi.fn()} />);
    const tasksBtn = screen
      .getAllByRole("button")
      .find((btn) => btn.textContent?.includes("Verifications"));
    expect(tasksBtn?.textContent).toContain("1");
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<RunDetailPanel run={defaultRun} onClose={onClose} />);

    // The X close button is the last button with an SVG in the header
    const buttons = screen.getAllByRole("button");
    const closeBtn = buttons.find((btn) => {
      const svg = btn.querySelector("svg");
      // Look for button that is NOT the pencil button (no title attribute)
      return svg && !btn.getAttribute("title");
    });
    if (closeBtn) await user.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when backdrop is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<RunDetailPanel run={defaultRun} onClose={onClose} />);

    // The backdrop is the first fixed div
    const backdrop = container.querySelector(".animate-fade-in") as HTMLElement;
    if (backdrop) await user.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it("renders the score ring with the correct score", () => {
    const run = createMockRun({ score: 0.92 });
    render(<RunDetailPanel run={run} onClose={vi.fn()} />);
    expect(screen.getByText("92")).toBeInTheDocument();
  });

  it("formats duration correctly", () => {
    const run = createMockRun({ durationMs: 123456 });
    render(<RunDetailPanel run={run} onClose={vi.fn()} />);
    expect(screen.getByText("123.5s")).toBeInTheDocument();
  });

  it("shows Adjusted badge when run has override", () => {
    const run = createMockRun({
      override: {
        score: 0.9,
        pass: true,
        status: "PASS",
        reason: "Manual review",
        timestamp: "2025-01-01",
      },
    });
    render(<RunDetailPanel run={run} onClose={vi.fn()} />);
    expect(screen.getByText("Adjusted")).toBeInTheDocument();
  });

  it("uses override score for display when present", () => {
    const run = createMockRun({
      score: 0.3,
      override: {
        score: 0.95,
        pass: true,
        status: "PASS",
        reason: "Review",
        timestamp: "2025-01-01",
      },
    });
    render(<RunDetailPanel run={run} onClose={vi.fn()} />);
    // Should show override score (95) not original score (30)
    expect(screen.getByText("95")).toBeInTheDocument();
  });

  it("renders the edit score (pencil) button", () => {
    render(<RunDetailPanel run={defaultRun} onClose={vi.fn()} />);
    const pencilBtn = screen.getByTitle("Override score");
    expect(pencilBtn).toBeInTheDocument();
  });

  it("opens override modal when pencil button is clicked", async () => {
    const user = userEvent.setup();
    render(<RunDetailPanel run={defaultRun} onClose={vi.fn()} />);

    await user.click(screen.getByTitle("Override score"));
    expect(screen.getByText("Override Score")).toBeInTheDocument();
  });
});
