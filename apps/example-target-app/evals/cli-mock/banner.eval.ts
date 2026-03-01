import { test, beforeEach } from "agent-eval";

/**
 * Declarative pipeline example — common verification tasks are registered
 * in beforeEach, and each test only declares its agent instruction.
 */
beforeEach(({ ctx }) => {
  ctx.addTask({
    name: "Tests",
    action: () => ctx.exec("pnpm test"),
    criteria: "All existing and new tests must pass",
    weight: 3,
  });

  ctx.addTask({
    name: "Build",
    action: () => ctx.exec("pnpm build"),
    criteria: "TypeScript compilation must succeed with zero errors",
    weight: 2,
  });
});

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
