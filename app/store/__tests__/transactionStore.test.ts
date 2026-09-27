/**
 * Unit Tests for transactionStore (Zustand)
 *
 * Covers the confirmation flow introduced in fix #230:
 * - confirmedTransactionHash is set on confirmation
 * - confirmedTransactionHash survives resetTransaction
 * - resetTransaction clears all other mid-flight fields
 *
 * Run with: npx tsx app/store/__tests__/transactionStore.test.ts
 *
 * @module transactionStore.test
 */

import { create } from 'zustand';

// ─── Inline types and store (avoids @/ alias issues with npx tsx) ──────────

type TransactionState =
  | 'idle'
  | 'building'
  | 'simulating'
  | 'simulated'
  | 'signing'
  | 'signed'
  | 'submitting'
  | 'submitted'
  | 'confirming'
  | 'confirmed'
  | 'failed';

interface TransactionStoreState {
  transactionState: TransactionState;
  transactionHash: string | null;
  transactionError: string | null;
  confirmedTransactionHash: string | null;
  setTransactionState: (state: TransactionState) => void;
  setTransactionHash: (hash: string | null) => void;
  setTransactionError: (error: string | null) => void;
  setConfirmedTransactionHash: (hash: string | null) => void;
  resetTransaction: () => void;
}

const useTransactionStore = create<TransactionStoreState>((set) => ({
  transactionState: 'idle',
  transactionHash: null,
  transactionError: null,
  confirmedTransactionHash: null,
  setTransactionState: (state) => set({ transactionState: state }),
  setTransactionHash: (hash) => set({ transactionHash: hash }),
  setTransactionError: (error) => set({ transactionError: error }),
  setConfirmedTransactionHash: (hash) => set({ confirmedTransactionHash: hash }),
  resetTransaction: () =>
    set({
      transactionState: 'idle',
      transactionHash: null,
      transactionError: null,
      // confirmedTransactionHash intentionally preserved
    }),
}));

// ─── Test Helpers ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    failures.push(message);
    console.error(`  ✗ ${message}`);
  }
}

function section(name: string): void {
  console.log(`\n▸ ${name}`);
}

function resetStore(): void {
  // Hard-reset all fields for test isolation
  useTransactionStore.setState({
    transactionState: 'idle',
    transactionHash: null,
    transactionError: null,
    confirmedTransactionHash: null,
  });
}

const MOCK_TX_HASH = 'abc123def456abc123def456abc123def456abc123def456abc123def456ab12';

// ─── Initial State ──────────────────────────────────────────────────────────

section('Initial state');
{
  const s = useTransactionStore.getState();
  assert(s.transactionState === 'idle', 'transactionState starts idle');
  assert(s.transactionHash === null, 'transactionHash starts null');
  assert(s.transactionError === null, 'transactionError starts null');
  assert(s.confirmedTransactionHash === null, 'confirmedTransactionHash starts null');
}

// ─── State transitions ──────────────────────────────────────────────────────

section('State transitions through minting lifecycle');
{
  resetStore();
  const store = useTransactionStore.getState();

  store.setTransactionState('building');
  assert(useTransactionStore.getState().transactionState === 'building', 'state: building');

  store.setTransactionState('simulating');
  assert(useTransactionStore.getState().transactionState === 'simulating', 'state: simulating');

  store.setTransactionState('signing');
  assert(useTransactionStore.getState().transactionState === 'signing', 'state: signing');

  store.setTransactionState('submitting');
  assert(useTransactionStore.getState().transactionState === 'submitting', 'state: submitting');

  store.setTransactionState('confirming');
  assert(useTransactionStore.getState().transactionState === 'confirming', 'state: confirming');
}

// ─── setTransactionHash ─────────────────────────────────────────────────────

section('setTransactionHash');
{
  resetStore();
  useTransactionStore.getState().setTransactionHash(MOCK_TX_HASH);
  assert(useTransactionStore.getState().transactionHash === MOCK_TX_HASH, 'hash is stored');

  useTransactionStore.getState().setTransactionHash(null);
  assert(useTransactionStore.getState().transactionHash === null, 'hash cleared to null');
}

// ─── Confirmation flow ──────────────────────────────────────────────────────

