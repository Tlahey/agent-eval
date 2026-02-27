import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
