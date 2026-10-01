/**
 * Governance Store
 *
 * Manages on-chain governance proposals and vote state.
 * Supports optimistic vote submission with rollback on failure.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// ─── Types ────────────────────────────────────────────────────────────────────

export type VoteChoice = "for" | "against" | "abstain";

export type ProposalStatus = "active" | "passed" | "rejected" | "pending";

export interface Proposal {
  id: string;
  title: string;
  description: string;
  /** Vote tallies — in stroops (1 XLM = 10_000_000) */
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  status: ProposalStatus;
  /** Unix timestamp (ms) when voting closes */
  endsAt: number;
}

export type VoteStatus =
  | "idle"
  | "submitting"
  | "success"
  | "error"
  | "rejected";

export interface CastVote {
  proposalId: string;
  choice: VoteChoice;
  status: VoteStatus;
  /** Optimistic: updated before on-chain confirmation */
  optimistic: boolean;
  error: string | null;
  txHash: string | null;
}

interface GovernanceStoreState {
  proposals: Proposal[];
  /** Map of proposalId → CastVote */
  votes: Record<string, CastVote>;
  isLoadingProposals: boolean;
  proposalError: string | null;
  /** Tracks last vote submission time for rate-limiting */
  lastVoteAt: number | null;

  // Actions
  setProposals: (proposals: Proposal[]) => void;
  setLoadingProposals: (loading: boolean) => void;
  setProposalError: (error: string | null) => void;

  /**
   * Optimistically record a vote and update the proposal tally immediately.
   * Marked optimistic=true until confirmed or rolled back.
   */
  applyOptimisticVote: (proposalId: string, choice: VoteChoice) => void;

  /** Confirm an optimistic vote after on-chain success. */
  confirmVote: (proposalId: string, txHash: string) => void;

  /** Roll back an optimistic vote (tally reverted) if the tx fails. */
  rollbackVote: (proposalId: string, error: string) => void;

  /** Mark a vote as rejected by the user (Freighter rejection). */
  rejectVote: (proposalId: string) => void;

  setVoteStatus: (proposalId: string, status: VoteStatus) => void;
  clearVoteError: (proposalId: string) => void;
  reset: () => void;
}

// ─── Vote delta helpers ───────────────────────────────────────────────────────

/** Amount added to a tally for an optimistic vote (1 unit weight = 10_000_000 stroops). */
const OPTIMISTIC_VOTE_WEIGHT = 10_000_000;

function applyVoteDelta(
  proposal: Proposal,
  choice: VoteChoice,
  delta: number,
): Proposal {
  switch (choice) {
    case "for":
      return { ...proposal, votesFor: Math.max(0, proposal.votesFor + delta) };
    case "against":
      return {
        ...proposal,
        votesAgainst: Math.max(0, proposal.votesAgainst + delta),
      };
    case "abstain":
      return {
        ...proposal,
        votesAbstain: Math.max(0, proposal.votesAbstain + delta),
      };
  }
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useGovernanceStore = create<GovernanceStoreState>()(
  persist(
    (set, get) => ({
      proposals: [],
      votes: {},
      isLoadingProposals: false,
      proposalError: null,
      lastVoteAt: null,

      setProposals: (proposals) => set({ proposals }),
      setLoadingProposals: (loading) => set({ isLoadingProposals: loading }),
      setProposalError: (error) => set({ proposalError: error }),

      applyOptimisticVote: (proposalId, choice) => {
        const state = get();
        const proposal = state.proposals.find((p) => p.id === proposalId);
        if (!proposal) return;

        const updatedProposal = applyVoteDelta(
          proposal,
          choice,
          OPTIMISTIC_VOTE_WEIGHT,
        );

        set({
          proposals: state.proposals.map((p) =>
            p.id === proposalId ? updatedProposal : p,
          ),
          votes: {
            ...state.votes,
            [proposalId]: {
              proposalId,
              choice,
              status: "submitting",
              optimistic: true,
              error: null,
              txHash: null,
            },
          },
          lastVoteAt: Date.now(),
        });
      },

      confirmVote: (proposalId, txHash) => {
        const state = get();
        const vote = state.votes[proposalId];
        if (!vote) return;

        set({
          votes: {
            ...state.votes,
            [proposalId]: {
              ...vote,
              status: "success",
              optimistic: false,
              txHash,
              error: null,
            },
          },
        });
      },

      rollbackVote: (proposalId, error) => {
        const state = get();
        const vote = state.votes[proposalId];
        if (!vote) return;

        // Revert the optimistic tally delta
        const proposal = state.proposals.find((p) => p.id === proposalId);
        const updatedProposals = proposal
          ? state.proposals.map((p) =>
              p.id === proposalId
                ? applyVoteDelta(p, vote.choice, -OPTIMISTIC_VOTE_WEIGHT)
                : p,
            )
          : state.proposals;

        set({
          proposals: updatedProposals,
          votes: {
            ...state.votes,
            [proposalId]: {
              ...vote,
              status: "error",
              optimistic: false,
              error,
            },
          },
        });
      },

      rejectVote: (proposalId) => {
        const state = get();
        const vote = state.votes[proposalId];
        if (!vote) return;

        // Revert optimistic tally
        const proposal = state.proposals.find((p) => p.id === proposalId);
        const updatedProposals = proposal
          ? state.proposals.map((p) =>
              p.id === proposalId
                ? applyVoteDelta(p, vote.choice, -OPTIMISTIC_VOTE_WEIGHT)
                : p,
            )
          : state.proposals;

        set({
          proposals: updatedProposals,
          votes: {
            ...state.votes,
            [proposalId]: {
              ...vote,
              status: "rejected",
              optimistic: false,
              error: "Transaction rejected by user.",
            },
          },
        });
      },

      setVoteStatus: (proposalId, status) => {
        const state = get();
        const vote = state.votes[proposalId];
        if (!vote) return;
        set({
          votes: {
            ...state.votes,
            [proposalId]: { ...vote, status },
          },
        });
      },

      clearVoteError: (proposalId) => {
        const state = get();
        const vote = state.votes[proposalId];
        if (!vote) return;
        set({
          votes: {
            ...state.votes,
            [proposalId]: { ...vote, status: "idle", error: null },
          },
        });
      },

      reset: () =>
        set({
          proposals: [],
          votes: {},
          isLoadingProposals: false,
          proposalError: null,
          lastVoteAt: null,
        }),
    }),
    {
      name: "stellar-wrap-governance-storage",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? localStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            },
      ),
      partialize: (state) => ({
        votes: state.votes,
        proposals: state.proposals,
      }),
    },
  ),
);
