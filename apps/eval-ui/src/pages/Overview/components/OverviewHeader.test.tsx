import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OverviewHeader } from "./OverviewHeader";

describe("OverviewHeader", () => {
  it("renders the dashboard title", () => {
    render(<OverviewHeader timeRange="30d" setTimeRange={vi.fn()} />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("shows the active time range label", () => {
    render(<OverviewHeader timeRange="7d" setTimeRange={vi.fn()} />);
    expect(screen.getByText("Last 7 Days")).toBeInTheDocument();
  });

  it("opens time range selector on click", () => {
    render(<OverviewHeader timeRange="30d" setTimeRange={vi.fn()} />);
    const button = screen.getByRole("button", { name: /Last 30 Days/i });
    fireEvent.click(button);
    expect(screen.getByText("All Time")).toBeInTheDocument();
    expect(screen.getByText("Last 24 Hours")).toBeInTheDocument();
  });

  it("calls setTimeRange when a new range is selected", () => {
    const setTimeRange = vi.fn();
    render(<OverviewHeader timeRange="30d" setTimeRange={setTimeRange} />);
    const button = screen.getByRole("button", { name: /Last 30 Days/i });
    fireEvent.click(button);

    const option = screen.getByText("Last 7 Days");
    fireEvent.click(option);

    expect(setTimeRange).toHaveBeenCalledWith("7d");
  });
});
