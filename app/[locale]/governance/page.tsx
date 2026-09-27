"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { useWrapStore } from "@/app/store/wrapStore";
import {
  useGovernanceStore,
  type Proposal,
  type VoteChoice,
} from "@/src/store/governanceStore";
import {
  fetchProposals,
  castVote,
  type GovernanceServiceError,
} from "@/src/services/governanceService";
import { connectFreighter, NetworkMismatchError, FreighterNotInstalledError } from "@/app/utils/walletConnect";
import { FREIGHTER_INSTALL_URL } from "@/app/utils/walletConnect";
import { ProgressIndicator } from "@/app/components/ProgressIndicator";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GOVERNANCE_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_GOVERNANCE_CONTRACT_ADDRESS ?? "";

/** Format a stroop amount to XLM with comma separators, 0 decimal places. */
function stroopsToXlmDisplay(stroops: number): string {
  const xlm = stroops / 10_000_000;
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(xlm);
}

/** Truncate a public key for display: GAAAA…ZZZZ */
function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Calculate vote percentages from tallies. */
function calcPercentages(p: Proposal): {
  forPct: number;
  againstPct: number;
  abstainPct: number;
} {
  const total = p.votesFor + p.votesAgainst + p.votesAbstain;
  if (total === 0) return { forPct: 0, againstPct: 0, abstainPct: 0 };
  return {
    forPct: Math.round((p.votesFor / total) * 100),
    againstPct: Math.round((p.votesAgainst / total) * 100),
    abstainPct: Math.round((p.votesAbstain / total) * 100),
  };
}

