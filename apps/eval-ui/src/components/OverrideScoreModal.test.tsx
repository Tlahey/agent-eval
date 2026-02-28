import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OverrideScoreModal } from "./OverrideScoreModal";

describe("OverrideScoreModal", () => {
  const defaultProps = {
    currentScore: 0.5,
    onSubmit: vi.fn(),
    onClose: vi.fn(),
  };

  it("renders the modal with score slider and reason textarea", () => {
    render(<OverrideScoreModal {...defaultProps} />);
    expect(screen.getByText("Override Score")).toBeInTheDocument();
    expect(screen.getByRole("slider")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/why are you overriding/i)).toBeInTheDocument();
  });

  it("shows Original and New score labels", () => {
    render(<OverrideScoreModal {...defaultProps} />);
    expect(screen.getByText("Original")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<OverrideScoreModal {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows error when submitting without reason", async () => {
    const user = userEvent.setup();
    render(<OverrideScoreModal {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /save override/i }));
    expect(screen.getByText(/please provide a reason/i)).toBeInTheDocument();
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it("calls onSubmit with score and reason when valid", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<OverrideScoreModal {...defaultProps} onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText(/why are you overriding/i), "Better than expected");
    await user.click(screen.getByRole("button", { name: /save override/i }));
    expect(onSubmit).toHaveBeenCalledWith(0.5, "Better than expected");
  });

  it("clears error when user starts typing", async () => {
    const user = userEvent.setup();
    render(<OverrideScoreModal {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /save override/i }));
    expect(screen.getByText(/please provide a reason/i)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/why are you overriding/i), "x");
    expect(screen.queryByText(/please provide a reason/i)).not.toBeInTheDocument();
  });

  it("calls onClose when backdrop is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<OverrideScoreModal {...defaultProps} onClose={onClose} />);

    // Click the backdrop (first child = backdrop div)
    const backdrop = container.querySelector(".animate-fade-in");
    if (backdrop) await user.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
