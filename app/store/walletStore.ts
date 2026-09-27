import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * The wallet provider used to establish the current connection, or null when
 * no wallet is connected. "manual" and "demo" represent address-only modes
 * that have no browser-extension backing (and therefore nothing to re-validate
 * on restore).
 */
export type WalletProvider =
  | "freighter"
  | "albedo"
  | "xbull"
  | "walletconnect"
  | "manual"
  | "demo";

export type WalletDisconnectReason =
  | "user"
  | "wallet-unavailable"
  | "network-mismatch";

/**
 * A point-in-time snapshot of connection fields, stored before an optimistic
 * disconnect so that the state can be rolled back if the cleanup fails.
 */
interface ConnectionSnapshot {
  address: string | null;
  provider: WalletProvider | null;
  isConnected: boolean;
  networkLabel: string | null;
  connectedAt: number | null;
  needsReconnect: boolean;
}

interface WalletStoreState {
  /** Connected Stellar public key. */
  address: string | null;
  /** Which wallet provider established the connection. */
  provider: WalletProvider | null;
  isConnected: boolean;
  isConnecting: boolean;
  /**
   * True while an optimistic disconnect is in-flight (cleanup running).
   * The UI should render as-if disconnected while this is true, but should
   * be able to show a subtle "disconnecting…" indicator if needed.
   */
  isDisconnecting: boolean;
  error: string | null;
  /** Human-readable wallet network used at connect time (mainnet/testnet). */
  networkLabel: string | null;
  /** Timestamp (ms) of the last successful connect, for diagnostics. */
  connectedAt: number | null;
  /**
   * Marks the connection as unusable (e.g. the extension was removed or the
   * network changed) without wiping the remembered address. The UI shows the
   * address as a one-tap reconnect instead of a live session.
   */
  needsReconnect: boolean;
  /**
   * Snapshot taken at the start of an optimistic disconnect so the state can
   * be restored if the cleanup throws. Null when no disconnect is in progress.
   */
  _disconnectSnapshot: ConnectionSnapshot | null;

  connect: (address: string, provider: WalletProvider, networkLabel?: string) => void;
  setConnecting: (isConnecting: boolean) => void;
  setError: (error: string | null) => void;
  /**
   * Fully clears the connection (user-initiated, synchronous).
   * Prefer `optimisticDisconnect` for user-facing disconnect actions.
   */
  disconnect: () => void;
  /**
   * Performs an optimistic disconnect:
   * 1. Immediately clears the connection state so the UI updates without
   *    waiting for async wallet cleanup (e.g. WalletConnect session teardown).
   * 2. Runs the optional `cleanup` callback asynchronously.
   * 3. If the cleanup rejects, the original connection state is restored and
   *    `error` is set to the failure message so the UI can inform the user.
   *
   * The `isDisconnecting` flag is true from step 1 until step 2 settles.
   * Returns a promise that resolves to `true` on success, `false` on failure.
   */
  optimisticDisconnect: (cleanup?: () => Promise<void>) => Promise<boolean>;
  /** Flags the session as stale without discarding the remembered address. */
  markNeedsReconnect: (reason: WalletDisconnectReason) => void;
  /** Clears the needs-reconnect flag after a successful re-validation. */
  clearNeedsReconnect: () => void;
  reset: () => void;
}

const initialConnectionState = {
  address: null,
  provider: null,
  isConnected: false,
  isConnecting: false,
  isDisconnecting: false,
  error: null,
  networkLabel: null,
  connectedAt: null,
  needsReconnect: false,
  _disconnectSnapshot: null,
};

export const useWalletStore = create<WalletStoreState>()(
  persist(
    (set, get) => ({
      ...initialConnectionState,

      connect: (address, provider, networkLabel) =>
        set({
          address,
          provider,
          isConnected: true,
          isConnecting: false,
          isDisconnecting: false,
          error: null,
          networkLabel: networkLabel ?? null,
          connectedAt: Date.now(),
          needsReconnect: false,
          _disconnectSnapshot: null,
        }),

      setConnecting: (isConnecting) =>
        set({ isConnecting, error: isConnecting ? null : undefined }),

      setError: (error) => set({ error, isConnecting: false }),

      disconnect: () =>
        set({
          ...initialConnectionState,
        }),

      optimisticDisconnect: async (cleanup) => {
        const state = get();

        // Take a snapshot of the current connection to allow rollback.
        const snapshot: ConnectionSnapshot = {
          address: state.address,
          provider: state.provider,
          isConnected: state.isConnected,
          networkLabel: state.networkLabel,
          connectedAt: state.connectedAt,
          needsReconnect: state.needsReconnect,
        };

        // — Step 1: Optimistically clear the connection state immediately.
        set({
          address: null,
          provider: null,
          isConnected: false,
          isConnecting: false,
          isDisconnecting: true,
          error: null,
          networkLabel: null,
          connectedAt: null,
          needsReconnect: false,
          _disconnectSnapshot: snapshot,
        });

        try {
          // — Step 2: Run async cleanup (e.g. WalletConnect teardown).
          if (cleanup) {
            await cleanup();
          }

          // Cleanup succeeded — finalise the disconnected state.
          set({ isDisconnecting: false, _disconnectSnapshot: null });
          return true;
        } catch (err: unknown) {
          // — Step 3: Cleanup failed — restore the previous connection state.
          const message =
            err instanceof Error
              ? err.message
              : "Wallet disconnect failed. Please try again.";

          set({
            ...snapshot,
            isConnected: snapshot.isConnected,
            isConnecting: false,
            isDisconnecting: false,
            error: message,
            _disconnectSnapshot: null,
          });
          return false;
        }
      },

      markNeedsReconnect: () => set({ isConnected: false, needsReconnect: true }),
      clearNeedsReconnect: () => set({ needsReconnect: false }),
      reset: () => set(initialConnectionState),
    }),
    {
      name: "stellar-wrap-wallet",
      partialize: (state) => ({
        address: state.address,
        provider: state.provider,
        isConnected: state.isConnected,
        networkLabel: state.networkLabel,
        connectedAt: state.connectedAt,
        needsReconnect: state.needsReconnect,
        // isDisconnecting and _disconnectSnapshot are transient — never persisted.
      }),
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? localStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            },
      ),
    },
  ),
);
