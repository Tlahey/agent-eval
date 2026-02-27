import { test, expect } from "agent-eval";

test("Add a Close button to the Banner", async ({ agent, ctx }) => {
  await agent.run(
    "Add a Close button to the Banner component in src/components/Banner.tsx. " +
      "The Banner should accept an onClose prop. " +
      "When onClose is provided, render a button with aria-label='Close'. " +
      "Also update the test file src/components/Banner.test.tsx with tests for the close button.",
  );

  ctx.storeDiff();
  await ctx.runCommand("test", "pnpm test");
  await ctx.runCommand("typecheck", "pnpm build");

  await expect(ctx).toPassJudge({
    criteria: `
      - A close button with aria-label="Close" is rendered when onClose is provided
      - The close button calls onClose when clicked
      - All tests pass
      - TypeScript compilation succeeds
    `,
  });
});
