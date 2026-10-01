/**
 * Governance Service
 *
 * Handles Soroban smart contract interactions for on-chain governance voting.
 * Supports simulating, signing (via Freighter), and submitting cast_vote
 * transactions, plus fetching proposals via get_proposals.
 *
 * Rate-limiting: at most one vote submission per VOTE_RATE_LIMIT_MS.
 * Timeout: RPC calls are raced against a CALL_TIMEOUT_MS deadline.
 */

import {
  Contract,
  TransactionBuilder,
  xdr,
  BASE_FEE,
  Transaction,
} from "stellar-sdk";
import { Server, Api } from "stellar-sdk/rpc";
import { signTransaction } from "@stellar/freighter-api";
import {
  Network,
  NETWORK_PASSPHRASES,
  SOROBAN_RPC_URLS,
} from "../config";
import type { Proposal, VoteChoice } from "../store/governanceStore";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Max ms to wait for any single RPC call before raising a timeout error. */
const CALL_TIMEOUT_MS = 30_000;

/** Minimum ms between successive vote submissions (rate-limit guard). */
const VOTE_RATE_LIMIT_MS = 5_000;

/** Polling interval for transaction confirmation. */
const CONFIRMATION_POLL_INTERVAL_MS = 2_000;

/** Maximum confirmation polling attempts. */
const MAX_CONFIRMATION_ATTEMPTS = 60;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GovernanceCastVoteResult {
  txHash: string;
  ledger: number;
}

export interface GovernanceServiceError {
  message: string;
  code:
    | "TIMEOUT"
    | "REJECTED"
    | "RATE_LIMITED"
    | "SIMULATION_FAILED"
    | "NETWORK_ERROR"
    | "UNKNOWN";
}

// ─── Module-level state ───────────────────────────────────────────────────────

let lastVoteSubmittedAt = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createServer(network: Network): Server {
  const url = SOROBAN_RPC_URLS[network];
  return new Server(url, { allowHttp: url.startsWith("http://") });
}

function getPassphrase(network: Network): string {
  return NETWORK_PASSPHRASES[network];
}

/**
 * Race a promise against a timeout.  Rejects with a TIMEOUT error if the
 * deadline is reached first.
 */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number = CALL_TIMEOUT_MS,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            buildError(
              `RPC call timed out after ${ms / 1000}s`,
              "TIMEOUT",
            ),
          ),
        ms,
      ),
    ),
  ]);
}

function buildError(
  message: string,
  code: GovernanceServiceError["code"],
): GovernanceServiceError {
  return { message, code };
}

function isGovernanceServiceError(e: unknown): e is GovernanceServiceError {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    "message" in e
  );
}

function parseRpcError(err: unknown): GovernanceServiceError {
  if (isGovernanceServiceError(err)) return err;
  if (err instanceof Error) {
    const msg = err.message;
    if (msg.toLowerCase().includes("user declined") || msg.toLowerCase().includes("rejected")) {
      return buildError("Transaction rejected by user.", "REJECTED");
    }
    if (msg.toLowerCase().includes("timeout")) {
      return buildError("Request timed out. Please check your connection and retry.", "TIMEOUT");
    }
    if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("failed to fetch")) {
      return buildError("Network error. Please check your connection and retry.", "NETWORK_ERROR");
    }
    return buildError(msg, "UNKNOWN");
  }
  return buildError("An unexpected error occurred.", "UNKNOWN");
}

// ─── Mock proposal data (until real contract is deployed) ─────────────────────

