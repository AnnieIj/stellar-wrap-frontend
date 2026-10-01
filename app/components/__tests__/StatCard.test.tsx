/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { StatCard } from "../StatCard";

describe("StatCard", () => {
  it("renders a named group with the supplied value and description", () => {
    render(<StatCard label="Total Volume" value="42.5K XLM" description="Seven-day average" />);

    const card = screen.getByRole("group", { name: "Total Volume" });
    expect(card.id).toMatch(/^stat-card-total-volume-/);
    expect(card).toHaveAccessibleDescription("Seven-day average");
    expect(card).toHaveTextContent("42.5K XLM");
    expect(card).toHaveAttribute("aria-busy", "false");
  });

  it("accepts zero as a numeric value and uses a custom id", () => {
    render(<StatCard id="pending-count" label="Pending" value={0} />);

    const card = screen.getByRole("group", { name: "Pending" });
    expect(card).toHaveAttribute("id", "pending-count");
    expect(card).toHaveTextContent("0");
    expect(card).not.toHaveAttribute("aria-describedby");
  });

  it("keeps label and description references unique when labels repeat", () => {
    render(
      <>
        <StatCard label="Balance" value="10 XLM" description="Current" />
        <StatCard label="Balance" value="20 XLM" description="Previous" />
      </>
    );

    const cards = screen.getAllByRole("group", { name: "Balance" });
    expect(cards[0].id).not.toBe(cards[1].id);
    expect(cards[0]).toHaveAccessibleDescription("Current");
    expect(cards[1]).toHaveAccessibleDescription("Previous");
  });

  it("treats an icon as decorative and preserves caller classes", () => {
    render(
      <StatCard
        label="Top Asset"
        value="XLM"
        icon={
          <svg data-testid="asset-icon">
            <title>Decorative star</title>
          </svg>
        }
        className="custom-card"
        variant="secondary"
      />
    );

    const card = screen.getByRole("group", { name: "Top Asset" });
    expect(card).toHaveClass("custom-card", "bg-foreground/[0.02]");
    expect(screen.getByTestId("asset-icon").parentElement).toHaveAttribute("aria-hidden", "true");
  });

  it("announces loading without exposing hidden description or stale value", () => {
    const { rerender } = render(
      <StatCard label="Transactions" value="1,284" description="All time" loading />
    );

    const card = screen.getByRole("group", { name: "Transactions" });
    expect(card).toHaveAttribute("aria-busy", "true");
    expect(card).toHaveAttribute("aria-disabled", "true");
    expect(card).not.toHaveAttribute("aria-describedby");
    expect(card).not.toHaveAccessibleDescription("All time");
    expect(card).toHaveTextContent("—");
    expect(card).not.toHaveTextContent("1,284");
    expect(screen.getByText("All time")).toHaveClass("invisible");
    expect(screen.getByText("—").parentElement).toHaveAttribute("aria-live", "polite");
    expect(card.querySelector(".animate-spin")).toHaveClass("motion-reduce:animate-none");

    rerender(<StatCard label="Transactions" value="1,284" description="All time" />);
    expect(card).toHaveAttribute("aria-busy", "false");
    expect(card).toHaveAccessibleDescription("All time");
    expect(card).toHaveTextContent("1,284");
    expect(screen.getByText("All time")).not.toHaveClass("invisible");
  });

  it("removes disabled cards from keyboard navigation and focuses enabled cards", () => {
    const { rerender } = render(<StatCard label="Balance" value="0 XLM" disabled />);
    const card = screen.getByRole("group", { name: "Balance" });

    expect(card).toHaveAttribute("aria-disabled", "true");
    expect(card).toHaveAttribute("tabindex", "-1");
    expect(card).toHaveClass("opacity-50", "cursor-not-allowed");
    rerender(<StatCard label="Balance" value="0 XLM" />);
    expect(card).toHaveAttribute("tabindex", "0");
    expect(card).toHaveClass("focus-visible:ring-2");
    card.focus();
    expect(card).toHaveFocus();
  });

  it("uses fluid sizing and theme tokens for both card variants", () => {
    const { rerender } = render(<StatCard label="Balance" value="12345678901234567890" />);
    const card = screen.getByRole("group", { name: "Balance" });

    expect(card).toHaveClass("w-full", "min-w-0", "bg-foreground/5");
    expect(screen.getByText("12345678901234567890").parentElement).toHaveClass("break-words");
    rerender(<StatCard label="Balance" value="12345678901234567890" variant="secondary" />);
    expect(card).toHaveClass("bg-foreground/[0.02]");
    expect(card).not.toHaveClass("bg-foreground/5");
  });
});