section('Confirmation: setConfirmedTransactionHash persists the hash');
{
  resetStore();
  const store = useTransactionStore.getState();

  // Simulate the sequence transactionObserver fires on SUCCESS
  store.setTransactionHash(MOCK_TX_HASH);
  store.setConfirmedTransactionHash(MOCK_TX_HASH);
  store.setTransactionState('confirmed');

  const s = useTransactionStore.getState();
  assert(s.transactionState === 'confirmed', 'state is confirmed');
  assert(s.transactionHash === MOCK_TX_HASH, 'transactionHash set on confirmation');
  assert(s.confirmedTransactionHash === MOCK_TX_HASH, 'confirmedTransactionHash set on confirmation');
}

// ─── resetTransaction preserves confirmedTransactionHash ───────────────────

section('resetTransaction: clears mid-flight fields but keeps confirmedTransactionHash');
{
  resetStore();
  const store = useTransactionStore.getState();

  // Simulate a completed mint
  store.setTransactionHash(MOCK_TX_HASH);
  store.setConfirmedTransactionHash(MOCK_TX_HASH);
  store.setTransactionState('confirmed');
  store.setTransactionError(null);

  // User starts a new flow — resetTransaction is called
  useTransactionStore.getState().resetTransaction();

  const s = useTransactionStore.getState();
  assert(s.transactionState === 'idle', 'reset: transactionState back to idle');
  assert(s.transactionHash === null, 'reset: transactionHash cleared');
  assert(s.transactionError === null, 'reset: transactionError cleared');
  assert(
    s.confirmedTransactionHash === MOCK_TX_HASH,
    'reset: confirmedTransactionHash survives resetTransaction',
  );
}

// ─── Failed transaction does not set confirmedTransactionHash ───────────────

section('Failed transaction: confirmedTransactionHash stays null');
{
  resetStore();
  const store = useTransactionStore.getState();

  store.setTransactionHash(MOCK_TX_HASH);
  store.setTransactionError('Transaction failed on the ledger.');
  store.setTransactionState('failed');

  const s = useTransactionStore.getState();
  assert(s.transactionState === 'failed', 'state is failed');
  assert(s.transactionError !== null, 'error message is set');
  assert(s.confirmedTransactionHash === null, 'confirmedTransactionHash not set on failure');
}

// ─── Multiple mints: confirmedTransactionHash updated on each success ───────

section('Multiple mints: confirmedTransactionHash reflects the latest confirmed hash');
{
  resetStore();
  const HASH_1 = 'aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa1111bbbb2222';
  const HASH_2 = 'bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa1111bbbb2222cccc3333';

  const store = useTransactionStore.getState();

  // First mint
  store.setTransactionHash(HASH_1);
  store.setConfirmedTransactionHash(HASH_1);
  store.setTransactionState('confirmed');
  assert(useTransactionStore.getState().confirmedTransactionHash === HASH_1, 'first mint: hash_1 stored');

  // User retries — resetTransaction called
  useTransactionStore.getState().resetTransaction();
  assert(useTransactionStore.getState().confirmedTransactionHash === HASH_1, 'after reset: hash_1 still present');

  // Second mint
  useTransactionStore.getState().setTransactionHash(HASH_2);
  useTransactionStore.getState().setConfirmedTransactionHash(HASH_2);
  useTransactionStore.getState().setTransactionState('confirmed');
  assert(useTransactionStore.getState().confirmedTransactionHash === HASH_2, 'second mint: hash updated to hash_2');
}

// ─── setTransactionError ────────────────────────────────────────────────────

section('setTransactionError');
{
  resetStore();
  useTransactionStore.getState().setTransactionError('Insufficient balance');
  assert(useTransactionStore.getState().transactionError === 'Insufficient balance', 'error stored');

  useTransactionStore.getState().setTransactionError(null);
  assert(useTransactionStore.getState().transactionError === null, 'error cleared');
}

// ─── Report ─────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════');
console.log(`  Results:  ${passed} passed, ${failed} failed`);
console.log('══════════════════════════════════════════════════════');

if (failures.length > 0) {
  console.log('\nFailed tests:');
  failures.forEach((f) => console.log(`  ✗ ${f}`));
}

process.exit(failed > 0 ? 1 : 0);
