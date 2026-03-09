import { test, expect } from "@tlahey/agent-eval";

test(
  "Close Button Experiment",
  [
    {
      name: "Direct Instruction",
      runner: "mock-agent",
    },
    {
      name: "Expert Persona",
      runner: "mock-agent",
      enrichPrompt:
        "You are a world-class React developer. Your task: {{prompt}} Ensure accessibility.",
    },
    {
      name: "Detailed Constraints",
      runner: "mock-agent",
      enrichPrompt: "{{prompt}} Use aria-label='Close', ensure onClose prop is used.",
    },
  ],
  async ({ ctx, variant }) => {
    ctx.prompt(`
      Add a Close button to the Banner component.
    `);

    ctx.addTask({
      name: "Close button renders",
      action: ({ exec }) => exec('grep -q "aria-label" src/components/Banner.tsx && echo "found"'),
      criteria: 'A close button with aria-label="Close" is rendered',
      weight: 2,
    });

    await expect(ctx).toPassJudge({
      criteria: `
        - The Banner component has a close button
        - The button is accessible (aria-label)
        - The code quality meets the ${variant?.name} standards
      `,
      requiredCommands: ["pnpm build"],
      expectedFiles: ["src/components/Banner.tsx"],
    });
  },
);
