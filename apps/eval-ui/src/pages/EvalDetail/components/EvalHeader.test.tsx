import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { EvalHeader } from "./EvalHeader";
import { renderWithRouter } from "../../../test/render";

describe("EvalHeader", () => {
  it("renders the testId and stats correctly", () => {
    renderWithRouter(
      <EvalHeader
        testId="test-banner-app"
        totalRunsCount={50}
        variantsCount={3}
        avgScoreTotal={0.85}
        passCountTotal={42}
      />,
    );

    expect(screen.getByText("test-banner-app")).toBeInTheDocument();
    expect(screen.getByText(/50 Total executions/)).toBeInTheDocument();
    expect(screen.getByText(/3 Variants/)).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument(); // Avg Score
    expect(screen.getByText("84%")).toBeInTheDocument(); // Pass Rate (42/50)
  });

  it("renders the back button with correct link", () => {
    renderWithRouter(
      <EvalHeader
        testId="test"
        totalRunsCount={1}
        variantsCount={1}
        avgScoreTotal={1}
        passCountTotal={1}
      />,
    );

    const backButton = screen.getByRole("link");
    expect(backButton).toHaveAttribute("href", "/");
  });
});
