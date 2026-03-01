import { describe, it, expect } from "vitest";
import {
  validateLedgerPlugin,
  validateJudgePlugin,
  validateEnvironmentPlugin,
  validateModelPlugin,
  validateRunnerPlugin,
  validatePlugins,
  formatPluginErrors,
} from "./plugin-validator.js";

// ─── Helpers ───

function makeLedgerPlugin(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "test-ledger",
    initialize: () => {},
    recordRun: () => {},
    getRuns: () => [],
    getRunById: () => undefined,
    getTestIds: () => [],
    getTestTree: () => [],
    getLatestEntries: () => new Map(),
    getStats: () => [],
    overrideRunScore: () => ({}),
    getRunOverrides: () => [],
    ...overrides,
  };
}

function makeJudgePlugin(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "test-judge",
    judge: async () => ({ pass: true, score: 1, reason: "ok" }),
    ...overrides,
  };
}

// ─── Tests ───

describe("validateLedgerPlugin", () => {
  it("returns empty array for valid plugin", () => {
    expect(validateLedgerPlugin(makeLedgerPlugin())).toEqual([]);
  });

  it("detects null plugin", () => {
    const errors = validateLedgerPlugin(null);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("non-null object");
    expect(errors[0].message).toContain("null");
  });

  it("detects non-object plugin", () => {
    const errors = validateLedgerPlugin("not-an-object");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("non-null object");
    expect(errors[0].message).toContain("string");
  });

  it("detects missing name property", () => {
    const errors = validateLedgerPlugin(makeLedgerPlugin({ name: undefined }));
    expect(errors.some((e) => e.member === "name" && e.expected === "property")).toBe(true);
  });

  it("detects missing methods", () => {
    const errors = validateLedgerPlugin({ name: "incomplete" });
    const missingMethods = errors.filter((e) => e.expected === "method").map((e) => e.member);
    expect(missingMethods).toContain("initialize");
    expect(missingMethods).toContain("recordRun");
    expect(missingMethods).toContain("getRuns");
    expect(missingMethods).toContain("getRunById");
    expect(missingMethods).toContain("getTestIds");
    expect(missingMethods).toContain("getTestTree");
    expect(missingMethods).toContain("getLatestEntries");
    expect(missingMethods).toContain("getStats");
    expect(missingMethods).toContain("overrideRunScore");
    expect(missingMethods).toContain("getRunOverrides");
    expect(missingMethods).toHaveLength(10);
  });

  it("detects a single missing method", () => {
    const plugin = makeLedgerPlugin({ getStats: "not-a-function" });
    const errors = validateLedgerPlugin(plugin);
    expect(errors).toHaveLength(1);
    expect(errors[0].member).toBe("getStats");
    expect(errors[0].message).toContain("getStats()");
  });
});

describe("validateJudgePlugin", () => {
  it("returns empty array for valid plugin", () => {
    expect(validateJudgePlugin(makeJudgePlugin())).toEqual([]);
  });

  it("detects missing judge method", () => {
    const errors = validateJudgePlugin({ name: "bad-judge" });
    expect(errors).toHaveLength(1);
    expect(errors[0].member).toBe("judge");
  });

  it("detects missing name property", () => {
    const errors = validateJudgePlugin({ judge: async () => ({}) });
    expect(errors).toHaveLength(1);
    expect(errors[0].member).toBe("name");
  });
});

describe("validateEnvironmentPlugin", () => {
  it("returns empty array for valid plugin", () => {
    const env = { name: "test", setup: () => {}, execute: () => ({}), getDiff: () => "" };
    expect(validateEnvironmentPlugin(env)).toEqual([]);
  });

  it("detects missing methods", () => {
    const errors = validateEnvironmentPlugin({ name: "bad-env" });
    const missing = errors.map((e) => e.member);
    expect(missing).toContain("setup");
    expect(missing).toContain("execute");
    expect(missing).toContain("getDiff");
    expect(missing).toHaveLength(3);
  });

  it("detects missing name property", () => {
    const errors = validateEnvironmentPlugin({
      setup: () => {},
      execute: () => {},
      getDiff: () => "",
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].member).toBe("name");
  });

  it("does not require optional teardown method", () => {
    const env = { name: "test", setup: () => {}, execute: () => ({}), getDiff: () => "" };
    expect(validateEnvironmentPlugin(env)).toEqual([]);
  });
});

