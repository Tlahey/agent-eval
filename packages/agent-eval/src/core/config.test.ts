import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadConfig,
  defineConfig,
  validateRunnerNames,
  assertValidPlugins,
} from "../core/config.js";
import type { AgentEvalConfig, RunnerConfig } from "../core/types.js";

function makeTmpDir(): string {
  const dir = join(tmpdir(), `agenteval-cfg-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeCliRunner(name: string, command = `echo "{{prompt}}"`): RunnerConfig {
  return { name, model: { type: "cli" as const, name: "cli", command } };
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
      const mockRunner = {
        name: "test",
        model: { type: "cli" as const, name: "test", command: "echo test" },
      };
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
          runners: [],
          judge: { },
        };`,
      );

      const config = await loadConfig(tmpDir);
      expect(config.judge).toEqual({});
    });

    it("applies defaults for missing optional fields", async () => {
      writeFileSync(
        join(tmpDir, "agenteval.config.js"),
        `module.exports = {
          runners: [],
          judge: {},
        };`,
      );

      const config = await loadConfig(tmpDir);
      expect(config.outputDir).toBe(".agenteval");
      expect(config.timeout).toBe(300_000);
      expect(config.rootDir).toBe(tmpDir);
      expect(config.testFiles).toBe("**/*.{eval,agent-eval}.{ts,js,mts,mjs}");
    });
  });

  describe("validateRunnerNames", () => {
    it("accepts runners with unique names", () => {
      const r1 = makeCliRunner("copilot", "copilot --prompt={{prompt}}");
      const r2 = makeCliRunner("custom", "custom-cmd {{prompt}}");
      expect(() => validateRunnerNames([r1, r2])).not.toThrow();
    });

    it("throws on duplicate runner names", () => {
      const r1 = makeCliRunner("copilot", "cmd1 {{prompt}}");
      const r2 = makeCliRunner("copilot", "cmd2 {{prompt}}");
      expect(() => validateRunnerNames([r1, r2])).toThrow('Duplicate runner name "copilot"');
    });

    it("accepts empty array", () => {
      expect(() => validateRunnerNames([])).not.toThrow();
    });
  });

  describe("assertValidPlugins", () => {
    it("does not throw for valid config", () => {
      const config: AgentEvalConfig = {
        rootDir: tmpDir,
        outputDir: ".agenteval",
        runners: [makeCliRunner("test")],
        judge: {},
      };
      expect(() => assertValidPlugins(config)).not.toThrow();
    });

    it("throws descriptive error for invalid plugins", () => {
      const config = {
        rootDir: tmpDir,
        outputDir: ".agenteval",
        runners: [],
        judge: {},
        ledger: { name: "broken" },
      } as unknown as AgentEvalConfig;
      expect(() => assertValidPlugins(config)).toThrow("Plugin configuration errors");
    });
  });
});
