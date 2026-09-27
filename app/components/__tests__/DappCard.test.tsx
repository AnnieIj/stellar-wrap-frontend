import { fireEvent, render, screen } from "@testing-library/react";
import { DappCard } from "../DappCard";

describe("DappCard keyboard accessibility", () => {
  it("exposes the card as a focusable interactive element", () => {
    render(<DappCard rank={1} name="Liquidity Pool" interactions={42} />);

    const card = screen.getByRole("button", { name: /liquidity pool/i });

    expect(card).toHaveAttribute("tabindex", "0");
    card.focus();
    expect(card).toHaveFocus();
  });

  it("moves focus to the next card when arrow keyboard navigation is used", () => {
    render(
      <>
        <DappCard rank={1} name="Liquidity Pool" interactions={42} />
        <DappCard rank={2} name="StellarX" interactions={18} />
      </>,
    );

    const firstCard = screen.getByRole("button", { name: /liquidity pool/i });
    const secondCard = screen.getByRole("button", { name: /stellarx/i });

    firstCard.focus();
    fireEvent.keyDown(firstCard, { key: "ArrowRight" });

    expect(document.activeElement).toBe(secondCard);
  });
});
