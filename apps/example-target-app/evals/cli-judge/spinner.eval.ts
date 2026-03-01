import { test } from "agent-eval";

/**
 * This eval file uses config-level beforeEach (see agenteval.config.ts).
 * Common tasks (test, build) are registered automatically by the config.
 * Only test-specific tasks need to be added here.
 */
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
