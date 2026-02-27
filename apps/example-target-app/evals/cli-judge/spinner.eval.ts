import { test, expect } from "agent-eval";

test("add loading spinner component", async ({ agent, ctx }) => {
  await agent.run(
    "Create a React component called LoadingSpinner in src/components/LoadingSpinner.tsx. It should render a centered spinning SVG animation with configurable size and color props.",
  );

  // storeDiff + afterEach commands (pnpm test, pnpm build) run automatically

  await expect(ctx).toPassJudge({
    expectedFiles: ["src/components/LoadingSpinner.tsx"],
    criteria:
      "The LoadingSpinner component must: 1) Accept size and color props, 2) Render an SVG-based animation, 3) Be centered, 4) TypeScript types must be correct, 5) Build must pass.",
  });
});
