import { test, beforeEach } from "agent-eval";

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

test("add loading spinner component", ({ agent, ctx }) => {
  agent.instruct(
    "Create a React component called LoadingSpinner in src/components/LoadingSpinner.tsx. It should render a centered spinning SVG animation with configurable size and color props.",
  );

  ctx.addTask({
    name: "Component exists",
    action: () => ctx.exec("test -f src/components/LoadingSpinner.tsx && echo 'exists'"),
    criteria:
      "LoadingSpinner.tsx must exist, accept size and color props, and render an SVG-based centered animation",
    weight: 2,
  });
});