/** Days remaining until proposal closes. */
function daysRemaining(endsAt: number): string {
  const ms = endsAt - Date.now();
  if (ms <= 0) return "Closed";
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return `${days} day${days !== 1 ? "s" : ""} left`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Proposal["status"] }) {
  const classes: Record<Proposal["status"], string> = {
    active: "bg-emerald-900/60 text-emerald-300 border-emerald-700/50",
    passed: "bg-blue-900/60 text-blue-300 border-blue-700/50",
    rejected: "bg-red-900/60 text-red-300 border-red-700/50",
    pending: "bg-yellow-900/60 text-yellow-300 border-yellow-700/50",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${classes[status]}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function VoteBar({
  forPct,
  againstPct,
  abstainPct,
}: {
  forPct: number;
  againstPct: number;
  abstainPct: number;
}) {
  return (
    <div className="flex h-2 w-full rounded-full overflow-hidden gap-px">
      <div
        className="bg-emerald-500 transition-all duration-700"
        style={{ width: `${forPct}%` }}
      />
      <div
        className="bg-red-500 transition-all duration-700"
        style={{ width: `${againstPct}%` }}
      />
      <div
        className="bg-slate-500 transition-all duration-700"
        style={{ width: `${abstainPct}%` }}
      />
    </div>
  );
}

interface VoteButtonsProps {
  proposal: Proposal;
  walletAddress: string | null;
  onVote: (proposalId: string, choice: VoteChoice) => void;
  submitting: boolean;
}

function VoteButtons({
  proposal,
  walletAddress,
  onVote,
  submitting,
}: VoteButtonsProps) {
  const disabled = !walletAddress || submitting || proposal.status !== "active";

  const choices: { choice: VoteChoice; label: string; classes: string }[] = [
    {
      choice: "for",
      label: "For",
      classes:
        "bg-emerald-900/40 text-emerald-300 border-emerald-700/60 hover:bg-emerald-800/60 disabled:opacity-40",
    },
    {
      choice: "against",
      label: "Against",
      classes:
        "bg-red-900/40 text-red-300 border-red-700/60 hover:bg-red-800/60 disabled:opacity-40",
    },
    {
      choice: "abstain",
      label: "Abstain",
      classes:
        "bg-slate-800/60 text-slate-300 border-slate-600/60 hover:bg-slate-700/60 disabled:opacity-40",
    },
  ];

  return (
    <div className="flex gap-2 flex-wrap">
      {choices.map(({ choice, label, classes }) => (
        <button
          key={choice}
          onClick={() => onVote(proposal.id, choice)}
          disabled={disabled}
          className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-lg border transition-colors cursor-pointer disabled:cursor-not-allowed ${classes}`}
          aria-label={`Vote ${label} on: ${proposal.title}`}
        >
          {submitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          ) : null}
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GovernancePage() {
  const { address: walletAddress, network } = useWrapStore();
  const {
    proposals,
    votes,
    isLoadingProposals,
    proposalError,
    setProposals,
    setLoadingProposals,
    setProposalError,
    applyOptimisticVote,
    confirmVote,
    rollbackVote,
    rejectVote,
    lastVoteAt,
  } = useGovernanceStore();

  const [walletError, setWalletError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [freighterInstalled, setFreighterInstalled] = useState<boolean | null>(
    null,
  );

  // ── Load proposals on mount ─────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoadingProposals(true);
      setProposalError(null);
      try {
        const data = await fetchProposals(network, GOVERNANCE_CONTRACT_ADDRESS);
        setProposals(data);
      } catch (err) {
        setProposalError(
          err instanceof Error ? err.message : "Failed to load proposals.",
        );
      } finally {
        setLoadingProposals(false);
      }
    }
    void load();
  }, [network, setLoadingProposals, setProposalError, setProposals]);

  // ── Handle wallet connection ────────────────────────────────────────────────
  const handleConnect = useCallback(async () => {
    setWalletError(null);
    setIsConnecting(true);
    try {
      await connectFreighter(network);
      // connectFreighter returns the address but the store is set by the connect page flow;
      // here we just trigger connection so Freighter grants access for signing.
    } catch (err: unknown) {
      if (err instanceof FreighterNotInstalledError) {
        setFreighterInstalled(false);
        setWalletError(
          "Freighter is not installed. Please install it to vote.",
        );
      } else if (err instanceof NetworkMismatchError) {
        setWalletError(
          `Network mismatch: Freighter is on "${err.actual}" but the app is set to "${err.expected}". Switch networks in Freighter.`,
        );
      } else if (err instanceof Error) {
        setWalletError(err.message);
      } else {
        setWalletError("Failed to connect wallet. Please try again.");
      }
    } finally {
      setIsConnecting(false);
    }
  }, [network]);

  // ── Rate-limit guard in UI ──────────────────────────────────────────────────
  const isRateLimited = useMemo(() => {
    if (!lastVoteAt) return false;
    return Date.now() - lastVoteAt < 5_000;
  }, [lastVoteAt]);

  // ── Handle vote submission ─────────────────────────────────────────────────
  const handleVote = useCallback(
    async (proposalId: string, choice: VoteChoice) => {
      if (!walletAddress) {
        setWalletError("Please connect your wallet to vote.");
        return;
      }
      if (isRateLimited) return;

      // 1. Optimistically update the store immediately
      applyOptimisticVote(proposalId, choice);

      // 2. Call the Soroban contract
      try {
        const result = await castVote(
          walletAddress,
          proposalId,
          choice,
          network,
          GOVERNANCE_CONTRACT_ADDRESS,
        );
        confirmVote(proposalId, result.txHash);
      } catch (err: unknown) {
        const govErr = err as GovernanceServiceError;
        if (govErr.code === "REJECTED") {
          rejectVote(proposalId);
        } else {
          rollbackVote(
            proposalId,
            govErr.message ?? "Failed to submit vote. Please try again.",
          );
        }
      }
    },
    [
      walletAddress,
      network,
      isRateLimited,
      applyOptimisticVote,
      confirmVote,
      rollbackVote,
      rejectVote,
    ],
  );

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <main
      className="min-h-screen bg-[var(--background)] text-[var(--foreground)]"
      id="main-content"
    >
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">
            Governance Voting
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xl">
            Cast your vote on active Stellar ecosystem proposals. Votes are
            recorded on-chain via Soroban smart contracts. Your wallet must be
            connected to submit.
          </p>
        </div>

        {/* Progress indicator */}
        <div className="mb-8">
          <ProgressIndicator currentPage="governance" />
        </div>

        {/* Wallet connection section */}
        <section
          className="mb-8 rounded-2xl border border-slate-700/60 bg-slate-900/50 p-5"
          aria-label="Wallet status"
        >
          {walletAddress ? (
            <div className="flex items-center gap-3">
              <CheckCircle
                className="w-5 h-5 text-emerald-400 shrink-0"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-semibold text-emerald-300">
                  Wallet connected
                </p>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {truncateAddress(walletAddress)}
                </p>
              </div>
              <span className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-600/60 uppercase tracking-wider">
                {network}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-slate-300">
                Connect your Freighter wallet to participate in governance
                voting.
              </p>
              {freighterInstalled === false ? (
                <a
                  href={FREIGHTER_INSTALL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-400 hover:text-blue-300 underline underline-offset-2"
                >
                  Install Freighter
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="self-start inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-[var(--color-theme-primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  aria-busy={isConnecting}
                >
                  {isConnecting ? (
                    <>
                      <Loader2
                        className="w-4 h-4 animate-spin"
                        aria-hidden="true"
                      />
                      Connecting…
                    </>
                  ) : (
                    "Connect Freighter"
                  )}
                </button>
              )}
            </div>
          )}

          {/* Wallet error */}
          <AnimatePresence>
            {walletError && (
              <motion.div
                key="wallet-error"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-3 flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-700/50 rounded-xl px-4 py-3"
                role="alert"
              >
                <XCircle
                  className="w-4 h-4 mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <span>{walletError}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Proposal error */}
        <AnimatePresence>
          {proposalError && (
            <motion.div
              key="proposal-error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mb-6 flex items-start gap-2 text-sm text-yellow-300 bg-yellow-950/40 border border-yellow-700/50 rounded-xl px-4 py-3"
              role="alert"
            >
              <AlertCircle
                className="w-4 h-4 mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <span>{proposalError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading proposals */}
        {isLoadingProposals && (
          <div
            className="flex items-center justify-center gap-3 py-16 text-slate-400"
            aria-live="polite"
            aria-label="Loading proposals"
          >
            <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
            <span>Loading proposals…</span>
          </div>
        )}

        {/* Proposals list */}
        {!isLoadingProposals && proposals.length > 0 && (
          <section aria-label="Governance proposals">
            <ul className="flex flex-col gap-6" role="list">
              {proposals.map((proposal) => {
                const { forPct, againstPct, abstainPct } =
                  calcPercentages(proposal);
                const vote = votes[proposal.id];
                const isSubmitting = vote?.status === "submitting";
                const voteError =
                  vote?.status === "error" || vote?.status === "rejected"
                    ? vote.error
                    : null;
                const voteSuccess = vote?.status === "success";

                return (
                  <motion.li
                    key={proposal.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="rounded-2xl border border-slate-700/60 bg-slate-900/50 p-6"
                  >
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <h2 className="text-base font-bold leading-snug">
                        {proposal.title}
                      </h2>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={proposal.status} />
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-slate-400 leading-relaxed mb-4">
                      {proposal.description}
                    </p>

                    {/* Tally */}
                    <div className="mb-3">
                      <VoteBar
                        forPct={forPct}
                        againstPct={againstPct}
                        abstainPct={abstainPct}
                      />
                      <div className="flex justify-between text-xs text-slate-400 mt-1.5">
                        <span>
                          <span className="text-emerald-400 font-semibold">
                            {forPct}% For
                          </span>{" "}
                          · {stroopsToXlmDisplay(proposal.votesFor)} XLM
                        </span>
                        <span>
                          <span className="text-red-400 font-semibold">
                            {againstPct}% Against
                          </span>{" "}
                          · {stroopsToXlmDisplay(proposal.votesAgainst)} XLM
                        </span>
                        <span>
                          <span className="text-slate-300 font-semibold">
                            {abstainPct}% Abstain
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Deadline */}
                    <p className="text-xs text-slate-500 mb-4">
                      {daysRemaining(proposal.endsAt)}
                    </p>

                    {/* Vote buttons */}
                    <VoteButtons
                      proposal={proposal}
                      walletAddress={walletAddress}
                      onVote={handleVote}
                      submitting={isSubmitting}
                    />

                    {/* Vote feedback */}
                    <AnimatePresence>
                      {voteSuccess && (
                        <motion.div
                          key="success"
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="mt-3 flex items-center gap-2 text-sm text-emerald-300 bg-emerald-950/40 border border-emerald-700/50 rounded-xl px-4 py-2.5"
                          role="status"
                        >
                          <CheckCircle
                            className="w-4 h-4 shrink-0"
                            aria-hidden="true"
                          />
                          <span>
                            Vote recorded on-chain!{" "}
                            {vote?.txHash && (
                              <span className="font-mono text-xs opacity-70">
                                {truncateAddress(vote.txHash)}
                              </span>
                            )}
                          </span>
                        </motion.div>
                      )}
                      {voteError && (
                        <motion.div
                          key="error"
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="mt-3 flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-700/50 rounded-xl px-4 py-2.5"
                          role="alert"
                        >
                          <XCircle
                            className="w-4 h-4 mt-0.5 shrink-0"
                            aria-hidden="true"
                          />
                          <span>{voteError}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Empty state */}
        {!isLoadingProposals && proposals.length === 0 && !proposalError && (
          <div className="text-center py-16 text-slate-400">
            <AlertCircle
              className="w-10 h-10 mx-auto mb-3 opacity-50"
              aria-hidden="true"
            />
            <p className="font-semibold">No proposals found</p>
            <p className="text-sm mt-1">
              Check back later for new governance proposals.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
