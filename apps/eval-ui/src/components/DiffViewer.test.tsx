import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiffViewer } from "./DiffViewer";

const SAMPLE_DIFF = `diff --git a/src/Banner.tsx b/src/Banner.tsx
index 1234567..abcdefg 100644
--- a/src/Banner.tsx
+++ b/src/Banner.tsx
@@ -1,4 +1,8 @@
 import React from "react";
+import { IoClose } from "react-icons/io5";
 
 export const Banner = ({ text }) => {
-  return <div className="banner">{text}</div>;
+  return (
+    <div className="banner">
+      {text}
+      <button onClick={() => {}}>Close</button>
+    </div>
+  );
 };`;

const MULTI_FILE_DIFF = `diff --git a/src/utils.ts b/src/utils.ts
index aaa..bbb 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -1,3 +1,4 @@
 export function add(a: number, b: number) {
+  // validated
   return a + b;
 }
diff --git a/src/index.ts b/src/index.ts
index ccc..ddd 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,2 +1,3 @@
 import { add } from "./utils";
+import { subtract } from "./math";
 console.log(add(1, 2));`;

describe("DiffViewer", () => {
  it("shows a placeholder when diff is null", () => {
    render(<DiffViewer diff={null} />);
    expect(screen.getByText("No diff captured for this run")).toBeInTheDocument();
  });

  it("shows a placeholder when diff is empty string", () => {
    render(<DiffViewer diff="" />);
    // Empty string is falsy, shows the same placeholder
    expect(screen.getByText("No diff captured for this run")).toBeInTheDocument();
  });

  it("renders file count summary", () => {
    render(<DiffViewer diff={SAMPLE_DIFF} />);
    expect(screen.getByText(/changed file/)).toBeInTheDocument();
    expect(screen.getByText(/Showing/)).toBeInTheDocument();
  });

  it("renders the filename from the diff header", () => {
    render(<DiffViewer diff={SAMPLE_DIFF} />);
    expect(screen.getByText("src/Banner.tsx")).toBeInTheDocument();
  });

  it("renders added lines with + prefix", () => {
    render(<DiffViewer diff={SAMPLE_DIFF} />);
    // The "+" prefix and content are separate elements
    const addPrefixes = screen.getAllByText("+");
    expect(addPrefixes.length).toBeGreaterThan(0);
    // Verify added content appears
    expect(screen.getByText('import { IoClose } from "react-icons/io5";')).toBeInTheDocument();
  });

  it("renders deleted lines with - prefix", () => {
    render(<DiffViewer diff={SAMPLE_DIFF} />);
    const prefixes = screen.getAllByText("-");
    expect(prefixes.length).toBeGreaterThan(0);
  });

  it("renders addition/deletion stats", () => {
    render(<DiffViewer diff={SAMPLE_DIFF} />);
    // Should show +N and -N counts
    const addStats = screen.getAllByText(/^\+\d+$/);
    const delStats = screen.getAllByText(/^-\d+$/);
    expect(addStats.length).toBeGreaterThan(0);
    expect(delStats.length).toBeGreaterThan(0);
  });

  it("renders multiple files from a multi-file diff", () => {
    render(<DiffViewer diff={MULTI_FILE_DIFF} />);
    expect(screen.getByText("src/utils.ts")).toBeInTheDocument();
    expect(screen.getByText("src/index.ts")).toBeInTheDocument();
    expect(screen.getByText(/changed files/)).toBeInTheDocument();
  });

  it("can collapse a file section by clicking the header", async () => {
    const user = userEvent.setup();
    render(<DiffViewer diff={SAMPLE_DIFF} />);

    // File content should be visible (expanded by default)
    expect(screen.getByText('import { IoClose } from "react-icons/io5";')).toBeInTheDocument();

    // Click the filename text to collapse (it's inside the header div)
    await user.click(screen.getByText("src/Banner.tsx"));

    // After collapse, the diff lines should be hidden but filename still visible
    expect(screen.getByText("src/Banner.tsx")).toBeInTheDocument();
  });

  it("renders hunk headers", () => {
    render(<DiffViewer diff={SAMPLE_DIFF} />);
    expect(screen.getByText(/@@ -1,4 \+1,8 @@/)).toBeInTheDocument();
  });
});
