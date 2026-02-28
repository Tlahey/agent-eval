import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoreRing } from "./ScoreRing";

describe("ScoreRing", () => {
  it("renders the score as a percentage", () => {
    render(<ScoreRing value={0.88} />);
    expect(screen.getByText("88")).toBeInTheDocument();
  });

  it("renders 0% for a zero score", () => {
    render(<ScoreRing value={0} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("renders 100% for a perfect score", () => {
    render(<ScoreRing value={1} />);
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("renders an optional label", () => {
    render(<ScoreRing value={0.75} label="avg" />);
    expect(screen.getByText("avg")).toBeInTheDocument();
    expect(screen.getByText("75")).toBeInTheDocument();
  });

  it("does not render label when not provided", () => {
    render(<ScoreRing value={0.5} />);
    expect(screen.queryByText("avg")).not.toBeInTheDocument();
  });

  it("renders an SVG element", () => {
    const { container } = render(<ScoreRing value={0.5} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("renders two circle elements (background + progress)", () => {
    const { container } = render(<ScoreRing value={0.7} />);
    const circles = container.querySelectorAll("circle");
    expect(circles).toHaveLength(2);
  });

  it("applies custom size to the SVG", () => {
    const { container } = render(<ScoreRing value={0.5} size={100} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "100");
    expect(svg).toHaveAttribute("height", "100");
  });

  it("applies custom className", () => {
    const { container } = render(<ScoreRing value={0.5} className="my-custom-class" />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain("my-custom-class");
  });

  it("uses success color for high scores (≥ 0.8)", () => {
    const { container } = render(<ScoreRing value={0.9} />);
    const progressCircle = container.querySelectorAll("circle")[1];
    expect(progressCircle.getAttribute("stroke")).toBe("var(--color-success)");
  });

  it("uses warning color for medium scores (0.6-0.79)", () => {
    const { container } = render(<ScoreRing value={0.65} />);
    const progressCircle = container.querySelectorAll("circle")[1];
    expect(progressCircle.getAttribute("stroke")).toBe("var(--color-warning)");
  });

  it("uses danger color for low scores (< 0.6)", () => {
    const { container } = render(<ScoreRing value={0.3} />);
    const progressCircle = container.querySelectorAll("circle")[1];
    expect(progressCircle.getAttribute("stroke")).toBe("var(--color-danger)");
  });
});
