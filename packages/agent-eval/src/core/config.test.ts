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
import type { IRunnerPlugin } from "../core/interfaces.js";
import type { AgentEvalConfig } from "../core/types.js";

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
    it("accepts runners with unique names", async () => {
      const { CLIRunner } = await import("../runner/plugins/cli.js");
      const r1 = new CLIRunner({ name: "copilot", command: "copilot --prompt={{prompt}}" });
      const r2: IRunnerPlugin = {
        name: "custom",
        model: "custom-model",
        execute: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
      };
      expect(() => validateRunnerNames([r1, r2])).not.toThrow();
    });

    it("throws on duplicate runner names", () => {
      const r1: IRunnerPlugin = {
        name: "copilot",
        model: "m1",
        execute: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
      };
      const r2: IRunnerPlugin = {
        name: "copilot",
        model: "m2",
        execute: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
      };
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
        runners: [{ name: "test", model: "echo", execute: async () => ({}) } as IRunnerPlugin],
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
