import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RunsHeader } from "./RunsHeader";

describe("RunsHeader", () => {
  it("renders filtered and total counts", () => {
    render(
      <RunsHeader filteredCount={10} totalCount={100} statusFilter="all" updateParams={vi.fn()} />,
    );
    expect(screen.getByText(/10 of 100 Runs filtered/)).toBeInTheDocument();
  });

  it("calls updateParams when status buttons are clicked", () => {
    const updateParams = vi.fn();
    render(
      <RunsHeader
        filteredCount={10}
        totalCount={100}
        statusFilter="all"
        updateParams={updateParams}
      />,
    );

    fireEvent.click(screen.getByText(/Above/i));
    expect(updateParams).toHaveBeenCalledWith({ status: "pass" });

    fireEvent.click(screen.getByText(/Below/i));
    expect(updateParams).toHaveBeenCalledWith({ status: "fail" });

    fireEvent.click(screen.getByText(/All/i));
    expect(updateParams).toHaveBeenCalledWith({ status: "all" });
  });

  it("applies active styles based on statusFilter", () => {
    render(
      <RunsHeader filteredCount={10} totalCount={100} statusFilter="pass" updateParams={vi.fn()} />,
    );

    const passButton = screen.getByText(/Above/i).closest("button");
    expect(passButton).toHaveClass("bg-ok");
  });
});
