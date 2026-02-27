import { describe, it, expect, beforeEach } from "vitest";
import {
  test as evalTest,
  getRegisteredTests,
  clearRegisteredTests,
} from "../index.js";

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
});
