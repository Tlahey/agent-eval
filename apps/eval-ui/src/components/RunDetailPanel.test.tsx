import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RunDetailPanel } from "./RunDetailPanel";
import { createMockRun } from "../test/fixtures";
import { renderWithRouter } from "../test/render";

describe("RunDetailPanel", () => {
  const defaultRun = createMockRun({
    id: 123,
    testId: "complex-refactoring-task",
    agentRunner: "gpt-4o",
    judgeModel: "gpt-4o",
    variantName: "baseline",
    diff: "diff --git a/src/main.ts b/src/main.ts\n+const x = 1;",
    changedFiles: ["src/main.ts"],
    taskResults: [
      {
        task: { name: "test-task", criteria: "should pass" },
        result: {
          name: "test-task",
          command: "pnpm test",
          stdout: "OK",
          stderr: "",
          exitCode: 0,
          durationMs: 100,
        },
      },
    ],
  });

  it("renders the test ID and agent runner", () => {
    renderWithRouter(<RunDetailPanel run={defaultRun} onClose={vi.fn()} />);
    expect(screen.getByText(defaultRun.testId)).toBeInTheDocument();
    // Agent name should appear somewhere in the panel
    const runners = screen.getAllByText(new RegExp(defaultRun.agentRunner, "i"));
    expect(runners.length).toBeGreaterThan(0);
  });

  it("renders the variant name", () => {
    renderWithRouter(<RunDetailPanel run={defaultRun} onClose={vi.fn()} />);
    // Simply check document content for variant name
    expect(document.body.textContent?.toLowerCase()).toContain("baseline");
  });

  it("switches to Modifications tab on click", async () => {
    const user = userEvent.setup();
    renderWithRouter(<RunDetailPanel run={defaultRun} onClose={vi.fn()} />);

    const modTabs = screen.getAllByText(/Modifications/i);
    await user.click(modTabs[0]);

    // Check if filename is in the document text at all after click
    await waitFor(
      () => {
        expect(document.body.textContent).toContain("main.ts");
      },
      { timeout: 2000 },
    );
  });

  it("shows task count badge on Verifications tab", () => {
    renderWithRouter(<RunDetailPanel run={defaultRun} onClose={vi.fn()} />);
    const verificationsTab = screen.getAllByText(/Verifications/i)[0];
    const btn = verificationsTab.closest("button");
    expect(btn?.textContent).toContain("1");
  });

  it("calls onClose when backdrop is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithRouter(<RunDetailPanel run={defaultRun} onClose={onClose} />);

    const backdrop = document.querySelector(".bg-black\\/60");
    if (backdrop) await user.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });
});
