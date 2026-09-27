/**
 * @jest-environment jsdom
 *
 * Tests for useHydrateWallet — re-validates a persisted wallet session on
 * page reload without prompting the user.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { useHydrateWallet } from "@/app/hooks/useHydrateWallet";

const ADDRESS = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

jest.mock("@/app/utils/walletConnect", () => ({
  validateWalletConnection: jest.fn(),
}));

import { validateWalletConnection } from "@/app/utils/walletConnect";
const mockValidate = validateWalletConnection as jest.Mock;

function setConnectedSession(
  address: string = ADDRESS,
  provider: "freighter" | "manual" | "demo" = "freighter",
) {
  const { useWalletStore } = jest.requireActual("@/app/store/walletStore");
  useWalletStore.getState().reset();
  useWalletStore.getState().connect(address, provider, "mainnet");
  return useWalletStore;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useHydrateWallet", () => {
  it("does not validate when there is no persisted connection", async () => {
    const { useWalletStore } = jest.requireActual("@/app/store/walletStore");
    useWalletStore.getState().reset();

    let status: string | undefined;
    renderHook(() => {
      status = useHydrateWallet("mainnet");
    });
    await waitFor(() => expect(status).toBe("idle"));
    expect(mockValidate).not.toHaveBeenCalled();
  });

  it("marks validated and keeps the session live when the wallet checks out", async () => {
    const store = setConnectedSession();
    mockValidate.mockResolvedValue({ ok: true });

    let status: string | undefined;
    renderHook(() => {
      status = useHydrateWallet("mainnet");
    });

    await waitFor(() => expect(mockValidate).toHaveBeenCalledWith("freighter", ADDRESS, "mainnet"));
    await waitFor(() => expect(status).toBe("validated"));
    expect(store.getState().isConnected).toBe(true);
    expect(store.getState().needsReconnect).toBe(false);
  });

  it("skips validation when the session is already flagged needsReconnect", async () => {
    const store = setConnectedSession();
    store.getState().markNeedsReconnect();

    let status: string | undefined;
    renderHook(() => {
      status = useHydrateWallet("mainnet");
    });

    await waitFor(() => expect(status).toBe("idle"));
    expect(mockValidate).not.toHaveBeenCalled();
    expect(store.getState().needsReconnect).toBe(true);
  });

  it("marks reconnect-required when the wallet is no longer available", async () => {
    const store = setConnectedSession();
    mockValidate.mockResolvedValue({ ok: false, reason: "disconnected" });

    let status: string | undefined;
    renderHook(() => {
      status = useHydrateWallet("mainnet");
    });

    await waitFor(() => expect(status).toBe("reconnect-required"));
    expect(store.getState().needsReconnect).toBe(true);
    expect(store.getState().isConnected).toBe(false);
  });
});
