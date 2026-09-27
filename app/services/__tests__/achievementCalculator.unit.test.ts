/**
 * Unit tests for the Achievement Calculator
 * 
 * Tests the calculateAchievements function with various scenarios:
 * - Volume calculation
 * - Asset identification
 * - Contract call counting
 * - Edge cases
 */

import { calculateAchievements, assignPersona, generateVibes } from '../achievementCalculator';

const ISO_DATE = '2024-06-15T12:00:00Z';

function makePaymentTx(amount: string, assetCode = 'XLM') {
  return {
    created_at: ISO_DATE,
    operations: [{ type: 'payment', amount, asset_code: assetCode }],
  };
}

function makeDeploymentTx(contractId = 'CDEPLOY123') {
  return {
    id: 'deploy-tx',
    created_at: ISO_DATE,
    operations: [{
      type: 'invoke_host_function',
      contract_id: contractId,
      function: 'HostFunctionTypeCreateContract',
    }],
  };
}

function makeOfferTx(type: 'manage_buy_offer' | 'manage_sell_offer' = 'manage_buy_offer') {
  return {
    created_at: ISO_DATE,
    operations: [{ type, amount: '100', asset_code: 'XLM' }],
  };
}

function makePathPaymentTx() {
  return {
    created_at: ISO_DATE,
    operations: [{
      type: 'path_payment_strict_receive',
      source_amount: '100',
      destination_amount: '200',
    }],
  };
}

function makeTrustlineTx() {
  return {
    created_at: ISO_DATE,
    operations: [{ type: 'change_trust' }],
  };
}

function repeatTx<T>(tx: T, count: number): T[] {
  return Array.from({ length: count }, () => ({ ...tx }));
}

