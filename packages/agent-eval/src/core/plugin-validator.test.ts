import { describe, it, expect } from "vitest";
import {
  validateLedgerPlugin,
  validateLLMPlugin,
  validateJudgePlugin,
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

function makeLLMPlugin(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "test-llm",
    provider: "test",
    defaultModel: "test-model",
    evaluate: async () => ({ pass: true, score: 1, reason: "ok" }),
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

describe("validateLLMPlugin", () => {
  it("returns empty array for valid plugin", () => {
    expect(validateLLMPlugin(makeLLMPlugin())).toEqual([]);
  });

  it("detects missing properties", () => {
    const errors = validateLLMPlugin({ evaluate: async () => ({}) });
    const missingProps = errors.filter((e) => e.expected === "property").map((e) => e.member);
    expect(missingProps).toContain("name");
    expect(missingProps).toContain("provider");
    expect(missingProps).toContain("defaultModel");
  });

  it("detects missing evaluate method", () => {
    const errors = validateLLMPlugin({ name: "x", provider: "y", defaultModel: "z" });
    expect(errors).toHaveLength(1);
    expect(errors[0].member).toBe("evaluate");
  });

  it("does not require optional generate method", () => {
    const errors = validateLLMPlugin(makeLLMPlugin());
    expect(errors).toEqual([]);
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

describe("validatePlugins", () => {
  it("returns empty array when no plugins configured", () => {
    expect(validatePlugins({})).toEqual([]);
  });

  it("validates ledger plugin when present", () => {
    const errors = validatePlugins({ ledger: { name: "bad" } });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].plugin).toBe("LedgerPlugin");
  });

  it("validates llm plugin when present", () => {
    const errors = validatePlugins({ llm: {} });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].plugin).toBe("LLMPlugin");
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

  it("accumulates errors from multiple plugins", () => {
    const errors = validatePlugins({ ledger: "bad" as unknown, llm: null as unknown });
    expect(errors.length).toBe(2);
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
      { plugin: "LLMPlugin", member: "b", expected: "property", message: "second error" },
    ]);
    expect(result).toContain("1. first error");
    expect(result).toContain("2. second error");
  });
});
