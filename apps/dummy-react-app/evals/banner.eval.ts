// E2E eval scenario: exercises the full AgentEval pipeline
import { test, expect } from "agent-eval";

test("Add a Close button to the Banner", async ({ agent, ctx }) => {
  // 1. Trigger the agent with a prompt
  await agent.run(
    "Add a Close button to the Banner component. Use a button with aria-label Close."
  );

  // 2. Capture what the agent changed
  ctx.storeDiff();

  // 3. Run validation commands
  await ctx.runCommand("test", "pnpm test");
  await ctx.runCommand("typecheck", "pnpm build");

  // 4. Let the LLM judge evaluate the result
  await expect(ctx).toPassJudge({
    criteria: `
      - The Banner component now accepts an onClose prop
      - A close button with aria-label="Close" is rendered when onClose is provided
      - The close button is not rendered when onClose is not provided
      - All tests pass (including new tests for the close functionality)
      - TypeScript compilation succeeds without errors
    `,
  });
});
