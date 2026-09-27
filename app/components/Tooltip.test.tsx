import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import { Tooltip } from "./Tooltip";

describe("Tooltip Component", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("renders trigger children correctly", () => {
    render(
      <Tooltip content="Helper text">
        <button>Trigger Button</button>
      </Tooltip>
    );

    expect(screen.getByText("Trigger Button")).toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows tooltip content on mouse enter after delay", () => {
    render(
      <Tooltip content="Helper text" delay={150}>
        <button>Trigger Button</button>
      </Tooltip>
    );

    const trigger = screen.getByText("Trigger Button");
    fireEvent.mouseEnter(trigger);

    // Before delay
    expect(screen.queryByText("Helper text")).not.toBeInTheDocument();

    // Fast forward timer
    act(() => {
      jest.advanceTimersByTime(150);
    });

    expect(screen.getByText("Helper text")).toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    // Mouse leave hides it
    fireEvent.mouseLeave(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("does not show tooltip if disabled", () => {
    render(
      <Tooltip content="Helper text" disabled={true} delay={0}>
        <button>Trigger Button</button>
      </Tooltip>
    );

    const trigger = screen.getByText("Trigger Button");
    fireEvent.mouseEnter(trigger);

    act(() => {
      jest.advanceTimersByTime(10);
    });

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("renders loading variant with spinner indicator", () => {
    render(
      <Tooltip content="Loading data..." variant="loading" delay={0}>
        <button>Trigger Button</button>
      </Tooltip>
    );

    const trigger = screen.getByText("Trigger Button");
    fireEvent.mouseEnter(trigger);

    act(() => {
      jest.advanceTimersByTime(10);
    });

    expect(screen.getByText("Loading data...")).toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });
});
