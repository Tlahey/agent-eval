import { describe, it, expect, beforeEach } from "vitest";
import {
  test as evalTest,
  describe as evalDescribe,
  getRegisteredTests,
  clearRegisteredTests,
  initSession,
} from "../index.js";
import type { AgentEvalConfig } from "../core/types.js";

describe("test registration", () => {
  beforeEach(() => {
    clearRegisteredTests();
  });

  it("registers a test", () => {
    evalTest("my test", async () => {});

    const tests = getRegisteredTests();
    expect(tests).toHaveLength(1);
    expect(tests[0].title).toBe("my test");
    expect(tests[0].fn).toBeTypeOf("function");
  });

  it("registers multiple tests in order", () => {
    evalTest("first", async () => {});
    evalTest("second", async () => {});
    evalTest("third", async () => {});

    const tests = getRegisteredTests();
    expect(tests).toHaveLength(3);
    expect(tests.map((t) => t.title)).toEqual(["first", "second", "third"]);
  });

  it("test.tagged registers with tags", () => {
    evalTest.tagged(["ui", "banner"], "tagged test", async () => {});

    const tests = getRegisteredTests();
    expect(tests).toHaveLength(1);
    expect(tests[0].tags).toEqual(["ui", "banner"]);
  });

  it("test.skip does not register", () => {
    evalTest.skip("skipped", async () => {});

    const tests = getRegisteredTests();
    expect(tests).toHaveLength(0);
  });

  it("clearRegisteredTests empties the registry", () => {
    evalTest("a", async () => {});
    evalTest("b", async () => {});
    expect(getRegisteredTests()).toHaveLength(2);

    clearRegisteredTests();
    expect(getRegisteredTests()).toHaveLength(0);
  });

  it("getRegisteredTests returns a copy", () => {
    evalTest("test", async () => {});

    const tests = getRegisteredTests();
    tests.pop();
    expect(getRegisteredTests()).toHaveLength(1);
  });

  it("initSession sets the judge config", () => {
    const config: AgentEvalConfig = {
      runners: [{ name: "test", type: "cli", command: "echo" }],
      judge: { provider: "openai", model: "gpt-4o" },
    };

    // initSession should not throw
    expect(() => initSession(config)).not.toThrow();
  });
});

describe("describe() suite scoping", () => {
  beforeEach(() => {
    clearRegisteredTests();
  });

  it("top-level test has no suitePath", () => {
    evalTest("standalone", async () => {});

    const tests = getRegisteredTests();
    expect(tests[0].suitePath).toBeUndefined();
  });

  it("wraps test with a single describe", () => {
    evalDescribe("UI Components", () => {
      evalTest("Add button", async () => {});
    });

    const tests = getRegisteredTests();
    expect(tests).toHaveLength(1);
    expect(tests[0].title).toBe("Add button");
    expect(tests[0].suitePath).toEqual(["UI Components"]);
  });

  it("supports nested describe blocks", () => {
    evalDescribe("UI Components", () => {
      evalDescribe("Banner", () => {
        evalTest("Add close button", async () => {});
      });
    });

    const tests = getRegisteredTests();
    expect(tests).toHaveLength(1);
    expect(tests[0].suitePath).toEqual(["UI Components", "Banner"]);
  });

  it("sibling describe blocks create separate paths", () => {
    evalDescribe("UI", () => {
      evalTest("test in UI", async () => {});
    });
    evalDescribe("API", () => {
      evalTest("test in API", async () => {});
    });

    const tests = getRegisteredTests();
    expect(tests).toHaveLength(2);
    expect(tests[0].suitePath).toEqual(["UI"]);
    expect(tests[1].suitePath).toEqual(["API"]);
  });

  it("mixed top-level and describe tests", () => {
    evalTest("standalone", async () => {});
    evalDescribe("Suite", () => {
      evalTest("nested", async () => {});
    });
    evalTest("another standalone", async () => {});

    const tests = getRegisteredTests();
    expect(tests).toHaveLength(3);
    expect(tests[0].suitePath).toBeUndefined();
    expect(tests[1].suitePath).toEqual(["Suite"]);
    expect(tests[2].suitePath).toBeUndefined();
  });

  it("deep nesting with 3+ levels", () => {
    evalDescribe("Level 1", () => {
      evalDescribe("Level 2", () => {
        evalDescribe("Level 3", () => {
          evalTest("deep test", async () => {});
        });
      });
    });

    const tests = getRegisteredTests();
    expect(tests[0].suitePath).toEqual(["Level 1", "Level 2", "Level 3"]);
  });

  it("tagged tests inside describe get suitePath", () => {
    evalDescribe("Suite", () => {
      evalTest.tagged(["fast"], "tagged test", async () => {});
    });

    const tests = getRegisteredTests();
    expect(tests[0].tags).toEqual(["fast"]);
    expect(tests[0].suitePath).toEqual(["Suite"]);
  });

  it("describe restores scope even if fn throws", () => {
    try {
      evalDescribe("Broken", () => {
        throw new Error("oops");
      });
    } catch {
      // expected
    }

    // Scope should be clean — next test should have no suitePath
    evalTest("after broken", async () => {});
    const tests = getRegisteredTests();
    expect(tests[0].suitePath).toBeUndefined();
  });

  it("clearRegisteredTests resets suite stack", () => {
    // Simulate a partial state (not possible in normal use, but defensive)
    evalDescribe("Suite", () => {
      evalTest("test", async () => {});
    });
    clearRegisteredTests();

    evalTest("fresh", async () => {});
    const tests = getRegisteredTests();
    expect(tests[0].suitePath).toBeUndefined();
  });
});
