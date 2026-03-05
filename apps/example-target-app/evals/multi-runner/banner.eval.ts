import { test, expect } from "agent-eval";

/**
 * Multi-runner eval — the same test runs against every runner in the config.
 *
 * Each runner (claude-sonnet, gpt-4o, aider) receives the same prompt.
 * The judge scores each independently. Compare results in the dashboard.
 */
test("Add a Close button to the Banner", async ({ agent, ctx }) => {
  agent.instruct(
    "Add a Close button to the Banner component in src/components/Banner.tsx. " +
      "The Banner should accept an onClose prop. " +
      "When onClose is provided, render a button with aria-label='Close'. " +
      "Also update the test file src/components/Banner.test.tsx with tests for the close button.",
  );

  ctx.addTask({
    name: "Close button renders",
    action: ({ exec }) => exec('grep -q "aria-label" src/components/Banner.tsx && echo "found"'),
    criteria:
      'A close button with aria-label="Close" is rendered when onClose is provided and calls onClose when clicked',
    weight: 2,
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

test("Create a debounce utility", async ({ agent, ctx }) => {
  agent.instruct(
    "Create a debounce utility function in src/utils/debounce.ts. " +
      "It should accept a function and a delay in milliseconds. " +
      "Export the debounce function as a named export. " +
      "Create a test file src/utils/debounce.test.ts with tests for the debounce function.",
  );

  ctx.addTask({
    name: "File created",
    action: ({ exec }) => exec("test -f src/utils/debounce.ts && echo 'exists'"),
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
