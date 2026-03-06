import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KPICard } from "./KPICard";
import { BarChart3 } from "lucide-react";

describe("KPICard", () => {
  it("renders label and value correctly", () => {
    render(<KPICard icon={<BarChart3 />} label="Total Runs" value="123" accent="primary" />);
    expect(screen.getByText("Total Runs")).toBeInTheDocument();
    expect(screen.getByText("123")).toBeInTheDocument();
  });

  it("renders trend and subtext when provided", () => {
    render(
      <KPICard
        icon={<BarChart3 />}
        label="Average Score"
        value="85%"
        accent="ok"
        trend="+5%"
        sub="Global average"
      />,
    );
    expect(screen.getByText("+5%")).toBeInTheDocument();
    expect(screen.getByText("Global average")).toBeInTheDocument();
  });
});
