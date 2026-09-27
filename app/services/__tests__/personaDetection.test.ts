/**
 * Tests for persona detection in calculateAchievements
 *
 * Covers the two new archetypes added in #86:
 *   - The Yield Farmer: high DEX volume (offers/path payments), multiple LP positions
 *   - The Hodler: low transaction count, low DEX activity
 *
 * Also covers existing personas (The Wizard, The Explorer) to guard against regressions.
 */

import { calculateAchievements, detectPersona } from "../achievementCalculator";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePaymentTx(amount = "100") {
  return {
    created_at: new Date().toISOString(),
    successful: true,
    operations: [{ type: "payment", amount, asset_code: "XLM" }],
  };
}

function makeOfferTx() {
  return {
    created_at: new Date().toISOString(),
    successful: true,
    operations: [{ type: "manage_sell_offer", amount: "500", asset_code: "XLM" }],
  };
}

function makePathPaymentTx() {
  return {
    created_at: new Date().toISOString(),
    successful: true,
    operations: [
      {
        type: "path_payment_strict_receive",
        source_amount: "200",
        destination_amount: "190",
        source_asset_code: "XLM",
        destination_asset_code: "USDC",
      },
    ],
  };
}

function makeChangeTrustTx(assetType: "native" | "credit_alphanum4" = "credit_alphanum4") {
  return {
    created_at: new Date().toISOString(),
    successful: true,
    operations: [{ type: "change_trust", asset_type: assetType }],
  };
}

function makeSorobanTx() {
  return {
    created_at: new Date().toISOString(),
    successful: true,
    operations: [{ type: "invoke_host_function" }],
  };
}

// ─── detectPersona unit tests ─────────────────────────────────────────────────

describe("detectPersona", () => {
  it("returns The Yield Farmer when dexOpCount>=10 and lpTrustlineCount>=2", () => {
    expect(
      detectPersona({ dexOpCount: 10, lpTrustlineCount: 2, totalTransactions: 50, contractCalls: 0 }),
    ).toBe("The Yield Farmer");
  });

  it("requires BOTH dexOpCount and lpTrustlineCount thresholds for Yield Farmer", () => {
    // High DEX ops but no LP trustlines → not Yield Farmer
    expect(
      detectPersona({ dexOpCount: 15, lpTrustlineCount: 1, totalTransactions: 50, contractCalls: 0 }),
    ).not.toBe("The Yield Farmer");

    // Many LP trustlines but low DEX ops → not Yield Farmer
    expect(
      detectPersona({ dexOpCount: 5, lpTrustlineCount: 3, totalTransactions: 50, contractCalls: 0 }),
    ).not.toBe("The Yield Farmer");
  });

  it("returns The Hodler when txCount<=20 and dexOpCount<=3 (and txCount>0)", () => {
    expect(
      detectPersona({ dexOpCount: 1, lpTrustlineCount: 0, totalTransactions: 10, contractCalls: 0 }),
    ).toBe("The Hodler");
  });

  it("does not return The Hodler for a zero-transaction account", () => {
    expect(
      detectPersona({ dexOpCount: 0, lpTrustlineCount: 0, totalTransactions: 0, contractCalls: 0 }),
    ).not.toBe("The Hodler");
  });

  it("does not return The Hodler when dexOpCount exceeds the threshold", () => {
    expect(
      detectPersona({ dexOpCount: 4, lpTrustlineCount: 0, totalTransactions: 15, contractCalls: 0 }),
    ).not.toBe("The Hodler");
  });

  it("returns The Wizard when contractCalls>10 and no Yield Farmer / Hodler criteria are met", () => {
    expect(
      detectPersona({ dexOpCount: 0, lpTrustlineCount: 0, totalTransactions: 100, contractCalls: 11 }),
    ).toBe("The Wizard");
  });

  it("returns The Explorer as the default fallback", () => {
    expect(
      detectPersona({ dexOpCount: 5, lpTrustlineCount: 0, totalTransactions: 50, contractCalls: 0 }),
    ).toBe("The Explorer");
  });

  it("Yield Farmer takes priority over Wizard when both criteria are met", () => {
    expect(
      detectPersona({ dexOpCount: 12, lpTrustlineCount: 3, totalTransactions: 50, contractCalls: 15 }),
    ).toBe("The Yield Farmer");
  });

  it("Yield Farmer takes priority over Hodler when both Hodler and Yield Farmer criteria are met", () => {
    // Edge case: 10 DEX ops, 2 LP trustlines, but txCount=10 (could be Hodler)
    expect(
      detectPersona({ dexOpCount: 10, lpTrustlineCount: 2, totalTransactions: 10, contractCalls: 0 }),
    ).toBe("The Yield Farmer");
  });
});

