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
      const mockRunner = { name: "test", model: "test-model", execute: async () => ({}) };
      const config = defineConfig({
        runners: [mockRunner],
        judge: {},
      });

      expect(config.runners).toHaveLength(1);
      expect(config.runners[0].name).toBe("test");
    });
  });

  describe("loadConfig", () => {
    it("returns default config when no config file exists", async () => {
      const config = await loadConfig(tmpDir);
      expect(config.rootDir).toBe(tmpDir);
      expect(config.outputDir).toBe(".agenteval");
      expect(config.runners).toEqual([]);
    });

    it("loads a .js config file", async () => {
      writeFileSync(
        join(tmpDir, "agenteval.config.js"),
        `module.exports = {
          runners: [{ name: "test-runner", type: "cli", command: "echo test" }],
          judge: { provider: "openai", model: "gpt-4o" },
        };`,
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
        };`,
      );

      const config = await loadConfig(tmpDir);
      expect(config.outputDir).toBe(".agenteval");
      expect(config.timeout).toBe(300_000);
      expect(config.rootDir).toBe(tmpDir);
      expect(config.testFiles).toBe("**/*.{eval,agent-eval}.{ts,js,mts,mjs}");
    });
  });
});
