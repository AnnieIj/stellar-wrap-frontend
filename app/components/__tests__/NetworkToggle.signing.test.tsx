/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NetworkToggle } from "../NetworkToggle";
import { verifyWalletForNetwork } from "../../services/transactionSigner";

jest.mock("../../store/wrapStore", () => {
  const state = {
    network: "mainnet",
    status: "idle",
    currentContractAddress: "CABABABABABABABABABABABABABABABABABABABABABABABABABABABABABA",
    setNetwork: jest.fn(),
  } as {
    network: "mainnet" | "testnet";
    status: string;
    currentContractAddress: string | null;
    setNetwork: jest.Mock;
  };
  const useWrapStore = jest.fn(() => state) as unknown as typeof import("../../store/wrapStore")["useWrapStore"] & {
    getState: () => typeof state;
  };
  useWrapStore.getState = () => state;
  return { useWrapStore };
});

jest.mock("../../services/transactionSigner", () => ({
  verifyWalletForNetwork: jest.fn(),
}));

const mockVerify = verifyWalletForNetwork as jest.Mock;

describe("NetworkToggle signing-phase guard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerify.mockResolvedValue({ ok: true });
  });

  it("blocks the switch and surfaces the wallet error on a network mismatch", async () => {
    mockVerify.mockResolvedValue({
      ok: false,
      code: "network-mismatch",
      message:
        'Freighter is connected to "testnet", but this app is switching to "mainnet". Please switch Freighter to "mainnet" and try again.',
      actual: "testnet",
    });

    const { useWrapStore } = jest.requireMock("../../store/wrapStore") as {
      useWrapStore: { getState: () => { network: string; setNetwork: jest.Mock } };
    };
    const store = useWrapStore.getState();

    render(<NetworkToggle />);
    await userEvent.click(screen.getByRole("button", { name: /Network/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      /Freighter is connected to "testnet"/,
    );
    expect(mockVerify).toHaveBeenCalledWith("testnet", expect.any(Number));
    expect(store.setNetwork).not.toHaveBeenCalled();
  });

  it("clears the pending spinner after a rejected switch", async () => {
    mockVerify.mockResolvedValue({
      ok: false,
      code: "network-mismatch",
      message: "Wallet is on the wrong network.",
      actual: "testnet",
    });

    render(<NetworkToggle />);
    const toggle = screen.getByRole("button", { name: /Network/i });
    await userEvent.click(toggle);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(toggle).toBeEnabled();
    });
  });

  it("proceeds with the switch when the wallet matches the target network", async () => {
    const { useWrapStore } = jest.requireMock("../../store/wrapStore") as {
      useWrapStore: { getState: () => { network: string; setNetwork: jest.Mock } };
    };
    const store = useWrapStore.getState();

    render(<NetworkToggle />);
    await userEvent.click(screen.getByRole("button", { name: /Network/i }));

    await waitFor(() => {
      expect(store.setNetwork).toHaveBeenCalledWith("testnet");
    });
  });

  it("blocks the switch while offline without hanging the spinner", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });

    const { useWrapStore } = jest.requireMock("../../store/wrapStore") as {
      useWrapStore: { getState: () => { network: string; setNetwork: jest.Mock } };
    };
    const store = useWrapStore.getState();

    render(<NetworkToggle />);
    const toggle = screen.getByRole("button", { name: /Network/i });
    await userEvent.click(toggle);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/offline/i);
    });
    expect(mockVerify).not.toHaveBeenCalled();
    expect(store.setNetwork).not.toHaveBeenCalled();
    expect(toggle).toBeEnabled();
  });
});