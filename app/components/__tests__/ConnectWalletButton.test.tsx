/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { ConnectWalletButton } from "../ConnectWalletButton";

describe("ConnectWalletButton", () => {
  it("renders the wallet name and icon", () => {
    render(
      <ConnectWalletButton
        walletName="Freighter"
        icon={<span data-testid="wallet-icon" />}
        onConnect={jest.fn()}
      />,
    );

    expect(screen.getByText("Connect with Freighter")).toBeInTheDocument();
    expect(screen.getByTestId("wallet-icon")).toBeInTheDocument();
  });

  it("exposes an accessible name via aria-label", () => {
    render(
      <ConnectWalletButton
        walletName="Albedo"
        icon={<span />}
        onConnect={jest.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Connect with Albedo wallet" }),
    ).toBeInTheDocument();
  });

  it("calls onConnect when clicked", () => {
    const onConnect = jest.fn();
    render(
      <ConnectWalletButton
        walletName="xBull"
        icon={<span />}
        onConnect={onConnect}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /connect with xbull/i }));
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it("is enabled and not aria-disabled by default", () => {
    render(
      <ConnectWalletButton
        walletName="Freighter"
        icon={<span />}
        onConnect={jest.fn()}
      />,
    );

    const button = screen.getByRole("button");
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-disabled", "false");
  });

  it("disables the button and blocks clicks when disabled is true", () => {
    const onConnect = jest.fn();
    render(
      <ConnectWalletButton
        walletName="Freighter"
        icon={<span />}
        onConnect={onConnect}
        disabled
      />,
    );

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(button);
    expect(onConnect).not.toHaveBeenCalled();
  });

  it("shows the connecting state, disables the button, and blocks clicks while connecting", () => {
    const onConnect = jest.fn();
    render(
      <ConnectWalletButton
        walletName="Freighter"
        icon={<span data-testid="wallet-icon" />}
        onConnect={onConnect}
        isConnecting
      />,
    );

    const button = screen.getByRole("button", {
      name: "Connecting to Freighter",
    });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Connecting...")).toBeInTheDocument();
    // The wallet icon is swapped out for a spinner while connecting.
    expect(screen.queryByTestId("wallet-icon")).not.toBeInTheDocument();
    expect(screen.queryByText("Connect with Freighter")).not.toBeInTheDocument();

    fireEvent.click(button);
    expect(onConnect).not.toHaveBeenCalled();
  });

  it("supports a custom connecting label", () => {
    render(
      <ConnectWalletButton
        walletName="Freighter"
        icon={<span />}
        onConnect={jest.fn()}
        isConnecting
        connectingLabel="Opening Freighter..."
      />,
    );

    expect(screen.getByText("Opening Freighter...")).toBeInTheDocument();
  });

  it("is disabled when both disabled and isConnecting are true", () => {
    render(
      <ConnectWalletButton
        walletName="Freighter"
        icon={<span />}
        onConnect={jest.fn()}
        disabled
        isConnecting
      />,
    );

    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("is a native button element reachable via Tab (no explicit tabIndex required)", () => {
    render(
      <ConnectWalletButton
        walletName="Freighter"
        icon={<span />}
        onConnect={jest.fn()}
      />,
    );

    const button = screen.getByRole("button");
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
  });
});
