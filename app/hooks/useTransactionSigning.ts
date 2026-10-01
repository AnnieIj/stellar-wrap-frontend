"use client";

import { useCallback, useRef, useState } from "react";
import {
  signWithProvider,
  type SignRequest,
  type SignResult,
  type WalletProvider,
  type SignFailure,
} from "../services/transactionSigner";

export type SigningStatus = "idle" | "signing" | "signed" | "failed";

export interface UseTransactionSigningResult {
  /** Current phase of the signing state machine. */
  status: SigningStatus;
  /** Provider that is (or last) performing the signature. */
  provider: WalletProvider | null;
  /** Structured failure from the last attempt (null unless `status === 'failed'`). */
  failure: SignFailure | null;
  /** Signed base64 XDR from the last successful attempt. */
  signedXdr: string | null;
  /**
   * Signs a transaction with the given provider. Resolves with the structured
   * `SignResult` (safe to ignore — state is captured in `status`/`failure`),
   * so callers can chain or branch on the outcome.
   */
  sign: (provider: WalletProvider, request: SignRequest) => Promise<SignResult>;
  /** Resets to `idle` and clears any signed/failed result. */
  reset: () => void;
}

/**
 * UI-friendly wrapper around the wallet signer.
 *
 * Owns local state only (no store), so it composes anywhere — a modal, an
 * inline guard on the Network Toggle, a future mint flow — and never switches
 * back to `idle` on failures so the UI can render a persistent error state.
 */
export function useTransactionSigning(): UseTransactionSigningResult {
  const [status, setStatus] = useState<SigningStatus>("idle");
  const [provider, setProvider] = useState<WalletProvider | null>(null);
  const [failure, setFailure] = useState<SignFailure | null>(null);
  const [signedXdr, setSignedXdr] = useState<string | null>(null);
  /** Guards against out-of-order results if the user signs twice quickly. */
  const attemptRef = useRef(0);

  const sign = useCallback(
    async (nextProvider: WalletProvider, request: SignRequest): Promise<SignResult> => {
      const attempt = ++attemptRef.current;
      setProvider(nextProvider);
      setStatus("signing");
      setFailure(null);
      setSignedXdr(null);

      const result = await signWithProvider(nextProvider, request);

      if (attempt !== attemptRef.current) {
        return result;
      }

      if (result.ok) {
        setSignedXdr(result.signedXdr);
        setStatus("signed");
      } else if (result.code === "rejected") {
        // Declining a wallet prompt is a neutral user action, not an app
        // failure. Return to the pre-signing state and do not render an error
        // banner or make callers retry automatically.
        setFailure(null);
        setSignedXdr(null);
        setProvider(null);
        setStatus("idle");
      } else {
        setFailure(result);
        setStatus("failed");
      }
      return result;
    },
    []
  );

  const reset = useCallback(() => {
    attemptRef.current += 1;
    setStatus("idle");
    setProvider(null);
    setFailure(null);
    setSignedXdr(null);
  }, []);

  return { status, provider, failure, signedXdr, sign, reset };
}
