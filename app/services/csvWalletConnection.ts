/**
 * CSV Wallet Connection Service
 * Handles Freighter wallet connection specifically for CSV export functionality
 */

import { connectFreighter, isFreighterInstalled, FreighterNotInstalledError, NetworkMismatchError } from "../utils/walletConnect";
import { Network } from "../../src/config";

export interface ConnectionResult {
  publicKey: string;
  network: Network;
}

export interface ConnectionError {
  type: "not_installed" | "network_mismatch" | "user_rejected" | "timeout" | "unknown";
  message: string;
  installUrl?: string;
  expectedNetwork?: Network;
  actualNetwork?: string;
}

const CONNECTION_TIMEOUT_MS = 30000;

/**
 * Connects to Freighter wallet for CSV export with timeout and error handling
 */
export async function connectForCsvExport(
  expectedNetwork: Network,
  signal?: AbortSignal,
): Promise<ConnectionResult> {
  return new Promise<ConnectionResult>((resolve, reject) => {
    // Setup timeout
    const timeoutId = setTimeout(() => {
      reject({
        type: "timeout",
        message: "Connection timed out. Please try again.",
      });
    }, CONNECTION_TIMEOUT_MS);

    // Handle abort signal
    if (signal) {
      signal.addEventListener("abort", () => {
        clearTimeout(timeoutId);
        reject({
          type: "user_rejected",
          message: "Connection cancelled by user.",
        });
      });
    }

    // Attempt connection
    connectFreighter(expectedNetwork)
      .then((publicKey) => {
        clearTimeout(timeoutId);
        resolve({
          publicKey,
          network: expectedNetwork,
        });
      })
      .catch((error: unknown) => {
        clearTimeout(timeoutId);
        
        if (error instanceof FreighterNotInstalledError) {
          reject({
            type: "not_installed",
            message: error.message,
            installUrl: error.installUrl,
          });
        } else if (error instanceof NetworkMismatchError) {
          reject({
            type: "network_mismatch",
            message: error.message,
            expectedNetwork: error.expected,
            actualNetwork: error.actual,
          });
        } else if (error instanceof Error) {
          const message = error.message.toLowerCase();
          if (message.includes("rejected") || message.includes("declined")) {
            reject({
              type: "user_rejected",
              message: error.message,
            });
          } else {
            reject({
              type: "unknown",
              message: error.message || "Failed to connect to wallet.",
            });
          }
        } else {
          reject({
            type: "unknown",
            message: "Failed to connect to wallet. Please try again.",
          });
        }
      });
  });
}

/**
 * Checks if Freighter is installed without requesting access
 */
export async function checkFreighterAvailability(): Promise<boolean> {
  try {
    return await isFreighterInstalled();
  } catch {
    return false;
  }
}

/**
 * Formats a connection error for display
 */
export function formatConnectionError(error: ConnectionError): string {
  switch (error.type) {
    case "not_installed":
      return error.message;
    case "network_mismatch":
      return error.message;
    case "user_rejected":
      return error.message;
    case "timeout":
      return error.message;
    default:
      return error.message;
  }
}

/**
 * Gets the install URL for Freighter if not installed
 */
export function getFreighterInstallUrl(): string {
  return "https://www.freighter.app/";
}
