/**
 * Types for optimistic network switch state management.
 *
 * The optimistic switch lifecycle:
 *   idle → switching → committed | rolled-back
 *
 *   idle:         No switch in progress.
 *   switching:    UI has already applied the new network (optimistic update);
 *                 waiting for confirmation / timeout.
 *   committed:    Switch was successfully acknowledged; state is final.
 *   rolled-back:  Switch failed or was rejected; previous network was restored.
 */

import type { Network } from "../../src/config";

/** All possible phases of an optimistic network switch. */
export type NetworkSwitchPhase =
  | "idle"
  | "switching"
  | "committed"
  | "rolled-back";

/** Structured reasons a network switch can fail. */
export type NetworkSwitchFailureReason =
  | "user-rejected"    // User dismissed/cancelled the operation
  | "timeout"          // Did not complete within the allowed window
  | "rate-limited"     // Horizon / RPC is rate-limiting; cannot verify
  | "network-error"    // Generic connectivity error
  | "wallet-mismatch"  // Wallet is on a different network
  | "unknown";         // Catch-all for unexpected errors

/** Full state shape for optimistic network switching. */
export interface OptimisticNetworkSwitchState {
  /** Which phase the switch is currently in. */
  phase: NetworkSwitchPhase;

  /**
   * The network the UI was set to *before* the optimistic update.
   * Used to roll back when the switch fails.
   */
  previousNetwork: Network | null;

  /**
   * The network the UI *optimistically* switched to.
   * Null when phase is "idle".
   */
  optimisticNetwork: Network | null;

  /**
   * Human-readable error string surfaced to the user on failure.
   * Null unless phase is "rolled-back".
   */
  switchError: string | null;

  /**
   * Structured failure reason for programmatic handling (e.g. different
   * UI copy per reason). Null unless phase is "rolled-back".
   */
  failureReason: NetworkSwitchFailureReason | null;

  /**
   * Monotonically-increasing counter incremented on every switch attempt.
   * Allows in-flight async operations to detect stale callbacks and bail out.
   */
  switchAttempt: number;
}

/** Actions that mutate the optimistic network switch state. */
export interface OptimisticNetworkSwitchActions {
  /**
   * Start an optimistic switch: immediately apply `newNetwork` to the UI
   * and record the previous network for potential rollback.
   */
  beginOptimisticSwitch: (newNetwork: Network) => void;

  /**
   * Commit the switch as successful.
   * Clears previous-network bookmark and error state.
   */
  commitNetworkSwitch: () => void;

  /**
   * Roll back to the previous network because the switch failed.
   * Stores the error and failure reason for display.
   */
  rollbackNetworkSwitch: (
    reason: NetworkSwitchFailureReason,
    errorMessage: string
  ) => void;

  /** Reset to idle after the user dismisses the error banner. */
  clearNetworkSwitchError: () => void;
}
