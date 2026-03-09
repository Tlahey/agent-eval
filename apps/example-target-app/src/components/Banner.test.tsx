import { describe, it, expect, vi } from "vitest";
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
