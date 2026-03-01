import { test, expect } from "agent-eval";

/**
 * Eval: Add a Close button to the Banner component.
 *
 * This test uses GitHub Copilot CLI with GPT-5 as the model.
 * The CLI output (stdout) is automatically captured by AgentEval
 * and included in the judge prompt alongside the git diff.
 *
 * The judge evaluates both:
 *   - The stdout output from the CLI (agent reasoning, messages)
 *   - The actual code changes (git diff)
 */
test("Add a Close button to the Banner", async ({ agent, ctx }) => {
  agent.instruct(
    "Add a Close button to the Banner component in src/components/Banner.tsx. " +
      "The Banner should accept an onClose prop. " +
      "When onClose is provided, render a button with aria-label='Close'. " +
      "Also update the test file src/components/Banner.test.tsx with tests for the close button.",
  );

  // Verify the close button was added to the source file
  ctx.addTask({
    name: "Close button renders",
    action: () => ctx.exec('grep -q "aria-label" src/components/Banner.tsx && echo "found"'),
    criteria:
      'A close button with aria-label="Close" is rendered when onClose is provided and calls onClose when clicked',
    weight: 2,
  });

  // Verify the agent stdout contains meaningful output
  ctx.addTask({
    name: "Agent stdout captured",
    action: () => {
      const commands = ctx.commands;
      const hasOutput = commands.some((c) => c.stdout && c.stdout.length > 0);
      return Promise.resolve({ stdout: hasOutput ? "stdout captured" : "no stdout", exitCode: 0 });
    },
    criteria: "The CLI agent should produce stdout output that is captured for evaluation",
    weight: 1,
  });

  await expect(ctx).toPassJudge({
    criteria: `
      - Uses a proper close button component
      - Has aria-label "Close"
      - Calls onClose when clicked
      - All tests pass
      - Build succeeds
    `,
    expectedFiles: ["src/components/Banner.tsx", "src/components/Banner.test.tsx"],
  });
});

/**
 * Eval: Create a new utility function.
 *
 * Demonstrates a simpler eval that verifies the agent can create a new file
 * from scratch. The CLI stdout is captured and the judge evaluates the result.
 */
test("Create a debounce utility", async ({ agent, ctx }) => {
  agent.instruct(
    "Create a debounce utility function in src/utils/debounce.ts. " +
      "It should accept a function and a delay in milliseconds. " +
      "Export the debounce function as a named export. " +
      "Create a test file src/utils/debounce.test.ts with tests for the debounce function.",
  );

  ctx.addTask({
    name: "File created",
    action: () => ctx.exec("test -f src/utils/debounce.ts && echo 'exists'"),
    criteria: "debounce.ts must exist and export a properly typed debounce function",
    weight: 2,
  });

  await expect(ctx).toPassJudge({
    criteria: `
      - debounce.ts exists in src/utils/
      - Exports a typed debounce function with generic type parameters
      - debounce.test.ts exists and covers basic debounce behavior
      - All tests pass
      - Build succeeds
    `,
    expectedFiles: ["src/utils/debounce.ts", "src/utils/debounce.test.ts"],
  });
});
