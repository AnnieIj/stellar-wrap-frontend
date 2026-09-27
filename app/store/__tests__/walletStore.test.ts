/**
 * @jest-environment jsdom
 *
 * Unit tests for walletStore connection persistence and lifecycle.
 */

import { useWalletStore } from "@/app/store/walletStore";

const WALLET_STORAGE_KEY = "stellar-wrap-wallet";
const ADDRESS = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

describe("walletStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useWalletStore.getState().reset();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("starts unconnected with no provider", () => {
    const state = useWalletStore.getState();
    expect(state.address).toBeNull();
    expect(state.provider).toBeNull();
    expect(state.isConnected).toBe(false);
    expect(state.isConnecting).toBe(false);
    expect(state.needsReconnect).toBe(false);
  });

  it("connect records the address, provider, and network", () => {
    useWalletStore.getState().connect(ADDRESS, "freighter", "mainnet");
    const state = useWalletStore.getState();
    expect(state.address).toBe(ADDRESS);
    expect(state.provider).toBe("freighter");
    expect(state.isConnected).toBe(true);
    expect(state.isConnecting).toBe(false);
    expect(state.networkLabel).toBe("mainnet");
    expect(state.connectedAt).toEqual(expect.any(Number));
    expect(state.needsReconnect).toBe(false);
  });

  it("connect clears any prior error/needsReconnect flags", () => {
    useWalletStore.getState().connect(ADDRESS, "freighter", "mainnet");
    useWalletStore.getState().markNeedsReconnect();
    useWalletStore.getState().setError("something went wrong");

    useWalletStore.getState().connect(ADDRESS, "albedo", "mainnet");
    const state = useWalletStore.getState();
    expect(state.provider).toBe("albedo");
    expect(state.error).toBeNull();
    expect(state.needsReconnect).toBe(false);
  });

  it("disconnect clears all connection state", () => {
    useWalletStore.getState().connect(ADDRESS, "xbull", "mainnet");
    useWalletStore.getState().disconnect();
    const state = useWalletStore.getState();
    expect(state.address).toBeNull();
    expect(state.provider).toBeNull();
    expect(state.isConnected).toBe(false);
    expect(state.needsReconnect).toBe(false);
  });

  it("markNeedsReconnect sets the flag and drops isConnected but keeps address", () => {
    useWalletStore.getState().connect(ADDRESS, "freighter", "mainnet");
    useWalletStore.getState().markNeedsReconnect();
    const state = useWalletStore.getState();
    expect(state.needsReconnect).toBe(true);
    expect(state.isConnected).toBe(false);
    expect(state.address).toBe(ADDRESS);
    expect(state.provider).toBe("freighter");
  });

  it("clearNeedsReconnect clears the flag", () => {
    useWalletStore.getState().connect(ADDRESS, "freighter", "mainnet");
    useWalletStore.getState().markNeedsReconnect();
    useWalletStore.getState().clearNeedsReconnect();
    expect(useWalletStore.getState().needsReconnect).toBe(false);
  });

  it("persists connection fields (not transient error/connecting) via partialize", async () => {
    useWalletStore.getState().connect(ADDRESS, "walletconnect", "testnet");
    useWalletStore.getState().setError("transient error");
    useWalletStore.getState().setConnecting(true);

    // Zustand's persist middleware writes to storage asynchronously.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const raw = window.localStorage.getItem(WALLET_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed.state.address).toBe(ADDRESS);
    expect(parsed.state.provider).toBe("walletconnect");
    expect(parsed.state.isConnected).toBe(true);
    expect(parsed.state.networkLabel).toBe("testnet");
    // transient fields are not persisted
    expect(parsed.state.error).toBeUndefined();
    expect(parsed.state.isConnecting).toBeUndefined();
  });
});
