import { rpc } from "stellar-sdk";
import { useTransactionStore } from "../app/store/transactionStore";

// The RPC URL for Soroban / Stellar network. Hardcoded for testnet based on typical usage, 
// or can be injected.
const RPC_URL = process.env.NEXT_PUBLIC_STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
const server = new rpc.Server(RPC_URL);

/**
 * TransactionObserver tracks a transaction through its lifecycle
 * and updates the global Zustand store automatically.
 */
export class TransactionObserver {
  private pollInterval: NodeJS.Timeout | null = null;
  private timeoutTimer: NodeJS.Timeout | null = null;
  private readonly MAX_POLLING_DURATION = 60000; // 60 seconds
  private readonly POLLING_INTERVAL = 3000; // 3 seconds

  /**
   * Starts tracking a new transaction from the beginning.
   */
  startTransaction() {
    this.resetState();
    this.setState("building");
  }

  /**
   * Transitions state to simulating
   */
  markSimulating() {
    this.setState("simulating");
  }

  /**
   * Transitions state to simulated
   */
  markSimulated() {
    this.setState("simulated");
  }

  /**
   * Transitions state to signing
   */
  markSigning() {
    this.setState("signing");
  }

  /**
   * Transitions state to signed
   */
  markSigned() {
    this.setState("signed");
  }

  /**
   * Transitions state to submitting
   */
  markSubmitting() {
    this.setState("submitting");
  }

  /**
   * Marks as submitted and begins polling for confirmation
   */
  markSubmitted(txHash: string) {
    useTransactionStore.getState().setTransactionHash(txHash);
    this.setState("submitted");
    this.startPolling(txHash);
  }

  /**
   * Fails the transaction with an error message.
   */
  markFailed(error: Error | string) {
    this.clearTimers();
    const errorMessage = error instanceof Error ? error.message : error;
    useTransactionStore.getState().setTransactionError(errorMessage);
    this.setState("failed");
  }

  /**
   * Start polling the network for transaction confirmation.
   */
  private startPolling(txHash: string) {
    this.setState("confirming");
    
    // Clear any existing timers just in case
    this.clearTimers();

    this.pollInterval = setInterval(async () => {
      try {
        await this.checkTransactionStatus(txHash);
      } catch (error) {
        console.error("Error polling transaction status:", error);
      }
    }, this.POLLING_INTERVAL);

    // Set maximum polling duration (60s limit)
    this.timeoutTimer = setTimeout(() => {
      this.clearTimers();
      this.markFailed("Transaction confirmation timed out after 60 seconds.");
    }, this.MAX_POLLING_DURATION);
  }

  /**
   * Check the transaction status using the Stellar Server proxy.
   */
  private async checkTransactionStatus(txHash: string) {
    try {
      // NOTE: For Soroban / RPC nodes, we typically use getTransaction() to see the status.
      // Depending on the exact RPC server version (Soroban RPC vs classic Horizon), 
      // the method might be getTransaction() from horizon or getTransaction() in Soroban RPC.
      // Assuming Horizon Server or standard stellar-sdk Server usage as per the issue description:
      const response = await server.getTransaction(txHash);
      
      // If we got a response and it's successful:
      if (response && response.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        this.clearTimers();
        // Persist the confirmed hash in the stable field so it survives
        // any subsequent resetTransaction() calls.
        useTransactionStore.getState().setConfirmedTransactionHash(txHash);
        this.setState("confirmed");
      } else if (response && response.status === rpc.Api.GetTransactionStatus.FAILED) {
        this.clearTimers();
        this.markFailed("Transaction failed on the ledger.");
      } else if (response && response.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
        // Still pending/confirming. Do nothing, wait for the next poll.
        return;
      }
    } catch (error: unknown) {
      // If it's an unexpected error, log it but continue polling until timeout
      console.warn("Polling warning: ", error);
    }
  }

  /**
   * Resets the entire transaction state
   */
  resetState() {
    this.clearTimers();
    useTransactionStore.getState().resetTransaction();
  }

  /**
   * Resumes polling if there's a stored hash that was left in a pending state
   * Useful when refreshing the page.
   */
  resumeIfPending() {
    const state = useTransactionStore.getState();
    if (
      (state.transactionState === "submitted" || state.transactionState === "confirming") &&
      state.transactionHash
    ) {
      this.startPolling(state.transactionHash);
    }
  }

  private setState(state: ReturnType<typeof useTransactionStore.getState>["transactionState"]) {
    useTransactionStore.getState().setTransactionState(state);
  }

  private clearTimers() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }
}

// Export a singleton instance
export const transactionObserver = new TransactionObserver();
