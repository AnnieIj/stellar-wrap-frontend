/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { PortfolioDiversityCard } from "../PortfolioDiversityCard";

Object.defineProperty(globalThis, "IntersectionObserver", {
  writable: true,
  value: class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  },
});

describe("PortfolioDiversityCard", () => {
  it("exposes the diversity score as an accessible progressbar", () => {
    render(
      <PortfolioDiversityCard
        summary={{
          score: 75,
          label: "Diversified",
          uniqueAssetsCount: 3,
          topAssets: [{ assetCode: "USDC", percentage: 60 }],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "PORTFOLIO DIVERSITY" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemin", "0");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "100");
    expect(screen.getByText("Diversified")).toBeInTheDocument();
    expect(screen.getByText("USDC")).toBeInTheDocument();
  });

  it("does not render when the portfolio has no assets", () => {
    render(
      <PortfolioDiversityCard
        summary={{
          score: 0,
          label: "No diversity",
          uniqueAssetsCount: 0,
          topAssets: [],
        }}
      />,
    );

    expect(screen.queryByRole("heading", { name: "PORTFOLIO DIVERSITY" })).not.toBeInTheDocument();
  });
});