describe("validatePlugins", () => {
  it("returns empty array when no plugins configured", () => {
    expect(validatePlugins({})).toEqual([]);
  });

  it("validates ledger plugin when present", () => {
    const errors = validatePlugins({ ledger: { name: "bad" } });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].plugin).toBe("LedgerPlugin");
  });

  it("validates judge plugin only if it has a judge method", () => {
    // Plain JudgeConfig (provider + model) should NOT be validated as a plugin
    const errors = validatePlugins({ judge: { provider: "openai", model: "gpt-4o" } });
    expect(errors).toEqual([]);
  });

  it("validates judge plugin when it has a judge function", () => {
    const errors = validatePlugins({ judge: { judge: () => {} } });
    expect(errors).toHaveLength(1);
    expect(errors[0].member).toBe("name");
  });

  it("validates environment plugin when present", () => {
    const errors = validatePlugins({ environment: { name: "broken" } });
    expect(errors.length).toBe(3);
    expect(errors[0].plugin).toBe("EnvironmentPlugin");
  });

  it("accumulates errors from multiple plugins", () => {
    const errors = validatePlugins({ ledger: "bad" as unknown, environment: null as unknown });
    expect(errors.length).toBe(2);
  });
});

describe("validateModelPlugin", () => {
  it("returns empty array for valid plugin", () => {
    const model = { name: "openai", modelId: "gpt-4o", createModel: () => ({}) };
    expect(validateModelPlugin(model)).toEqual([]);
  });

  it("detects missing name property", () => {
    const errors = validateModelPlugin({ modelId: "gpt-4o", createModel: () => ({}) });
    expect(errors).toHaveLength(1);
    expect(errors[0].member).toBe("name");
  });

  it("detects missing modelId property", () => {
    const errors = validateModelPlugin({ name: "openai", createModel: () => ({}) });
    expect(errors).toHaveLength(1);
    expect(errors[0].member).toBe("modelId");
  });

  it("detects missing createModel method", () => {
    const errors = validateModelPlugin({ name: "openai", modelId: "gpt-4o" });
    expect(errors).toHaveLength(1);
    expect(errors[0].member).toBe("createModel");
    expect(errors[0].expected).toBe("method");
  });

  it("detects null plugin", () => {
    const errors = validateModelPlugin(null);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("non-null object");
  });
});

describe("validateRunnerPlugin", () => {
  it("returns empty array for valid plugin", () => {
    const runner = { name: "cli", model: "echo", execute: async () => ({}) };
    expect(validateRunnerPlugin(runner)).toEqual([]);
  });

  it("detects missing name property", () => {
    const errors = validateRunnerPlugin({ model: "echo", execute: async () => ({}) });
    expect(errors).toHaveLength(1);
    expect(errors[0].member).toBe("name");
  });

  it("detects missing model property", () => {
    const errors = validateRunnerPlugin({ name: "cli", execute: async () => ({}) });
    expect(errors).toHaveLength(1);
    expect(errors[0].member).toBe("model");
  });

  it("detects missing execute method", () => {
    const errors = validateRunnerPlugin({ name: "cli", model: "echo" });
    expect(errors).toHaveLength(1);
    expect(errors[0].member).toBe("execute");
    expect(errors[0].expected).toBe("method");
  });

  it("detects non-object plugin", () => {
    const errors = validateRunnerPlugin("string");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("non-null object");
  });
});

describe("validatePlugins - runners and judge.llm", () => {
  it("validates runner plugins in runners array", () => {
    const errors = validatePlugins({
      runners: [{ name: "ok", model: "test", execute: async () => ({}) }, { name: "bad" }],
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].plugin).toContain("RunnerPlugin[1]");
  });

  it("validates judge.llm when present", () => {
    const errors = validatePlugins({
      judge: { llm: { name: "openai" } },
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].plugin).toBe("ModelPlugin");
  });

  it("passes for valid runners array", () => {
    const errors = validatePlugins({
      runners: [
        { name: "a", model: "x", execute: async () => ({}) },
        { name: "b", model: "y", execute: async () => ({}) },
      ],
    });
    expect(errors).toEqual([]);
  });
});

describe("formatPluginErrors", () => {
  it("returns empty string for no errors", () => {
    expect(formatPluginErrors([])).toBe("");
  });

  it("formats a single error", () => {
    const result = formatPluginErrors([
      { plugin: "LedgerPlugin", member: "initialize", expected: "method", message: "missing" },
    ]);
    expect(result).toContain("Plugin configuration errors");
    expect(result).toContain("1. missing");
    expect(result).toContain("agenteval.config.ts");
  });

  it("formats multiple errors with numbering", () => {
    const result = formatPluginErrors([
      { plugin: "LedgerPlugin", member: "a", expected: "method", message: "first error" },
      { plugin: "JudgePlugin", member: "b", expected: "property", message: "second error" },
    ]);
    expect(result).toContain("1. first error");
    expect(result).toContain("2. second error");
  });
});
