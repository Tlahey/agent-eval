import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig, defineConfig, resolveRunners, assertValidPlugins } from "../core/config.js";
import type { IModelPlugin, IRunnerPlugin } from "../core/interfaces.js";
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

  describe("resolveRunners", () => {
    it("resolves CLI runner config { name, command } into CLIRunner plugin", async () => {
      const runners = await resolveRunners([
        { name: "copilot", command: "copilot --prompt={{prompt}}" },
      ]);
      expect(runners).toHaveLength(1);
      expect(runners[0].name).toBe("copilot");
      expect(runners[0].model).toBe("copilot --prompt={{prompt}}");
      expect(typeof runners[0].execute).toBe("function");
    });

    it("resolves API runner config { name, model } into APIRunner plugin", async () => {
      const mockModel: IModelPlugin = {
        name: "mock",
        modelId: "mock-model-1",
        createModel: () => ({}),
      };
      const runners = await resolveRunners([{ name: "claude", model: mockModel }]);
      expect(runners).toHaveLength(1);
      expect(runners[0].name).toBe("claude");
      expect(runners[0].model).toBe("mock-model-1");
      expect(typeof runners[0].execute).toBe("function");
    });

    it("passes through custom IRunnerPlugin as-is", async () => {
      const custom: IRunnerPlugin = {
        name: "custom",
        model: "custom-model",
        execute: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
      };
      const runners = await resolveRunners([custom]);
      expect(runners).toHaveLength(1);
      expect(runners[0]).toBe(custom);
    });

    it("resolves mixed configs (CLI + API + custom)", async () => {
      const mockModel: IModelPlugin = {
        name: "mock",
        modelId: "mock-model-1",
        createModel: () => ({}),
      };
      const custom: IRunnerPlugin = {
        name: "custom",
        model: "custom-model",
        execute: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
      };
      const runners = await resolveRunners([
        { name: "copilot", command: "copilot --prompt={{prompt}}" },
        { name: "claude", model: mockModel },
        custom,
      ]);
      expect(runners).toHaveLength(3);
      expect(runners.map((r) => r.name)).toEqual(["copilot", "claude", "custom"]);
    });

    it("throws on duplicate runner names", async () => {
      await expect(
        resolveRunners([
          { name: "copilot", command: "copilot --prompt={{prompt}}" },
          { name: "copilot", command: "copilot2 --prompt={{prompt}}" },
        ]),
      ).rejects.toThrow('Duplicate runner name "copilot"');
    });

    it("returns empty array for empty configs", async () => {
      const runners = await resolveRunners([]);
      expect(runners).toEqual([]);
    });
  });

  describe("assertValidPlugins", () => {
    it("does not throw for valid config", () => {
      const config: AgentEvalConfig = {
        rootDir: tmpDir,
        outputDir: ".agenteval",
        runners: [{ name: "test", command: "echo" }],
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
