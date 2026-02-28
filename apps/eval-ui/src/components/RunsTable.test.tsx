import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RunsTable, RunnerDot } from "./RunsTable";
import { createMockRun, createMockRuns } from "../test/fixtures";

describe("RunsTable", () => {
  it("shows empty state when no runs", () => {
    render(<RunsTable runs={[]} onSelect={vi.fn()} />);
    expect(screen.getByText("No evaluation runs yet")).toBeInTheDocument();
    expect(screen.getByText("agenteval run")).toBeInTheDocument();
  });

  it("renders table headers", () => {
    const runs = createMockRuns(2);
    render(<RunsTable runs={runs} onSelect={vi.fn()} />);
    expect(screen.getByText("Eval")).toBeInTheDocument();
    expect(screen.getByText("Agent")).toBeInTheDocument();
    expect(screen.getByText("Score")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Duration")).toBeInTheDocument();
    expect(screen.getByText("When")).toBeInTheDocument();
  });

  it("renders a row for each run", () => {
    const runs = createMockRuns(3);
    const { container } = render(<RunsTable runs={runs} onSelect={vi.fn()} />);
    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(3);
  });

  it("displays the test ID in each row", () => {
    const run = createMockRun({ testId: "implement search" });
    render(<RunsTable runs={[run]} onSelect={vi.fn()} />);
    expect(screen.getByText("implement search")).toBeInTheDocument();
  });

  it("displays the agent runner name", () => {
    const run = createMockRun({ agentRunner: "claude-code" });
    render(<RunsTable runs={[run]} onSelect={vi.fn()} />);
    expect(screen.getByText("claude-code")).toBeInTheDocument();
  });

  it("shows PASS badge for passing runs", () => {
    const run = createMockRun({ pass: true });
    render(<RunsTable runs={[run]} onSelect={vi.fn()} />);
    expect(screen.getByText("Pass")).toBeInTheDocument();
  });

  it("shows FAIL badge for failing runs", () => {
    const run = createMockRun({ score: 0.3 });
    render(<RunsTable runs={[run]} onSelect={vi.fn()} />);
    expect(screen.getByText("Fail")).toBeInTheDocument();
  });

  it("shows WARN badge for warning runs", () => {
    const run = createMockRun({ score: 0.65 });
    render(<RunsTable runs={[run]} onSelect={vi.fn()} />);
    expect(screen.getByText("Warn")).toBeInTheDocument();
  });

  it("formats duration in seconds", () => {
    const run = createMockRun({ durationMs: 45000 });
    render(<RunsTable runs={[run]} onSelect={vi.fn()} />);
    expect(screen.getByText("45.0s")).toBeInTheDocument();
  });

  it("calls onSelect when a row is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const run = createMockRun();
    render(<RunsTable runs={[run]} onSelect={onSelect} />);

    const row = screen.getByText(run.testId).closest("tr")!;
    await user.click(row);
    expect(onSelect).toHaveBeenCalledWith(run);
  });

  it("hides Eval column in compact mode", () => {
    const runs = createMockRuns(2);
    render(<RunsTable runs={runs} onSelect={vi.fn()} compact />);
    expect(screen.queryByText("Eval")).not.toBeInTheDocument();
  });

  it("shows Eval column when not compact", () => {
    const runs = createMockRuns(2);
    render(<RunsTable runs={runs} onSelect={vi.fn()} />);
    expect(screen.getByText("Eval")).toBeInTheDocument();
  });

  it("shows Adjusted badge for overridden runs", () => {
    const run = createMockRun({
      override: { score: 0.9, pass: true, reason: "Manual", timestamp: "2025-01-01" },
    });
    render(<RunsTable runs={[run]} onSelect={vi.fn()} />);
    expect(screen.getByText("Adjusted")).toBeInTheDocument();
  });

  it("does not show Adjusted badge for runs without override", () => {
    const run = createMockRun();
    render(<RunsTable runs={[run]} onSelect={vi.fn()} />);
    expect(screen.queryByText("Adjusted")).not.toBeInTheDocument();
  });

  it("uses override score in ScoreRing when present", () => {
    const run = createMockRun({
      score: 0.3,
      override: { score: 0.95, pass: true, reason: "R", timestamp: "2025-01-01" },
    });
    render(<RunsTable runs={[run]} onSelect={vi.fn()} />);
    expect(screen.getByText("95")).toBeInTheDocument();
  });
});

describe("RunnerDot", () => {
  it("renders a colored dot", () => {
    const { container } = render(<RunnerDot runner="copilot" />);
    const dot = container.firstElementChild as HTMLElement;
    expect(dot.style.backgroundColor).toBe("rgb(99, 102, 241)"); // #6366f1
  });

  it("uses a fallback color for unknown runners", () => {
    const { container } = render(<RunnerDot runner="unknown-runner" />);
    const dot = container.firstElementChild as HTMLElement;
    expect(dot.style.backgroundColor).toBe("rgb(148, 163, 184)"); // #94a3b8
  });

  it("applies custom size", () => {
    const { container } = render(<RunnerDot runner="copilot" size={12} />);
    const dot = container.firstElementChild as HTMLElement;
    expect(dot.style.width).toBe("12px");
    expect(dot.style.height).toBe("12px");
  });
});
