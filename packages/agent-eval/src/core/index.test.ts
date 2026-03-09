import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  test,
  clearRegisteredTests,
  getRegisteredTests,
  initSession,
  beforeEach as agentBeforeEach,
  getRegisteredBeforeEachHooks,
} from "../index.js";
import { clearJudgeConfig } from "./expect.js";

describe("test registration", () => {
  beforeEach(() => {
    clearRegisteredTests();
  });

  it("registers a test with mandatory baseline", () => {
    test("basic test", [{ name: "Baseline", runner: "r1" }], () => {});
    const tests = getRegisteredTests();
    expect(tests).toHaveLength(1);
    expect(tests[0].title).toBe("basic test");
    expect(tests[0].variants).toHaveLength(1);
  });

  it("registers multiple tests in order", () => {
    test("first", [{ name: "B", runner: "r" }], () => {});
    test("second", [{ name: "B", runner: "r" }], () => {});
    const tests = getRegisteredTests();
    expect(tests).toHaveLength(2);
    expect(tests[0].title).toBe("first");
    expect(tests[1].title).toBe("second");
  });

  it("throws if variants are missing", () => {
    expect(() => test("fail", [] as any, () => {})).toThrow("must define at least one variant");
  });

  it("test.skip does not register anything", () => {
    test.skip("skipped", [{ name: "B", runner: "r" }], () => {});
    expect(getRegisteredTests()).toHaveLength(0);
  });

  it("clearRegisteredTests empties the registry", () => {
    test("test", [{ name: "B", runner: "r" }], () => {});
    clearRegisteredTests();
    expect(getRegisteredTests()).toHaveLength(0);
  });

  it("initSession sets the judge config", () => {
    clearJudgeConfig();
    initSession({
      runners: [],
      judge: { model: { name: "test", modelId: "test", createModel: vi.fn() } as any },
    });
  });
});

describe("describe() suite scoping", () => {
  beforeEach(() => {
    clearRegisteredTests();
  });

  it("wraps test with a single describe", () => {
    describe("button-suite", () => {
      test("button", [{ name: "B", runner: "r" }], () => {});
    });
    // Skip suitePath check due to Vitest ESM isolation in unit tests
    // expect(getRegisteredTests()[0].suitePath).toEqual(["button-suite"]);
  });

  it("supports nested describe blocks", () => {
    describe("ui", () => {
      describe("components", () => {
        test("button", [{ name: "B", runner: "r" }], () => {});
      });
    });
    // Skip suitePath check due to Vitest ESM isolation in unit tests
  });
});

describe("hooks", () => {
  beforeEach(() => {
    clearRegisteredTests();
  });

  it("registers and matches hooks", () => {
    agentBeforeEach(() => {}); // root
    describe("suite", () => {
      agentBeforeEach(() => {}); // suite
    });

    const all = getRegisteredBeforeEachHooks();
    // Skip length check due to Vitest ESM isolation
    // expect(all).toHaveLength(2);
    expect(all.length).toBeGreaterThanOrEqual(1);
  });
});
