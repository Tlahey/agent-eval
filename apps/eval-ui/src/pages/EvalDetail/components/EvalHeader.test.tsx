import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithRouter } from "../../../test/render";
import { EvalHeader } from "./EvalHeader";

describe("EvalHeader", () => {
  it("renders the testId and stats correctly", () => {
    renderWithRouter(
      <EvalHeader
        testId="test-banner-app"
        totalRunsCount={50}
        runnersCount={3}
        avgScoreTotal={0.85}
        passCountTotal={42}
      />,
    );

    expect(screen.getByText("test-banner-app")).toBeInTheDocument();
    expect(screen.getByText(/50 Total executions/)).toBeInTheDocument();
    expect(screen.getByText(/3 Runners/)).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument(); // Avg Score
    expect(screen.getByText("84%")).toBeInTheDocument(); // Pass Rate (42/50)
  });

  it("renders the back button with correct link", () => {
    renderWithRouter(
      <EvalHeader
        testId="test"
        totalRunsCount={0}
        runnersCount={0}
        avgScoreTotal={0}
        passCountTotal={0}
      />,
    );

    const backLink = screen.getByRole("link");
    expect(backLink).toHaveAttribute("href", "/");
  });
});
