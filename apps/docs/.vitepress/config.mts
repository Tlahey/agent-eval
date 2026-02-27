import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

export default withMermaid(
  defineConfig({
    title: "AgentEval",
    description: "AI coding agent evaluation framework",
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
            { text: "Runners", link: "/guide/runners" },
            { text: "Judges", link: "/guide/judges" },
            { text: "CLI", link: "/guide/cli" },
            { text: "Architecture", link: "/guide/architecture" },
            { text: "Contributing", link: "/guide/contributing" },
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
      ],
      socialLinks: [{ icon: "github", link: "https://github.com/dkt/agent-eval" }],
    },
  }),
);
