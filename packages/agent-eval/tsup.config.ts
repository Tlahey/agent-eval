import { defineConfig } from "tsup";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * tsup's `shims: true` strips the `node:` prefix from built-in imports.
 * `node:sqlite` has no unprefixed equivalent, so we restore it post-build.
 */
function restoreNodeSqliteImports() {
  const distDir = join(import.meta.dirname, "dist");
  for (const file of readdirSync(distDir)) {
    if (!file.endsWith(".js") && !file.endsWith(".cjs")) continue;
    const path = join(distDir, file);
    const content = readFileSync(path, "utf-8");
    if (content.includes('"sqlite"') || content.includes("'sqlite'")) {
      writeFileSync(
        path,
        content
          .replace(/from "sqlite"/g, 'from "node:sqlite"')
          .replace(/require\("sqlite"\)/g, 'require("node:sqlite")'),
      );
    }
  }
}

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli/cli.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  shims: true,
  onSuccess: async () => {
    restoreNodeSqliteImports();
  },
  banner: ({ format }) => {
    if (format === "esm") {
      return {
        js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
      };
    }
  },
});