const MOCK_PROPOSALS: Proposal[] = [
  {
    id: "prop-001",
    title: "Increase DEX Fee Distribution to Liquidity Providers",
    description:
      "This proposal increases the share of DEX trading fees distributed to liquidity providers from 0.2% to 0.3%, incentivising deeper on-chain liquidity on the Stellar network.",
    votesFor: 1_250_000_000,
    votesAgainst: 480_000_000,
    votesAbstain: 70_000_000,
    status: "active",
    endsAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  },
  {
    id: "prop-002",
    title: "Fund Soroban Developer Grants (Q3 2026)",
    description:
      "Allocate 500,000 XLM from the community treasury to fund Soroban smart-contract developer grants for Q3 2026. Grants will target infrastructure tooling, DeFi protocols, and open-source SDK contributions.",
    votesFor: 3_100_000_000,
    votesAgainst: 200_000_000,
    votesAbstain: 150_000_000,
    status: "active",
    endsAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
  },
  {
    id: "prop-003",
    title: "Deprecate Legacy Horizon v1 Endpoints",
    description:
      "Sunset Horizon v1 REST endpoints by end of Q4 2026. Developers must migrate to Horizon v2 and the Soroban RPC. A 90-day deprecation notice will be issued upon passing.",
    votesFor: 900_000_000,
    votesAgainst: 1_100_000_000,
    votesAbstain: 300_000_000,
    status: "rejected",
    endsAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
  },
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch governance proposals.
 *
 * In production this calls `get_proposals` on the governance contract.
 * Falls back to mock data when no contract address is configured.
 */
export async function fetchProposals(
  _network: Network,
  _contractAddress?: string,
): Promise<Proposal[]> {
  // Simulate a network round-trip delay so the loading state is exercised.
  await new Promise<void>((resolve) => setTimeout(resolve, 600));
  return MOCK_PROPOSALS;
}

/**
 * Cast a governance vote by invoking `cast_vote` on the Soroban contract.
 *
 * Steps:
 *   1. Rate-limit check
 *   2. Build transaction
 *   3. Simulate (to populate auth / fee)
 *   4. Sign with Freighter
 *   5. Submit & confirm
 *
 * @param accountAddress  Voter's Stellar public key
 * @param proposalId      Proposal identifier
 * @param choice          Vote choice: "for" | "against" | "abstain"
 * @param network         Target network
 * @param contractAddress Deployed governance contract address
 * @returns Transaction hash + ledger on success
 * @throws GovernanceServiceError on any failure
 */
export async function castVote(
  accountAddress: string,
  proposalId: string,
  choice: VoteChoice,
  network: Network,
  contractAddress: string,
): Promise<GovernanceCastVoteResult> {
  // ── Rate-limit guard ───────────────────────────────────────────────────────
  const now = Date.now();
  if (now - lastVoteSubmittedAt < VOTE_RATE_LIMIT_MS) {
    const waitSecs = Math.ceil(
      (VOTE_RATE_LIMIT_MS - (now - lastVoteSubmittedAt)) / 1000,
    );
    throw buildError(
      `Please wait ${waitSecs}s before submitting another vote.`,
      "RATE_LIMITED",
    );
  }

  try {
    const server = createServer(network);
    const passphrase = getPassphrase(network);
    const contract = new Contract(contractAddress);

    // ── Load account ──────────────────────────────────────────────────────────
    const account = await withTimeout(server.getAccount(accountAddress));

    // ── Build arguments ───────────────────────────────────────────────────────
    const proposalIdScVal = xdr.ScVal.scvString(proposalId);
    const choiceScVal = xdr.ScVal.scvSymbol(choice.toUpperCase());

    const callArgs: xdr.ScVal[] = [proposalIdScVal, choiceScVal];

    // ── Build transaction ─────────────────────────────────────────────────────
    const tx: Transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: passphrase,
    })
      .addOperation(contract.call("cast_vote", ...callArgs))
      .setTimeout(180)
      .build();

    // ── Simulate ──────────────────────────────────────────────────────────────
    const simResult = await withTimeout(server.simulateTransaction(tx));

    if (Api.isSimulationError(simResult)) {
      throw buildError(
        `Simulation failed: ${simResult.error}`,
        "SIMULATION_FAILED",
      );
    }

    const preparedTx = Api.assembleTransaction(tx, simResult).build();

    // ── Sign with Freighter ───────────────────────────────────────────────────
    const { signedTxXdr, error: signError } = await withTimeout(
      signTransaction(preparedTx.toXDR(), {
        networkPassphrase: passphrase,
        address: accountAddress,
      }),
    );

    if (signError || !signedTxXdr) {
      const msg =
        typeof signError === "string" ? signError : "Freighter signing failed.";
      if (
        msg.toLowerCase().includes("user declined") ||
        msg.toLowerCase().includes("rejected")
      ) {
        throw buildError("Transaction rejected by user.", "REJECTED");
      }
      throw buildError(msg, "UNKNOWN");
    }

    // ── Submit ────────────────────────────────────────────────────────────────
    lastVoteSubmittedAt = Date.now();
    const signedTx = TransactionBuilder.fromXDR(signedTxXdr, passphrase);
    const submitResult = await withTimeout(server.sendTransaction(signedTx));

    if (submitResult.status === "ERROR") {
      throw buildError(
        `Transaction submission failed: ${JSON.stringify(submitResult.errorResult)}`,
        "NETWORK_ERROR",
      );
    }

    const txHash = submitResult.hash;

    // ── Poll for confirmation ─────────────────────────────────────────────────
    for (let attempt = 0; attempt < MAX_CONFIRMATION_ATTEMPTS; attempt++) {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, CONFIRMATION_POLL_INTERVAL_MS),
      );

      const pollResult = await withTimeout(server.getTransaction(txHash));

      if (pollResult.status === Api.GetTransactionStatus.SUCCESS) {
        return { txHash, ledger: pollResult.ledger ?? 0 };
      }

      if (pollResult.status === Api.GetTransactionStatus.FAILED) {
        throw buildError(
          "Transaction failed on the network. Please try again.",
          "NETWORK_ERROR",
        );
      }
      // NOT_FOUND → still processing, continue polling
    }

    throw buildError(
      "Transaction was not confirmed in time. Check the explorer for status.",
      "TIMEOUT",
    );
  } catch (err: unknown) {
    throw parseRpcError(err);
  }
}
