import { test } from "agent-eval";

/**
 * This eval file uses config-level beforeEach (see agenteval.config.ts).
 * Common tasks (test, build) are registered automatically by the config.
 * Only test-specific tasks need to be added here.
 */
test("Add a Close button to the Banner", ({ agent, ctx }) => {
  agent.instruct(
    "Add a Close button to the Banner component in src/components/Banner.tsx. " +
      "The Banner should accept an onClose prop. " +
      "When onClose is provided, render a button with aria-label='Close'. " +
      "Also update the test file src/components/Banner.test.tsx with tests for the close button.",
  );

  ctx.addTask({
    name: "Close button renders",
    action: () => ctx.exec('grep -q "aria-label" src/components/Banner.tsx && echo "found"'),
    criteria:
      'A close button with aria-label="Close" is rendered when onClose is provided and calls onClose when clicked',
    weight: 2,
  });
});
