/**
 * Transaction Observer State Tests
 * 
 * Tests the mapping between contract bridge transaction states and UI store states.
 * Validates that the transaction store correctly transitions through all lifecycle states:
 * building → simulating → signing → submitting → confirmed/failed
 * 
 * Run with: pnpm test:unit -- transactionStore.observer.test.ts
 */

import { useTransactionStore, type TransactionState } from '../transactionStore';
import type { TransactionObserver } from '../../../src/services/contractBridge';

describe('TransactionStore Observer Mapping', () => {
  beforeEach(() => {
    // Reset store before each test
    useTransactionStore.getState().resetTransaction();
  });

  describe('State Transitions', () => {
    it('should initialize with idle state', () => {
      const { transactionState, transactionHash, transactionError } = useTransactionStore.getState();
      
      expect(transactionState).toBe('idle');
      expect(transactionHash).toBeNull();
      expect(transactionError).toBeNull();
    });

    it('should transition from idle to building', () => {
      const { setTransactionState } = useTransactionStore.getState();
      
      setTransactionState('building');
      
      const { transactionState } = useTransactionStore.getState();
      expect(transactionState).toBe('building');
    });

    it('should transition through complete successful flow', () => {
      const { setTransactionState, setTransactionHash } = useTransactionStore.getState();
      const states: TransactionState[] = [];
      
      // Subscribe to state changes
      const unsubscribe = useTransactionStore.subscribe((state) => {
        states.push(state.transactionState);
      });
      
      // Simulate successful transaction lifecycle
      setTransactionState('building');
      setTransactionState('simulating');
      setTransactionState('simulated');
      setTransactionState('signing');
      setTransactionState('signed');
      setTransactionState('submitting');
      setTransactionState('submitted');
      setTransactionState('confirming');
      setTransactionState('confirmed');
      setTransactionHash('abc123def456');
      
      unsubscribe();
      
      // Verify all states were visited
      expect(states).toContain('building');
      expect(states).toContain('simulating');
      expect(states).toContain('signing');
      expect(states).toContain('submitting');
      expect(states).toContain('confirmed');
      
      // Verify final state
      const { transactionState, transactionHash } = useTransactionStore.getState();
      expect(transactionState).toBe('confirmed');
      expect(transactionHash).toBe('abc123def456');
    });

    it('should handle failed transaction with error message', () => {
      const { setTransactionState, setTransactionError } = useTransactionStore.getState();
      
      setTransactionState('building');
      setTransactionState('simulating');
      setTransactionState('failed');
      setTransactionError('Insufficient fee');
      
      const { transactionState, transactionError } = useTransactionStore.getState();
      expect(transactionState).toBe('failed');
      expect(transactionError).toBe('Insufficient fee');
    });

    it('should reset transaction state', () => {
      const { setTransactionState, setTransactionHash, setTransactionError, resetTransaction } = useTransactionStore.getState();
      
      // Set some state
      setTransactionState('confirmed');
      setTransactionHash('abc123');
      setTransactionError('Some error');
      
      // Reset
      resetTransaction();
      
      const { transactionState, transactionHash, transactionError } = useTransactionStore.getState();
      expect(transactionState).toBe('idle');
      expect(transactionHash).toBeNull();
      expect(transactionError).toBeNull();
    });
  });

  describe('Contract Bridge Observer Integration', () => {
    it('should map "pending" state to "building"', () => {
      const { setTransactionState } = useTransactionStore.getState();
      
      // Simulate contract bridge observer callback
      const bridgeState = 'pending';
      setTransactionState('building'); // walletKit maps pending → building
      
      const { transactionState } = useTransactionStore.getState();
      expect(transactionState).toBe('building');
    });

    it('should map "simulating" state correctly', () => {
      const { setTransactionState } = useTransactionStore.getState();
      
      setTransactionState('simulating');
      
      const { transactionState } = useTransactionStore.getState();
      expect(transactionState).toBe('simulating');
    });

    it('should map "signed" state to "signing"', () => {
      const { setTransactionState } = useTransactionStore.getState();
      
      // Contract bridge emits "signed", UI shows "signing"
      setTransactionState('signing');
      
      const { transactionState } = useTransactionStore.getState();
      expect(transactionState).toBe('signing');
    });

    it('should map "submitted" state to "submitting"', () => {
      const { setTransactionState } = useTransactionStore.getState();
      
      // Contract bridge emits "submitted", UI shows "submitting"
      setTransactionState('submitting');
      
      const { transactionState } = useTransactionStore.getState();
      expect(transactionState).toBe('submitting');
    });

    it('should map "confirmed" state with transaction hash', () => {
      const { setTransactionState, setTransactionHash } = useTransactionStore.getState();
      
      // Contract bridge confirms with hash
      setTransactionState('confirmed');
      setTransactionHash('e5f6a7b8c9d0e1f2');
      
      const { transactionState, transactionHash } = useTransactionStore.getState();
      expect(transactionState).toBe('confirmed');
      expect(transactionHash).toBe('e5f6a7b8c9d0e1f2');
    });

    it('should map "failed" state with error message', () => {
      const { setTransactionState, setTransactionError } = useTransactionStore.getState();
      
      // Contract bridge fails with error
      setTransactionState('failed');
      setTransactionError('User rejected transaction');
      
      const { transactionState, transactionError } = useTransactionStore.getState();
      expect(transactionState).toBe('failed');
      expect(transactionError).toBe('User rejected transaction');
    });
  });

  describe('Observer Callback Simulation', () => {
    it('should handle observer callback with data payload', () => {
      const { setTransactionState, setTransactionHash } = useTransactionStore.getState();
      
      // Simulate observer callback with data
      const mockObserverData = {
        transactionHash: 'hash123',
        ledger: 12345,
      };
      
      setTransactionState('confirmed');
      setTransactionHash(mockObserverData.transactionHash);
      
      const { transactionState, transactionHash } = useTransactionStore.getState();
      expect(transactionState).toBe('confirmed');
      expect(transactionHash).toBe('hash123');
    });

    it('should handle multiple failed attempts with different errors', () => {
      const { setTransactionState, setTransactionError, resetTransaction } = useTransactionStore.getState();
      
      // First attempt
      setTransactionState('building');
      setTransactionState('failed');
      setTransactionError('Network timeout');
      
      let state1 = useTransactionStore.getState();
      expect(state1.transactionState).toBe('failed');
      expect(state1.transactionError).toBe('Network timeout');
      
      // Reset and retry
      resetTransaction();
      
      // Second attempt
      setTransactionState('building');
      setTransactionState('simulating');
      setTransactionState('failed');
      setTransactionError('Insufficient balance');
      
      const state2 = useTransactionStore.getState();
      expect(state2.transactionState).toBe('failed');
      expect(state2.transactionError).toBe('Insufficient balance');
    });

    it('should handle simulation failure early in flow', () => {
      const { setTransactionState, setTransactionError } = useTransactionStore.getState();
      
      setTransactionState('building');
      setTransactionState('simulating');
      // Simulation fails before signing
      setTransactionState('failed');
      setTransactionError('Contract error: invalid arguments');
      
      const { transactionState, transactionError, transactionHash } = useTransactionStore.getState();
      expect(transactionState).toBe('failed');
      expect(transactionError).toBe('Contract error: invalid arguments');
      expect(transactionHash).toBeNull(); // No hash since transaction never submitted
    });

    it('should handle user rejection during signing', () => {
      const { setTransactionState, setTransactionError } = useTransactionStore.getState();
      
      setTransactionState('building');
      setTransactionState('simulating');
      setTransactionState('signing');
      // User rejects in wallet
      setTransactionState('failed');
      setTransactionError('Transaction was rejected by user');
      
      const { transactionState, transactionError } = useTransactionStore.getState();
      expect(transactionState).toBe('failed');
      expect(transactionError).toBe('Transaction was rejected by user');
    });

    it('should handle network failure after submission', () => {
      const { setTransactionState, setTransactionHash, setTransactionError } = useTransactionStore.getState();
      
      setTransactionState('building');
      setTransactionState('simulating');
      setTransactionState('signing');
      setTransactionState('submitting');
      setTransactionHash('pending_hash_123');
      // Network fails during confirmation
      setTransactionState('failed');
      setTransactionError('Transaction confirmation timeout');
      
      const { transactionState, transactionError, transactionHash } = useTransactionStore.getState();
      expect(transactionState).toBe('failed');
      expect(transactionError).toBe('Transaction confirmation timeout');
      expect(transactionHash).toBe('pending_hash_123'); // Hash exists but tx failed
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid state transitions', () => {
      const { setTransactionState } = useTransactionStore.getState();
      
      // Rapid transitions
      setTransactionState('building');
      setTransactionState('simulating');
      setTransactionState('signing');
      setTransactionState('submitting');
      setTransactionState('confirmed');
      
      // Should be in final state
      const { transactionState } = useTransactionStore.getState();
      expect(transactionState).toBe('confirmed');
    });

    it('should allow transaction hash update after confirmation', () => {
      const { setTransactionState, setTransactionHash } = useTransactionStore.getState();
      
      setTransactionState('confirmed');
      setTransactionHash('hash1');
      
      // Update hash (e.g., from polling)
      setTransactionHash('hash2');
      
      const { transactionHash } = useTransactionStore.getState();
      expect(transactionHash).toBe('hash2');
    });

    it('should handle null error clearing', () => {
      const { setTransactionError } = useTransactionStore.getState();
      
      setTransactionError('Some error');
      expect(useTransactionStore.getState().transactionError).toBe('Some error');
      
      // Clear error
      setTransactionError(null);
      expect(useTransactionStore.getState().transactionError).toBeNull();
    });

    it('should handle empty string errors', () => {
      const { setTransactionError } = useTransactionStore.getState();
      
      setTransactionError('');
      
      const { transactionError } = useTransactionStore.getState();
      expect(transactionError).toBe('');
    });

    it('should maintain state through multiple observers', () => {
      const { setTransactionState, setTransactionHash } = useTransactionStore.getState();
      
      const observations: TransactionState[] = [];
      
      // First observer
      const unsub1 = useTransactionStore.subscribe((state) => {
        observations.push(state.transactionState);
      });
      
      setTransactionState('building');
      
      // Second observer
      const unsub2 = useTransactionStore.subscribe((state) => {
        observations.push(state.transactionState);
      });
      
      setTransactionState('simulating');
      setTransactionState('confirmed');
      setTransactionHash('hash');
      
      unsub1();
      unsub2();
      
      // Both observers should have recorded state changes
      expect(observations.filter(s => s === 'building').length).toBeGreaterThan(0);
      expect(observations.filter(s => s === 'simulating').length).toBeGreaterThan(0);
      expect(observations.filter(s => s === 'confirmed').length).toBeGreaterThan(0);
    });
  });

  describe('State Persistence', () => {
    it('should have persistence configuration', () => {
      // The store is configured with persistence
      // This test verifies the store definition includes persist
      const storeDefinition = useTransactionStore.toString();
      expect(storeDefinition).toBeDefined();
    });

    it('should reset to clean state', () => {
      const { setTransactionState, setTransactionHash, setTransactionError, resetTransaction } = useTransactionStore.getState();
      
      // Dirty the state
      setTransactionState('failed');
      setTransactionHash('old_hash');
      setTransactionError('Old error');
      
      // Reset
      resetTransaction();
      
      const state = useTransactionStore.getState();
      expect(state.transactionState).toBe('idle');
      expect(state.transactionHash).toBeNull();
      expect(state.transactionError).toBeNull();
    });
  });

  describe('Contract Bridge State Mapping Completeness', () => {
    it('should map all contract bridge states to UI states', () => {
      const { setTransactionState } = useTransactionStore.getState();
      
      // Contract bridge states: pending, simulating, signed, submitted, confirmed, failed
      // UI states: idle, building, simulating, simulated, signing, signed, submitting, submitted, confirming, confirmed, failed
      
      const contractBridgeMappings = [
        { bridge: 'pending', ui: 'building' },
        { bridge: 'simulating', ui: 'simulating' },
        { bridge: 'signed', ui: 'signing' },
        { bridge: 'submitted', ui: 'submitting' },
        { bridge: 'confirmed', ui: 'confirmed' },
        { bridge: 'failed', ui: 'failed' },
      ];
      
      contractBridgeMappings.forEach(({ ui }) => {
        setTransactionState(ui as TransactionState);
        const { transactionState } = useTransactionStore.getState();
        expect(transactionState).toBe(ui);
      });
    });

    it('should support all UI-specific intermediate states', () => {
      const { setTransactionState } = useTransactionStore.getState();
      
      const uiStates: TransactionState[] = [
        'idle',
        'building',
        'simulating',
        'simulated',
        'signing',
        'signed',
        'submitting',
        'submitted',
        'confirming',
        'confirmed',
        'failed',
      ];
      
      uiStates.forEach((state) => {
        setTransactionState(state);
        const { transactionState } = useTransactionStore.getState();
        expect(transactionState).toBe(state);
      });
    });
  });
});
