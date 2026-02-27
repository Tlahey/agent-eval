#!/usr/bin/env node

/**
 * Mock agent script for E2E testing.
 * Simulates an AI coding agent by writing a predictable code change.
 * Usage: node scripts/mock-agent.mjs "Add a Close button to the Banner"
 */

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const prompt = process.argv[2] ?? "";

if (prompt.toLowerCase().includes("close button")) {
  // Simulate: agent adds a close button to the Banner component
  const bannerCode = `interface BannerProps {
  message: string;
  variant?: "info" | "warning" | "error";
  onClose?: () => void;
}

export function Banner({ message, variant = "info", onClose }: BannerProps) {
  const colors = {
    info: { bg: "#e0f2fe", border: "#0284c7", text: "#0c4a6e" },
    warning: { bg: "#fef9c3", border: "#ca8a04", text: "#713f12" },
    error: { bg: "#fee2e2", border: "#dc2626", text: "#7f1d1d" },
  };

  const style = colors[variant];

  return (
    <div
      role="alert"
      style={{
        padding: "12px 16px",
        backgroundColor: style.bg,
        border: \`1px solid \${style.border}\`,
        borderRadius: "8px",
        color: style.text,
        fontFamily: "system-ui, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <p style={{ margin: 0 }}>{message}</p>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "18px",
            color: style.text,
            padding: "4px 8px",
            lineHeight: 1,
          }}
        >
          \u00d7
        </button>
      )}
    </div>
  );
}
`;

  const bannerTestCode = `import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Banner } from "./Banner";

describe("Banner", () => {
  it("renders the message", () => {
    render(<Banner message="Hello World" />);
    expect(screen.getByText("Hello World")).toBeDefined();
  });

  it("has role alert", () => {
    render(<Banner message="Alert!" />);
    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("accepts variant prop", () => {
    render(<Banner message="Warning" variant="warning" />);
    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("renders close button when onClose is provided", () => {
    render(<Banner message="Closable" onClose={() => {}} />);
    expect(screen.getByLabelText("Close")).toBeDefined();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<Banner message="Closable" onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not render close button without onClose", () => {
    render(<Banner message="No close" />);
    expect(screen.queryByLabelText("Close")).toBeNull();
  });
});
`;

  writeFileSync(
    resolve(projectRoot, "src/components/Banner.tsx"),
    bannerCode
  );
  writeFileSync(
    resolve(projectRoot, "src/components/Banner.test.tsx"),
    bannerTestCode
  );

  console.log("✅ Mock agent: Added Close button to Banner component");
} else {
  console.log(`⚠️ Mock agent: Unknown prompt "${prompt}". No changes made.`);
}
