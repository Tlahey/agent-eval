import { test, expect } from "agent-eval";

test("add loading spinner component", {
  prompt:
    "Create a React component called LoadingSpinner in src/components/LoadingSpinner.tsx. It should render a centered spinning SVG animation with configurable size and color props.",
  iterations: 1,
  expect: async (ctx) => {
    ctx.storeDiff();
    ctx.runCommand("build", "pnpm run build");

    await expect(ctx).toPassJudge({
      criteria:
        "The LoadingSpinner component must: 1) Accept size and color props, 2) Render an SVG-based animation, 3) Be centered, 4) TypeScript types must be correct, 5) Build must pass.",
    });
  },
});
