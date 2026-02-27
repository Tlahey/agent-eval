import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig, defineConfig } from "../core/config.js";

function makeTmpDir(): string {
  const dir = join(tmpdir(), `agenteval-cfg-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("config", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("defineConfig", () => {
    it("returns the config object as-is (identity helper)", () => {
      const config = defineConfig({
        runners: [{ name: "test", type: "cli", command: "echo hi" }],
        judge: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
      });

      expect(config.runners).toHaveLength(1);
      expect(config.judge.provider).toBe("anthropic");
    });
  });

  describe("loadConfig", () => {
    it("throws when no config file exists", async () => {
      await expect(loadConfig(tmpDir)).rejects.toThrow("No agenteval config found");
    });

    it("loads a .js config file", async () => {
      writeFileSync(
        join(tmpDir, "agenteval.config.js"),
        `module.exports = {
          runners: [{ name: "test-runner", type: "cli", command: "echo test" }],
          judge: { provider: "openai", model: "gpt-4o" },
        };`
      );

      const config = await loadConfig(tmpDir);
      expect(config.runners[0].name).toBe("test-runner");
      expect(config.judge.model).toBe("gpt-4o");
    });

    it("applies defaults for missing optional fields", async () => {
      writeFileSync(
        join(tmpDir, "agenteval.config.js"),
        `module.exports = {
          runners: [{ name: "r", type: "cli", command: "echo" }],
          judge: { provider: "anthropic", model: "m" },
        };`
      );

      const config = await loadConfig(tmpDir);
      expect(config.outputDir).toBe(".agenteval");
      expect(config.timeout).toBe(300_000);
      expect(config.rootDir).toBe(tmpDir);
      expect(config.testFiles).toBe("**/*.eval.{ts,js,mts,mjs}");
    });
  });
});
