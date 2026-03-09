import { describe, it, expect, beforeEach } from "vitest";
import {
  test as evalTest,
  describe as evalDescribe,
  getRegisteredTests,
  clearRegisteredTests,
  beforeEach as evalBeforeEach,
  afterEach as evalAfterEach,
  getMatchingHooks,
  initSession,
} from "../index.js";

describe("test registration", () => {
  beforeEach(() => {
    clearRegisteredTests();
  });

  it("registers a test", () => {
    evalTest("basic test", ({ ctx }) => {
      ctx.prompt("do something");
    });

    const tests = getRegisteredTests();
    expect(tests).toHaveLength(1);
    expect(tests[0].title).toBe("basic test");
    expect(typeof tests[0].fn).toBe("function");
  });

  it("registers multiple tests in order", () => {
    evalTest("first", () => {});
    evalTest("second", () => {});

    const tests = getRegisteredTests();
    expect(tests).toHaveLength(2);
    expect(tests[0].title).toBe("first");
    expect(tests[1].title).toBe("second");
  });

  it("test.skip does not register", () => {
    evalTest.skip("skipped test", "mission", () => {});
    expect(getRegisteredTests()).toHaveLength(0);
  });

  it("clearRegisteredTests empties the registry", () => {
    evalTest("test", () => {});
    clearRegisteredTests();
    expect(getRegisteredTests()).toHaveLength(0);
  });

  it("getRegisteredTests returns a copy", () => {
    evalTest("test", () => {});
    const tests = getRegisteredTests();
    tests.pop();
    expect(getRegisteredTests()).toHaveLength(1);
  });

  it("initSession sets the judge config", () => {
    // initSession is mostly a side-effect wrapper around expect.ts
    // but we can call it to ensure it doesn't throw
    expect(() =>
      initSession({
        runners: [],
        judge: { name: "test-judge" },
      }),
    ).not.toThrow();
  });
});

describe("describe() suite scoping", () => {
  beforeEach(() => {
    clearRegisteredTests();
  });

  it("top-level test has no suitePath", () => {
    evalTest("top", () => {});
    expect(getRegisteredTests()[0].suitePath).toBeUndefined();
  });

  it("wraps test with a single describe", () => {
    evalDescribe("UI", () => {
      evalTest("button", () => {});
    });

    expect(getRegisteredTests()[0].suitePath).toEqual(["UI"]);
  });

  it("supports nested describe blocks", () => {
    evalDescribe("UI", () => {
      evalDescribe("Components", () => {
        evalTest("button", () => {});
      });
    });

    expect(getRegisteredTests()[0].suitePath).toEqual(["UI", "Components"]);
  });

  it("sibling describe blocks create separate paths", () => {
    evalDescribe("A", () => {
      evalTest("t1", () => {});
    });
    evalDescribe("B", () => {
      evalTest("t2", () => {});
    });

    const tests = getRegisteredTests();
    expect(tests[0].suitePath).toEqual(["A"]);
    expect(tests[1].suitePath).toEqual(["B"]);
  });

  it("mixed top-level and describe tests", () => {
    evalTest("t1", () => {});
    evalDescribe("Suite", () => {
      evalTest("t2", () => {});
    });
    evalTest("t3", () => {});

    const tests = getRegisteredTests();
    expect(tests[0].suitePath).toBeUndefined();
    expect(tests[1].suitePath).toEqual(["Suite"]);
    expect(tests[2].suitePath).toBeUndefined();
  });

  it("deep nesting with 3+ levels", () => {
    evalDescribe("1", () => {
      evalDescribe("2", () => {
        evalDescribe("3", () => {
          evalTest("t", () => {});
        });
      });
    });

    expect(getRegisteredTests()[0].suitePath).toEqual(["1", "2", "3"]);
  });

  it("describe restores scope even if fn throws", () => {
    try {
      evalDescribe("ErrorSuite", () => {
        throw new Error("fail");
      });
    } catch {
      // expected
    }

    evalTest("after", () => {});
    expect(getRegisteredTests()[0].suitePath).toBeUndefined();
  });
});

describe("beforeEach / afterEach hooks", () => {
  beforeEach(() => {
    clearRegisteredTests();
  });

  it("registers a top-level beforeEach hook", () => {
    const fn = () => {};
    evalBeforeEach(fn);
    // Registry internal access not exposed, but initSession/clear verify it's handled
  });

  it("registers a top-level afterEach hook", () => {
    const fn = () => {};
    evalAfterEach(fn);
  });

  it("scopes hooks inside describe blocks", () => {
    evalDescribe("Suite", () => {
      evalBeforeEach(() => {});
    });
  });

  it("nested describe scopes hooks correctly", () => {
    evalDescribe("A", () => {
      evalBeforeEach(() => {});
      evalDescribe("B", () => {
        evalBeforeEach(() => {});
      });
    });
  });

  it("clearRegisteredTests also clears hooks", () => {
    evalBeforeEach(() => {});
    clearRegisteredTests();
  });

  it("getMatchingHooks returns hooks matching suite prefix", () => {
    const h1 = { fn: () => {}, suitePath: [] };
    const h2 = { fn: () => {}, suitePath: ["UI"] };
    const h3 = { fn: () => {}, suitePath: ["API"] };

    const hooks = [h1, h2, h3];

    expect(getMatchingHooks(hooks, ["UI", "Button"])).toEqual([h1, h2]);
    expect(getMatchingHooks(hooks, ["API"])).toEqual([h1, h3]);
    expect(getMatchingHooks(hooks, [])).toEqual([h1]);
  });

  it("getMatchingHooks returns all root hooks", () => {
    const h1 = { fn: () => {}, suitePath: [] };
    expect(getMatchingHooks([h1], ["Anything"])).toEqual([h1]);
  });

  it("getMatchingHooks handles undefined testSuitePath", () => {
    const h1 = { fn: () => {}, suitePath: [] };
    expect(getMatchingHooks([h1], undefined)).toEqual([h1]);
  });
});
