// Example evaluation test
import { test, expect } from "agent-eval";

test("Add a Close button to the Banner", async ({ agent, ctx }) => {
  // 1. Trigger the agent with a prompt
  await agent.run(
    "Add a Close button to the Banner component. Use an IconButton with an X icon and aria-label 'Close'.",
  );

  // 2. Capture what the agent changed
  ctx.storeDiff();

  // 3. Run validation commands
  await ctx.runCommand("test", "pnpm test -- Banner");
  await ctx.runCommand("build", "pnpm run build");

  // 4. Let the LLM judge evaluate the result
  await expect(ctx).toPassJudge({
    criteria: `
      - Uses an IconButton component for the close action
      - Has aria-label="Close" for accessibility
      - Clicking the button triggers a close/dismiss action
      - All existing tests still pass
      - Build succeeds without TypeScript errors
    `,
  });
});

test.tagged(["ui", "responsive"], "Make Banner responsive", async ({ agent, ctx }) => {
  await agent.run(
    "Make the Banner component responsive. On mobile (<768px), stack content vertically.",
  );

  ctx.storeDiff();
  await ctx.runCommand("build", "pnpm run build");

  await expect(ctx).toPassJudge({
    criteria: `
      - Uses CSS media queries or responsive utility classes
      - Content stacks vertically on screens < 768px
      - No horizontal overflow on mobile
      - Build compiles successfully
    `,
  });
});
