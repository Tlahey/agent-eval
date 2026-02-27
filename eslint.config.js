import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.agenteval/**",
      "**/coverage/**",
      "apps/docs/.vitepress/cache/**",
      "apps/docs/.vitepress/dist/**",
    ],
  },

  // Base JS rules
  js.configs.recommended,

  // TypeScript rules for all TS/TSX files
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["**/*.ts", "**/*.tsx"],
  })),

  // React hooks rules for TSX files
  {
    files: ["**/*.tsx"],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },

  // Project-specific overrides
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },

  // Allow require in CJS config files
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    ...js.configs.recommended,
  },

  // Node.js scripts: allow globals like process, console
  {
    files: ["**/scripts/**/*.mjs", "**/scripts/**/*.js"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
      },
    },
  },

  // Prettier must be last to disable conflicting rules
  eslintConfigPrettier,
);