// ─── calculateAchievements integration tests ──────────────────────────────────

describe("calculateAchievements — persona field", () => {
  it("assigns The Yield Farmer for high DEX activity with LP trustlines", () => {
    const txs = [
      // 10 offer ops
      ...Array.from({ length: 5 }, makeOfferTx),
      ...Array.from({ length: 5 }, makePathPaymentTx),
      // 2 LP trustline changes (non-native)
      makeChangeTrustTx("credit_alphanum4"),
      makeChangeTrustTx("credit_alphanum4"),
      // a few regular payments
      makePaymentTx("100"),
      makePaymentTx("50"),
    ];

    const result = calculateAchievements(txs);
    expect(result.persona).toBe("The Yield Farmer");
  });

  it("assigns The Hodler for low-activity XLM-only account", () => {
    // 5 payments, no DEX activity, no trustlines
    const txs = Array.from({ length: 5 }, () => makePaymentTx("500"));
    const result = calculateAchievements(txs);
    expect(result.persona).toBe("The Hodler");
  });

  it("assigns The Explorer for default empty transactions", () => {
    const result = calculateAchievements([]);
    expect(result.persona).toBe("The Explorer");
  });

  it("assigns The Wizard for Soroban-heavy account without DEX/LP activity", () => {
    // Need >20 transactions so the Hodler path is skipped (Hodler requires txCount<=20)
    const txs = Array.from({ length: 25 }, makeSorobanTx);
    const result = calculateAchievements(txs);
    expect(result.persona).toBe("The Wizard");
  });

  it("does not assign Yield Farmer if LP trustlines are fewer than 2", () => {
    const txs = [
      ...Array.from({ length: 10 }, makeOfferTx),
      makeChangeTrustTx("credit_alphanum4"), // only 1 LP trustline
    ];
    const result = calculateAchievements(txs);
    expect(result.persona).not.toBe("The Yield Farmer");
  });

  it("does not assign Yield Farmer if DEX ops are fewer than 10", () => {
    const txs = [
      ...Array.from({ length: 9 }, makeOfferTx),
      makeChangeTrustTx("credit_alphanum4"),
      makeChangeTrustTx("credit_alphanum4"),
    ];
    const result = calculateAchievements(txs);
    expect(result.persona).not.toBe("The Yield Farmer");
  });

  it("does not assign Hodler when txCount exceeds 20", () => {
    const txs = Array.from({ length: 21 }, () => makePaymentTx("1"));
    const result = calculateAchievements(txs);
    expect(result.persona).not.toBe("The Hodler");
  });

  it("native change_trust does NOT count toward LP trustline total", () => {
    const txs = [
      // Meets DEX threshold
      ...Array.from({ length: 10 }, makeOfferTx),
      // Only native trustlines — should not count
      makeChangeTrustTx("native"),
      makeChangeTrustTx("native"),
    ];
    const result = calculateAchievements(txs);
    expect(result.persona).not.toBe("The Yield Farmer");
  });

  it("always includes a persona field in the result", () => {
    const result = calculateAchievements([makePaymentTx()]);
    expect(result.persona).toBeDefined();
    expect(typeof result.persona).toBe("string");
  });
});