describe('AchievementCalculator - calculateAchievements', () => {
  describe('Volume Calculation', () => {
    it('should calculate zero volume for empty transactions', () => {
      const result = calculateAchievements([]);
      
      expect(result.totalVolume).toBe(0);
      expect(result.totalTransactions).toBe(0);
    });

    it('should calculate volume for single payment transaction', () => {
      const transactions = [
        {
          created_at: new Date().toISOString(),
          operations: [
            { type: 'payment', amount: '100.5', asset_code: 'XLM' }
          ]
        }
      ];

      const result = calculateAchievements(transactions);
      
      expect(result.totalVolume).toBe(100.5);
      expect(result.totalTransactions).toBe(1);
    });

    it('should calculate volume for multiple payment transactions', () => {
      const transactions = [
        {
          created_at: new Date().toISOString(),
          operations: [
            { type: 'payment', amount: '50.0', asset_code: 'XLM' }
          ]
        },
        {
          created_at: new Date().toISOString(),
          operations: [
            { type: 'payment', amount: '100.0', asset_code: 'XLM' }
          ]
        },
        {
          created_at: new Date().toISOString(),
          operations: [
            { type: 'payment', amount: '25.5', asset_code: 'XLM' }
          ]
        }
      ];

      const result = calculateAchievements(transactions);
      
      expect(result.totalVolume).toBe(175.5);
      expect(result.totalTransactions).toBe(3);
    });

    it('should handle different assets in volume calculation', () => {
      const transactions = [
        {
          created_at: new Date().toISOString(),
          operations: [
            { type: 'payment', amount: '100.0', asset_code: 'XLM' }
          ]
        },
        {
          created_at: new Date().toISOString(),
          operations: [
            { type: 'payment', amount: '50.0', asset_code: 'USDC' }
          ]
        }
      ];

      const result = calculateAchievements(transactions);
      
      expect(result.totalVolume).toBe(150.0);
    });

    it('should handle zero volume transactions', () => {
      const transactions = [
        {
          created_at: new Date().toISOString(),
          operations: [
            { type: 'accountMerge' }
          ]
        }
      ];

      const result = calculateAchievements(transactions);
      
      expect(result.totalVolume).toBe(0);
    });

    it('should handle missing amount in payment operations', () => {
      const transactions = [
        {
          created_at: new Date().toISOString(),
          operations: [
            { type: 'payment', asset_code: 'XLM' }
          ]
        }
      ];

      const result = calculateAchievements(transactions);
      
      expect(result.totalVolume).toBe(0);
    });

    it('should handle path payment operations', () => {
      const transactions = [
        {
          created_at: new Date().toISOString(),
          operations: [
            { type: 'path_payment_strict_receive', amount: '200.0', asset_code: 'XLM' }
          ]
        }
      ];

      const result = calculateAchievements(transactions);
      
      expect(result.totalVolume).toBe(200.0);
    });

    it('should handle path payment strict send operations', () => {
      const transactions = [
        {
          created_at: new Date().toISOString(),
          operations: [
            { type: 'path_payment_strict_send', amount: '150.0', asset_code: 'XLM' }
          ]
        }
      ];

      const result = calculateAchievements(transactions);
      
      expect(result.totalVolume).toBe(150.0);
    });

    it('should handle manage offer operations', () => {
      const transactions = [
        {
          created_at: new Date().toISOString(),
          operations: [
            { type: 'manage_buy_offer', amount: '75.0' }
          ]
        }
      ];

      const result = calculateAchievements(transactions);
      
      expect(result.totalVolume).toBe(75.0);
    });
  });

  describe('Asset Identification', () => {
    it('should identify XLM as most active asset by default', () => {
      const transactions = [
        {
          created_at: new Date().toISOString(),
          operations: [
            { type: 'payment', amount: '100.0', asset_code: 'XLM' }
          ]
        }
      ];

      const result = calculateAchievements(transactions);
      
      expect(result.mostActiveAsset).toBe('XLM');
    });

    it('should identify most active asset from multiple assets', () => {
      const transactions = [
        {
          created_at: new Date().toISOString(),
          operations: [
            { type: 'payment', amount: '50.0', asset_code: 'XLM' }
          ]
        },
        {
          created_at: new Date().toISOString(),
          operations: [
            { type: 'payment', amount: '200.0', asset_code: 'USDC' }
          ]
        },
        {
          created_at: new Date().toISOString(),
          operations: [
            { type: 'payment', amount: '100.0', asset_code: 'XLM' }
          ]
        }
      ];

      const result = calculateAchievements(transactions);
      
      expect(result.mostActiveAsset).toBe('USDC');
    });

    it('should handle missing asset_code (defaults to XLM)', () => {
      const transactions = [
        {
          created_at: new Date().toISOString(),
          operations: [
            { type: 'payment', amount: '100.0' }
          ]
        }
      ];

      const result = calculateAchievements(transactions);
      
      expect(result.mostActiveAsset).toBe('XLM');
    });

    it('should handle equal asset counts (first one wins)', () => {
      const transactions = [
        {
          created_at: new Date().toISOString(),
          operations: [
            { type: 'payment', amount: '100.0', asset_code: 'XLM' }
          ]
        },
        {
          created_at: new Date().toISOString(),
          operations: [
            { type: 'payment', amount: '100.0', asset_code: 'USDC' }
          ]
        }
      ];

      const result = calculateAchievements(transactions);
      
      // Should default to XLM when amounts are equal
      expect(result.mostActiveAsset).toBe('XLM');
    });
  });

  describe('Contract Call Counting', () => {
    it('should count zero contract calls for empty transactions', () => {
      const result = calculateAchievements([]);
      
      expect(result.contractCalls).toBe(0);
    });

    it('should count invokeHostFunction operations as contract calls', () => {
      const transactions = [
        {
          created_at: new Date().toISOString(),
          operations: [
            { type: 'invoke_host_function' }
          ]
        }
      ];

      const result = calculateAchievements(transactions);
      
      expect(result.contractCalls).toBe(1);
    });

    it('should count multiple contract calls', () => {
      const transactions = [
        {
          created_at: new Date().toISOString(),
          operations: [
            { type: 'invoke_host_function' }
          ]
        },
        {
          created_at: new Date().toISOString(),
          operations: [
            { type: 'invoke_host_function' }
          ]
        },
        {
          created_at: new Date().toISOString(),
          operations: [
            { type: 'invoke_host_function' }
          ]
        }
      ];

      const result = calculateAchievements(transactions);
      
      expect(result.contractCalls).toBe(3);
    });

    it('should not count non-contract operations as contract calls', () => {
      const transactions = [
        {
          created_at: new Date().toISOString(),
          operations: [
            { type: 'payment', amount: '100.0', asset_code: 'XLM' }
          ]
        }
      ];

      const result = calculateAchievements(transactions);
      
      expect(result.contractCalls).toBe(0);
    });

    it('should not count extendFootprintTtl operations as contract calls', () => {
      const transactions = [
        {
          created_at: new Date().toISOString(),
          operations: [
            { type: 'extendFootprintTtl' }
          ]
        }
      ];

      const result = calculateAchievements(transactions);
      
      // extendFootprintTtl is not counted as a contract call in the current implementation
      expect(result.contractCalls).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle transactions with no operations', () => {
      const transactions = [
        {
          created_at: new Date().toISOString()
        }
      ];

      const result = calculateAchievements(transactions);
      
      expect(result.totalVolume).toBe(0);
      expect(result.totalTransactions).toBe(1);
    });

    it('should handle transactions with missing operations array', () => {
      const transactions = [
        {
          created_at: new Date().toISOString(),
          operations: undefined
        }
      ];

      const result = calculateAchievements(transactions);
      
      expect(result.totalVolume).toBe(0);
      expect(result.totalTransactions).toBe(1);
    });

    it('should handle invalid amount strings (returns NaN)', () => {
      const transactions = [
        {
          created_at: new Date().toISOString(),
          operations: [
            { type: 'payment', amount: 'invalid', asset_code: 'XLM' }
          ]
        }
      ];

      const result = calculateAchievements(transactions);
      
      // parseFloat('invalid') returns NaN, which gets added to totalVolume
      expect(isNaN(result.totalVolume)).toBe(true);
    });

    it('should handle empty operations array', () => {
      const transactions = [
        {
          created_at: new Date().toISOString(),
          operations: []
        }
      ];

      const result = calculateAchievements(transactions);
      
      expect(result.totalVolume).toBe(0);
      expect(result.totalTransactions).toBe(1);
    });

    it('should handle large transaction sets', () => {
      const transactions = Array.from({ length: 1000 }, () => ({
        created_at: new Date().toISOString(),
        operations: [
          { type: 'payment', amount: '1.0', asset_code: 'XLM' }
        ]
      }));

      const result = calculateAchievements(transactions);
      
      expect(result.totalVolume).toBe(1000.0);
      expect(result.totalTransactions).toBe(1000);
    });
  });

  describe('Vibes Calculation', () => {
    it('should assign Whale vibe for high volume', () => {
      const transactions = Array.from({ length: 10 }, () => ({
        created_at: new Date().toISOString(),
        operations: [
          { type: 'payment', amount: '200000.0', asset_code: 'XLM' }
        ]
      }));

      const result = calculateAchievements(transactions);
      
      const whaleVibe = result.vibes.find(v => v.tag === 'Whale');
      expect(whaleVibe).toBeDefined();
    });

    it('should assign High Roller vibe for medium volume', () => {
      const transactions = Array.from({ length: 5 }, () => ({
        created_at: new Date().toISOString(),
        operations: [
          { type: 'payment', amount: '30000.0', asset_code: 'XLM' }
        ]
      }));

      const result = calculateAchievements(transactions);
      
      const highRollerVibe = result.vibes.find(v => v.tag === 'High Roller');
      expect(highRollerVibe).toBeDefined();
    });

    it('should assign Active vibe for many transactions', () => {
      const transactions = Array.from({ length: 150 }, () => ({
        created_at: new Date().toISOString(),
        operations: [
          { type: 'payment', amount: '10.0', asset_code: 'XLM' }
        ]
      }));

      const result = calculateAchievements(transactions);
      
      const activeVibe = result.vibes.find(v => v.tag === 'Active');
      expect(activeVibe).toBeDefined();
    });

    it('should assign Soroban Explorer vibe for many contract calls', () => {
      const transactions = Array.from({ length: 15 }, () => ({
        created_at: new Date().toISOString(),
        operations: [
          { type: 'invoke_host_function' }
        ]
      }));

      const result = calculateAchievements(transactions);
      
      const sorobanVibe = result.vibes.find(v => v.tag === 'Soroban Explorer');
      expect(sorobanVibe).toBeDefined();
    });

    it('should assign Bridge Master vibe for repeated path payments', () => {
      const transactions = repeatTx(makePathPaymentTx(), 6);

      const result = calculateAchievements(transactions);
      
      const bridgeVibe = result.vibes.find(v => v.tag === 'Bridge Master');
      expect(bridgeVibe).toBeDefined();
    });

    it('should assign Selective vibe for few transactions', () => {
      const transactions = Array.from({ length: 10 }, () => ({
        created_at: new Date().toISOString(),
        operations: [
          { type: 'payment', amount: '100.0', asset_code: 'XLM' }
        ]
      }));

      const result = calculateAchievements(transactions);
      
      const selectiveVibe = result.vibes.find(v => v.tag === 'Selective');
      expect(selectiveVibe).toBeDefined();
    });
  });

  describe('Dapp Detection', () => {
    it('should detect dapps from memo fields', () => {
      const transactions = [
        {
          created_at: new Date().toISOString(),
          memo: 'stellar.expert transaction',
          operations: [
            { type: 'payment', amount: '100.0', asset_code: 'XLM' }
          ]
        }
      ];

      const result = calculateAchievements(transactions);
      
      expect(result.dapps.length).toBeGreaterThan(0);
      const stellarExpert = result.dapps.find(d => d.name === 'Stellar Expert');
      expect(stellarExpert).toBeDefined();
    });

    it('should detect dapps from operation memo', () => {
      const transactions = [
        {
          created_at: new Date().toISOString(),
          operations: [
            { type: 'payment', amount: '100.0', asset_code: 'XLM', memo: 'soroban swap' }
          ]
        }
      ];

      const result = calculateAchievements(transactions);
      
      expect(result.dapps.length).toBeGreaterThan(0);
    });

    it('should not detect dapps when memo is missing', () => {
      const transactions = [
        {
          created_at: new Date().toISOString(),
          operations: [
            { type: 'payment', amount: '100.0', asset_code: 'XLM' }
          ]
        }
      ];

      const result = calculateAchievements(transactions);
      
      expect(result.dapps.length).toBe(0);
    });
  });

  describe('Persona Assignment', () => {
    it('should assign The Architect for Soroban contract deployments', () => {
      const result = calculateAchievements([makeDeploymentTx()]);
      expect(result.persona).toBe('The Architect');
    });

    it('should assign The Architect for sustained Soroban contract calls', () => {
      const transactions = repeatTx({
        created_at: ISO_DATE,
        operations: [{ type: 'invoke_host_function', contract_id: 'C123' }],
      }, 5);

      const result = calculateAchievements(transactions);
      expect(result.persona).toBe('The Architect');
    });

    it('should assign The Patron for heavy DeFi offer activity', () => {
      const result = calculateAchievements(repeatTx(makeOfferTx(), 12));
      expect(result.persona).toBe('The Patron');
    });

    it('should assign The Collector for trustline accumulation with minimal trading', () => {
      const transactions = [
        ...repeatTx(makeTrustlineTx(), 4),
        makePaymentTx('10'),
      ];

      const result = calculateAchievements(transactions);
      expect(result.persona).toBe('The Collector');
    });

    it('should assign The Trader for swap-heavy activity', () => {
      const result = calculateAchievements(repeatTx(makePathPaymentTx(), 6));
      expect(result.persona).toBe('The Trader');
    });

    it('should assign The Wizard for high-volume activity', () => {
      const result = calculateAchievements([
        makePaymentTx('60000'),
        makePaymentTx('60000'),
      ]);
      expect(result.persona).toBe('The Wizard');
    });

    it('should assign The Explorer as fallback when no specific pattern matches', () => {
      const result = calculateAchievements([makePaymentTx('100')]);
      expect(result.persona).toBe('The Explorer');
    });

    it('should assign The Explorer for empty transactions', () => {
      const result = calculateAchievements([]);
      expect(result.persona).toBe('The Explorer');
    });
  });

  describe('assignPersona branch coverage', () => {
    it('should evaluate each persona branch directly', () => {
      expect(assignPersona({
        categories: { payments: 0, swaps: 0, contractCalls: 0, offers: 0, trustlines: 0, other: 0 },
        deploymentCount: 1,
        contractCallCount: 0,
        defiTraderCount: 0,
        dexTradeCount: 0,
        totalVolume: 0,
        txCount: 1,
      })).toBe('The Architect');

      expect(assignPersona({
        categories: { payments: 0, swaps: 0, contractCalls: 0, offers: 12, trustlines: 0, other: 0 },
        deploymentCount: 0,
        contractCallCount: 0,
        defiTraderCount: 12,
        dexTradeCount: 12,
        totalVolume: 0,
        txCount: 12,
      })).toBe('The Patron');

      expect(assignPersona({
        categories: { payments: 1, swaps: 0, contractCalls: 0, offers: 0, trustlines: 4, other: 0 },
        deploymentCount: 0,
        contractCallCount: 0,
        defiTraderCount: 0,
        dexTradeCount: 0,
        totalVolume: 10,
        txCount: 5,
      })).toBe('The Collector');

      expect(assignPersona({
        categories: { payments: 1, swaps: 5, contractCalls: 0, offers: 0, trustlines: 0, other: 0 },
        deploymentCount: 0,
        contractCallCount: 0,
        defiTraderCount: 0,
        dexTradeCount: 5,
        totalVolume: 500,
        txCount: 6,
      })).toBe('The Trader');

      expect(assignPersona({
        categories: { payments: 2, swaps: 0, contractCalls: 0, offers: 0, trustlines: 0, other: 0 },
        deploymentCount: 0,
        contractCallCount: 0,
        defiTraderCount: 0,
        dexTradeCount: 0,
        totalVolume: 120_000,
        txCount: 2,
      })).toBe('The Wizard');

      expect(assignPersona({
        categories: { payments: 1, swaps: 0, contractCalls: 0, offers: 0, trustlines: 0, other: 0 },
        deploymentCount: 0,
        contractCallCount: 0,
        defiTraderCount: 0,
        dexTradeCount: 0,
        totalVolume: 100,
        txCount: 1,
      })).toBe('The Explorer');
    });
  });

  describe('generateVibes branch coverage', () => {
    it('should cover volume, frequency, contract, and special vibe branches', () => {
      expect(generateVibes(10, 2_000_000, 0, new Map(), new Map()).some(v => v.tag === 'Whale')).toBe(true);
      expect(generateVibes(10, 150_000, 0, new Map(), new Map()).some(v => v.tag === 'High Roller')).toBe(true);
      expect(generateVibes(10, 15_000, 0, new Map(), new Map()).some(v => v.tag === 'Active Trader')).toBe(true);
      expect(generateVibes(501, 0, 0, new Map(), new Map()).some(v => v.tag === 'Power User')).toBe(true);
      expect(generateVibes(101, 0, 0, new Map(), new Map()).some(v => v.tag === 'Active')).toBe(true);
      expect(generateVibes(11, 0, 0, new Map(), new Map()).some(v => v.tag === 'Regular')).toBe(true);
      expect(generateVibes(1, 0, 0, new Map(), new Map()).some(v => v.tag === 'Selective')).toBe(true);
      expect(generateVibes(1, 0, 51, new Map(), new Map()).some(v => v.tag === 'Soroban Power User')).toBe(true);
      expect(generateVibes(1, 0, 11, new Map(), new Map()).some(v => v.tag === 'Soroban Explorer')).toBe(true);
      expect(generateVibes(1, 0, 1, new Map(), new Map()).some(v => v.tag === 'Contract Curious')).toBe(true);

      const bridgeMap = new Map([['bridge-warrior', 6]]);
      expect(generateVibes(1, 0, 0, bridgeMap, new Map()).some(v => v.tag === 'Bridge Master')).toBe(true);

      const defiMap = new Map([['defi-trader', 11]]);
      expect(generateVibes(1, 0, 0, defiMap, new Map()).some(v => v.tag === 'DeFi Enthusiast')).toBe(true);

      const assetMap = new Map(Array.from({ length: 6 }, (_, i) => [`ASSET${i}`, 1]));
      expect(generateVibes(1, 0, 0, new Map(), assetMap).some(v => v.tag === 'Asset Diversifier')).toBe(true);
    });

    it('should assign Stellar Explorer when no vibe rules match', () => {
      const vibes = generateVibes(0, 0, 0, new Map(), new Map());
      expect(vibes).toEqual([{ tag: 'Stellar Explorer', count: 0 }]);
    });
  });

  describe('Operation branch coverage', () => {
    it('should process additional operation types and skipped transactions', () => {
      const result = calculateAchievements([
        { created_at: ISO_DATE, successful: false, operations: [{ type: 'payment', amount: '999' }] },
        { created_at: ISO_DATE, fee_charged: '100000', operations: [{ type: 'create_account', amount: '10' }] },
        { created_at: ISO_DATE, operations: [{ type: 'extend_footprint_ttl' }] },
        { created_at: ISO_DATE, operations: [{ type: 'restore_footprint' }] },
        { created_at: ISO_DATE, operations: [{ type: 'manage_sell_offer', amount: '25' }] },
        { created_at: ISO_DATE, operations: [{ type: 'create_passive_sell_offer', amount: '25' }] },
        { created_at: ISO_DATE, operations: [{ type: 'allow_trust' }] },
        { created_at: ISO_DATE, operations: [{ type: 'set_trust_line_flags' }] },
        { created_at: ISO_DATE, operations: [{ type: 'account_merge' }] },
        {
          created_at: ISO_DATE,
          operations: [{
            type: 'invoke_host_function',
            contract: 'CCONTRACT789',
            function: 'SomeCreateContractVariant',
          }],
        },
      ]);

      expect(result.totalTransactions).toBe(9);
      expect(result.contractCalls).toBe(3);
      expect(result.gasSpent).toBe(0.01);
      expect(result.sorobanBuilderSummary?.deploymentCount).toBe(1);
      expect(result.dexTradingSummary?.sellCount).toBe(2);
      expect(result.dapps.some(d => d.name === 'CCONTRACT789')).toBe(true);
    });
  });
});
