import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import { ReceiveModal } from "./ReceiveModal";

describe("ReceiveModal Component", () => {
  it("does not render when isOpen is false", () => {
    render(
      <ReceiveModal
        isOpen={false}
        onClose={() => {}}
        address="GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA"
      />
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders address and dialog content when open and connected", () => {
    const address = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";
    render(<ReceiveModal isOpen={true} onClose={() => {}} address={address} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Receive Assets")).toBeInTheDocument();
    expect(screen.getByText(address)).toBeInTheDocument();
  });

  it("renders empty state when no address is present", () => {
    render(<ReceiveModal isOpen={true} onClose={() => {}} address="" />);

    expect(screen.getByText("No Wallet Connected")).toBeInTheDocument();
  });

  it("calls onClose when close button or Escape key is pressed", () => {
    const handleClose = jest.fn();
    render(
      <ReceiveModal
        isOpen={true}
        onClose={handleClose}
        address="GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA"
      />
    );

    const closeBtn = screen.getByLabelText("Close receive modal");
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(2);
  });
});
