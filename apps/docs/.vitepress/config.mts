import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

export default withMermaid(
  defineConfig({
    title: "AgentEval",
    description: "AI coding agent evaluation framework",
    base: "/agent-eval/",
    themeConfig: {
      nav: [
        { text: "Guide", link: "/guide/getting-started" },
        { text: "API", link: "/api/test" },
      ],
      sidebar: [
        {
          text: "Guide",
          items: [
            { text: "Getting Started", link: "/guide/getting-started" },
            { text: "Configuration", link: "/guide/configuration" },
            { text: "Writing Tests", link: "/guide/writing-tests" },
            { text: "Declarative Pipeline", link: "/guide/declarative-pipeline" },
            { text: "Runners", link: "/guide/runners" },
            { text: "Judges", link: "/guide/judges" },
          ],
        },
        {
          text: "Plugins",
          items: [
            { text: "Overview", link: "/guide/plugins" },
            { text: "LLM / Models", link: "/guide/plugins-llm" },
            { text: "Ledger / Storage", link: "/guide/plugins-ledger" },
            { text: "Environments", link: "/guide/plugins-environments" },
          ],
        },
        {
          text: "Tools",
          items: [
            { text: "CLI", link: "/guide/cli" },
            { text: "Dashboard", link: "/guide/dashboard" },
          ],
        },
        {
          text: "API Reference",
          items: [
            { text: "test()", link: "/api/test" },
            { text: "expect()", link: "/api/expect" },
            { text: "Context", link: "/api/context" },
            { text: "defineConfig()", link: "/api/define-config" },
            { text: "Ledger", link: "/api/ledger" },
          ],
        },
        {
          text: "Advanced",
          items: [
            { text: "Architecture", link: "/guide/architecture" },
            { text: "Contributing", link: "/guide/contributing" },
          ],
        },
      ],
      socialLinks: [{ icon: "github", link: "https://github.com/Tlahey/agent-eval" }],
    },
  }),
);
