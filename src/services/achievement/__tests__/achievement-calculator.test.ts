/**
 * Unit tests for the Achievement Calculator Service
 * 
 * These tests verify the correctness of volume calculation, asset identification,
 * contract call counting, and timeframe filtering logic.
 * 
 * Note: These tests are written in a TDD approach and will work once
 * the achievement calculator service is implemented (issue #40).
 */

import type { AchievementCalculator } from '../types';
import type { IndexedTransaction } from '../../indexer/types';
import {
  createMockPaymentOperation,
  createMockExtendFootprintOperation,
  createMultiAssetTransactions,
  createContractCallTransactions,
} from '../../__tests__/test-utils';
import {
  EMPTY_TRANSACTIONS,
  SINGLE_TRANSACTION,
  XLM_PAYMENT_TRANSACTIONS,
  ISSUED_ASSET_TRANSACTIONS,
  CONTRACT_CALL_TRANSACTIONS,
  MIXED_TRANSACTIONS,
  ZERO_VOLUME_TRANSACTIONS,
  EQUAL_ASSET_COUNT_TRANSACTIONS,
} from '../../__tests__/fixtures';

// Mock implementation placeholder - will be replaced with actual service
// This allows tests to be written before implementation
let achievementCalculator!: AchievementCalculator;


describe('AchievementCalculator', () => {
  beforeEach(() => {
    // TODO: Initialize actual achievement calculator once implemented
    // achievementCalculator = new AchievementCalculator();
  });

  describe('calculateAchievements', () => {
    it('should calculate achievements for empty transactions', async () => {
      const result = await achievementCalculator.calculateAchievements({
        transactions: EMPTY_TRANSACTIONS,
        timeframe: '1m',
      });

      expect(result).toBeDefined();
      expect(result.totalVolume).toBe(0);
      expect(result.transactionCount).toBe(0);
      expect(result.contractCalls).toBe(0);
      expect(result.uniqueAssets).toEqual([]);
      expect(result.timeframe).toBe('1m');
    });

    it('should calculate achievements for single transaction', async () => {
      const result = await achievementCalculator.calculateAchievements({
        transactions: SINGLE_TRANSACTION,
        timeframe: '1m',
      });

      expect(result).toBeDefined();
      expect(result.transactionCount).toBe(1);
      expect(result.totalVolume).toBeGreaterThanOrEqual(0);
    });

    it('should calculate achievements for multiple transactions', async () => {
      const result = await achievementCalculator.calculateAchievements({
        transactions: XLM_PAYMENT_TRANSACTIONS,
        timeframe: '1m',
      });

      expect(result).toBeDefined();
      expect(result.transactionCount).toBe(XLM_PAYMENT_TRANSACTIONS.length);
      expect(result.totalVolume).toBeGreaterThan(0);
    });

    it('should handle different timeframes', async () => {
      const timeframes: Array<'1w' | '2w' | '1m'> = ['1w', '2w', '1m'];

      for (const timeframe of timeframes) {
        const result = await achievementCalculator.calculateAchievements({
          transactions: XLM_PAYMENT_TRANSACTIONS,
          timeframe,
        });

        expect(result.timeframe).toBe(timeframe);
      }
    });

    it('should include contract calls in results', async () => {
      const result = await achievementCalculator.calculateAchievements({
        transactions: CONTRACT_CALL_TRANSACTIONS,
        timeframe: '1m',
      });

      expect(result.contractCalls).toBeGreaterThan(0);
      expect(result.contractCallsByType.size).toBeGreaterThan(0);
    });

    it('should handle mixed transaction types', async () => {
      const result = await achievementCalculator.calculateAchievements({
        transactions: MIXED_TRANSACTIONS,
        timeframe: '1m',
      });

      expect(result).toBeDefined();
      expect(result.transactionCount).toBe(MIXED_TRANSACTIONS.length);
      expect(result.totalVolume).toBeGreaterThanOrEqual(0);
      expect(result.contractCalls).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateVolume', () => {
    it('should calculate zero volume for empty transactions', () => {
      const result = achievementCalculator.calculateVolume(EMPTY_TRANSACTIONS);

      expect(result.total).toBe(0);
      expect(result.nativeVolume).toBe(0);
      expect(result.byAsset.size).toBe(0);
    });

    it('should calculate volume for single payment', () => {
      const result = achievementCalculator.calculateVolume(SINGLE_TRANSACTION);

      expect(result.total).toBeGreaterThan(0);
      expect(result.byAsset.size).toBeGreaterThan(0);
    });

    it('should calculate volume for multiple XLM payments', () => {
      const result = achievementCalculator.calculateVolume(XLM_PAYMENT_TRANSACTIONS);

      expect(result.total).toBeGreaterThan(0);
      expect(result.nativeVolume).toBeGreaterThan(0);
      expect(result.byAsset.has('XLM')).toBe(true);
    });

    it('should calculate volume for issued assets', () => {
      const result = achievementCalculator.calculateVolume(ISSUED_ASSET_TRANSACTIONS);

      expect(result.total).toBeGreaterThan(0);
      expect(result.byAsset.size).toBeGreaterThan(1);
    });

    it('should handle zero volume transactions', () => {
      const result = achievementCalculator.calculateVolume(ZERO_VOLUME_TRANSACTIONS);

      expect(result.total).toBe(0);
      expect(result.nativeVolume).toBe(0);
    });

    it('should aggregate volume by asset correctly', () => {
      const transactions = createMultiAssetTransactions([
        { code: 'XLM', amount: '100.0', count: 3 },
        { code: 'USDC', issuer: 'GABCDEF123456789', amount: '50.0', count: 2 },
        { code: 'USDT', issuer: 'GZYXWV987654321', amount: '25.0', count: 1 },
      ]);

      const result = achievementCalculator.calculateVolume(transactions);

      expect(result.byAsset.has('XLM')).toBe(true);
      expect(result.byAsset.has('USDC')).toBe(true);
      expect(result.byAsset.has('USDT')).toBe(true);
      
      const xlmVolume = result.byAsset.get('XLM');
      expect(xlmVolume).toBeGreaterThanOrEqual(300.0);
    });

    it('should handle decimal amounts correctly', () => {
      const transactions = createMultiAssetTransactions([
        { code: 'XLM', amount: '100.123456', count: 1 },
        { code: 'XLM', amount: '50.789012', count: 1 },
      ]);

      const result = achievementCalculator.calculateVolume(transactions);

      expect(result.total).toBeCloseTo(150.912468, 6);
    });

    it('should ignore non-payment operations in volume calculation', () => {
      const result = achievementCalculator.calculateVolume(CONTRACT_CALL_TRANSACTIONS);

      // Contract calls should not contribute to volume
      expect(result.total).toBe(0);
    });
  });

  describe('identifyAssets', () => {
    it('should return empty array for empty transactions', () => {
      const assets = achievementCalculator.identifyAssets(EMPTY_TRANSACTIONS);
      expect(assets).toEqual([]);
    });

    it('should identify native XLM', () => {
      const assets = achievementCalculator.identifyAssets(XLM_PAYMENT_TRANSACTIONS);
      
      const xlmAsset = assets.find((a) => a.code === 'XLM' && a.type === 'native');
      expect(xlmAsset).toBeDefined();
    });

    it('should identify issued assets', () => {
      const assets = achievementCalculator.identifyAssets(ISSUED_ASSET_TRANSACTIONS);
      
      expect(assets.length).toBeGreaterThan(1);
      const issuedAssets = assets.filter((a) => a.type !== 'native');
      expect(issuedAssets.length).toBeGreaterThan(0);
    });

    it('should return unique assets only', () => {
      const transactions = createMultiAssetTransactions([
        { code: 'USDC', issuer: 'GABCDEF123456789', amount: '100.0', count: 5 },
      ]);

      const assets = achievementCalculator.identifyAssets(transactions);
      
      const usdcAssets = assets.filter((a) => a.code === 'USDC');
      expect(usdcAssets.length).toBe(1);
    });

    it('should include issuer information for issued assets', () => {
      const assets = achievementCalculator.identifyAssets(ISSUED_ASSET_TRANSACTIONS);
      
      const issuedAssets = assets.filter((a) => a.type !== 'native');
      issuedAssets.forEach((asset) => {
        expect(asset.issuer).toBeDefined();
        expect(asset.issuer).not.toBe('');
      });
    });

    it('should handle multiple assets correctly', () => {
      const transactions = createMultiAssetTransactions([
        { code: 'XLM', amount: '100.0', count: 1 },
        { code: 'USDC', issuer: 'GABCDEF123456789', amount: '50.0', count: 1 },
        { code: 'USDT', issuer: 'GZYXWV987654321', amount: '25.0', count: 1 },
      ]);

      const assets = achievementCalculator.identifyAssets(transactions);
      
      expect(assets.length).toBe(3);
      expect(assets.some((a) => a.code === 'XLM')).toBe(true);
      expect(assets.some((a) => a.code === 'USDC')).toBe(true);
      expect(assets.some((a) => a.code === 'USDT')).toBe(true);
    });

    it('should handle equal asset counts', () => {
      const assets = achievementCalculator.identifyAssets(EQUAL_ASSET_COUNT_TRANSACTIONS);
      
      // Should return both assets even if they have equal counts
      expect(assets.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('countContractCalls', () => {
    it('should return empty map for empty transactions', () => {
      const counts = achievementCalculator.countContractCalls(EMPTY_TRANSACTIONS);
      
      expect(counts.size).toBe(0);
    });

    it('should count invokeHostFunction operations', () => {
      const transactions = createContractCallTransactions([
        { contractId: 'CONTRACT1', functionName: 'transfer', count: 3 },
        { contractId: 'CONTRACT2', functionName: 'approve', count: 2 },
      ]);

      const counts = achievementCalculator.countContractCalls(transactions);
      
      expect(counts.size).toBeGreaterThan(0);
      const invokeCount = counts.get('invokeHostFunction') || 0;
      expect(invokeCount).toBe(5);
    });

    it('should count extendFootprintTtl operations', () => {
      const transactions: IndexedTransaction[] = [];
      for (let i = 0; i < 3; i++) {
        transactions.push({
          transaction: SINGLE_TRANSACTION[0].transaction,
          operations: [createMockExtendFootprintOperation('CONTRACT1')],
        });
      }

      const counts = achievementCalculator.countContractCalls(transactions);
      
      const extendCount = counts.get('extendFootprintTtl') || 0;
      expect(extendCount).toBe(3);
    });

    it('should count mixed contract operations', () => {
      const counts = achievementCalculator.countContractCalls(CONTRACT_CALL_TRANSACTIONS);
      
      expect(counts.size).toBeGreaterThan(0);
      const totalCalls = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
      expect(totalCalls).toBeGreaterThan(0);
    });

    it('should return zero for non-contract transactions', () => {
      const counts = achievementCalculator.countContractCalls(XLM_PAYMENT_TRANSACTIONS);
      
      expect(counts.size).toBe(0);
    });

    it('should group operations by type', () => {
      const transactions = [
        ...createContractCallTransactions([
          { contractId: 'CONTRACT1', functionName: 'transfer', count: 2 },
        ]),
        ...createContractCallTransactions([
          { contractId: 'CONTRACT2', functionName: 'approve', count: 1 },
        ]),
      ];

      const counts = achievementCalculator.countContractCalls(transactions);
      
      // Should have separate counts for different operation types if applicable
      expect(counts.size).toBeGreaterThan(0);
    });

    it('should handle transactions with no contract operations', () => {
      const counts = achievementCalculator.countContractCalls(ZERO_VOLUME_TRANSACTIONS);
      
      // These transactions have no contract calls
      const totalCalls = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
      expect(totalCalls).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle transactions with missing operation data', async () => {
      const transactions: IndexedTransaction[] = [
        {
          transaction: SINGLE_TRANSACTION[0].transaction,
          operations: [],
        },
      ];

      const result = await achievementCalculator.calculateAchievements({
        transactions,
        timeframe: '1m',
      });

      expect(result).toBeDefined();
      expect(result.transactionCount).toBe(1);
    });

    it('should handle very large transaction sets', async () => {
      const largeSet: IndexedTransaction[] = Array.from({ length: 1000 }, () =>
        SINGLE_TRANSACTION[0]
      );

      const result = await achievementCalculator.calculateAchievements({
        transactions: largeSet,
        timeframe: '1m',
      });

      expect(result).toBeDefined();
      expect(result.transactionCount).toBe(1000);
    });

    it('should handle transactions with invalid amounts', () => {
      const transactions: IndexedTransaction[] = [
        {
          transaction: SINGLE_TRANSACTION[0].transaction,
          operations: [
            createMockPaymentOperation('invalid', 'XLM'),
          ],
        },
      ];

      // Should either handle gracefully or throw appropriate error
      expect(() => {
        achievementCalculator.calculateVolume(transactions);
      }).not.toThrow();
    });

    it('should handle transactions with future dates', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const transactions: IndexedTransaction[] = [
        {
          transaction: {
            ...SINGLE_TRANSACTION[0].transaction,
            created_at: futureDate.toISOString(),
          },
          operations: SINGLE_TRANSACTION[0].operations,
        },
      ];

      const result = await achievementCalculator.calculateAchievements({
        transactions,
        timeframe: '1m',
      });

      expect(result).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    it('should calculate complete achievements for realistic scenario', async () => {
      const transactions = MIXED_TRANSACTIONS;

      const result = await achievementCalculator.calculateAchievements({
        transactions,
        timeframe: '1m',
      });

      expect(result).toBeDefined();
      expect(result.transactionCount).toBe(transactions.length);
      expect(result.totalVolume).toBeGreaterThanOrEqual(0);
      expect(result.uniqueAssets.length).toBeGreaterThanOrEqual(0);
      expect(result.contractCalls).toBeGreaterThanOrEqual(0);
      expect(result.volumeByAsset.size).toBeGreaterThanOrEqual(0);
      expect(result.contractCallsByType.size).toBeGreaterThanOrEqual(0);
    });

    it('should maintain consistency between calculateVolume and calculateAchievements', async () => {
      const transactions = XLM_PAYMENT_TRANSACTIONS;

      const volumeResult = achievementCalculator.calculateVolume(transactions);
      const achievementsResult = await achievementCalculator.calculateAchievements({
        transactions,
        timeframe: '1m',
      });

      expect(achievementsResult.totalVolume).toBe(volumeResult.total);
    });
  });
});
