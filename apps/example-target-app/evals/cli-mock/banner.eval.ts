import { test, expect } from "agent-eval";

test("Add a Close button to the Banner", async ({ agent, ctx }) => {
  await agent.run(
    "Add a Close button to the Banner component. Use a button with aria-label Close.",
  );

  // storeDiff + afterEach commands (pnpm test, pnpm build) run automatically

  await expect(ctx).toPassJudge({
    expectedFiles: ["src/components/Banner.tsx", "src/components/Banner.test.tsx"],
    criteria: `
      - The Banner component now accepts an onClose prop
      - A close button with aria-label="Close" is rendered when onClose is provided
      - The close button is not rendered when onClose is not provided
      - All tests pass (including new tests for the close functionality)
      - TypeScript compilation succeeds without errors
    `,
  });
});
