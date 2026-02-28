import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RunDetailPanel } from "./RunDetailPanel";
import { createMockRun } from "../test/fixtures";

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
    expect(screen.getByText("PASS")).toBeInTheDocument();
  });

  it("shows FAIL badge for failing runs", () => {
    const run = createMockRun({ pass: false });
    render(<RunDetailPanel run={run} onClose={vi.fn()} />);
    expect(screen.getByText("FAIL")).toBeInTheDocument();
  });

  it("renders all 4 tab buttons", () => {
    render(<RunDetailPanel run={defaultRun} onClose={vi.fn()} />);
    expect(screen.getByText("Reason")).toBeInTheDocument();
    expect(screen.getByText("Improve")).toBeInTheDocument();
    expect(screen.getByText("Diff")).toBeInTheDocument();
    expect(screen.getByText("Commands")).toBeInTheDocument();
  });

  it("defaults to showing the Diff tab content", () => {
    render(<RunDetailPanel run={defaultRun} onClose={vi.fn()} />);
    // Diff tab is active by default, should see diff content
    expect(screen.getByText(/changed file/)).toBeInTheDocument();
  });

  it("switches to Reason tab on click", async () => {
    const user = userEvent.setup();
    render(<RunDetailPanel run={defaultRun} onClose={vi.fn()} />);

    await user.click(screen.getByText("Reason"));
    expect(screen.getByText(defaultRun.reason)).toBeInTheDocument();
  });

  it("switches to Improve tab on click", async () => {
    const user = userEvent.setup();
    render(<RunDetailPanel run={defaultRun} onClose={vi.fn()} />);

    await user.click(screen.getByText("Improve"));
    expect(screen.getByText("Suggestions")).toBeInTheDocument();
    expect(screen.getByText(defaultRun.improvement)).toBeInTheDocument();
  });

  it("shows placeholder when no improvement available", async () => {
    const user = userEvent.setup();
    const run = createMockRun({ improvement: "" });
    render(<RunDetailPanel run={run} onClose={vi.fn()} />);

    await user.click(screen.getByText("Improve"));
    expect(screen.getByText("No improvement suggestions.")).toBeInTheDocument();
  });

  it("switches to Commands tab on click", async () => {
    const user = userEvent.setup();
    render(<RunDetailPanel run={defaultRun} onClose={vi.fn()} />);

    await user.click(screen.getByText("Commands"));
    expect(screen.getByText("unit tests")).toBeInTheDocument();
    expect(screen.getByText("type check")).toBeInTheDocument();
  });

  it("shows command count badge on Commands tab", () => {
    render(<RunDetailPanel run={defaultRun} onClose={vi.fn()} />);
    // The Commands tab button contains the label "Commands" and a badge with the count
    const commandsBtn = screen
      .getAllByRole("button")
      .find((btn) => btn.textContent?.includes("Commands"));
    expect(commandsBtn?.textContent).toContain("2");
  });

  it("shows command exit code indicators", async () => {
    const user = userEvent.setup();
    render(<RunDetailPanel run={defaultRun} onClose={vi.fn()} />);

    await user.click(screen.getByText("Commands"));
    expect(screen.getByText("✓")).toBeInTheDocument(); // exitCode 0
    expect(screen.getByText("✗")).toBeInTheDocument(); // exitCode 1
  });

  it("shows no commands placeholder when commands array is empty", async () => {
    const user = userEvent.setup();
    const run = createMockRun({ context: { diff: null, commands: [] } });
    render(<RunDetailPanel run={run} onClose={vi.fn()} />);

    await user.click(screen.getByText("Commands"));
    expect(screen.getByText("No commands recorded")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<RunDetailPanel run={defaultRun} onClose={onClose} />);

    // The X button — find it by role
    const buttons = screen.getAllByRole("button");
    const closeBtn = buttons.find((btn) => btn.querySelector("svg"));
    // The first small button with just an SVG is the close button
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
});
