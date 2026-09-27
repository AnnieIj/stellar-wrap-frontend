/**
 * Unit tests for shareCardUtils pure functions.
 *
 * These functions have no React or browser dependencies so they can be tested
 * directly with Jest without any rendering infrastructure.
 */

import {
  getMintButtonText,
  buildShareText,
  getExplorerUrl,
  type MintTransactionState,
  type MintButtonTextTranslator,
} from "../shareCard/shareCardUtils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a minimal translator that returns the key (and any interpolated
 * `attempt` value) so tests can assert on key names without depending on real
 * translation files.
 */
function makeTranslator(): MintButtonTextTranslator {
  return (key: string, values?: Record<string, unknown>) => {
    if (values && "attempt" in values) {
      return `${key}:${values.attempt}`;
    }
    return key;
  };
}

const baseOpts = {
  confirmingAttempt: null,
  confirmingTimedOut: false,
  isOnline: true,
};

// ---------------------------------------------------------------------------
// getMintButtonText
// ---------------------------------------------------------------------------

describe("getMintButtonText", () => {
  const t = makeTranslator();

  describe("idle / default state", () => {
    it("returns mintWrap when online and state is idle", () => {
      expect(getMintButtonText("idle", t, baseOpts)).toBe("mintWrap");
    });

    it("returns mintUnavailableOffline when offline", () => {
      expect(
        getMintButtonText("idle", t, { ...baseOpts, isOnline: false }),
      ).toBe("mintUnavailableOffline");
    });
  });

  describe("in-progress states", () => {
    const inProgress: MintTransactionState[] = [
      "building",
      "simulating",
      "signing",
    ];

    it.each(inProgress)(
      "returns the matching translation key for '%s'",
      (state) => {
        const keyMap: Record<string, string> = {
          building: "buildingTransaction",
          simulating: "simulatingTransaction",
          signing: "awaitingSignature",
        };
        expect(getMintButtonText(state, t, baseOpts)).toBe(keyMap[state]);
      },
    );
  });

  describe("submitting state", () => {
    it("returns submittingTransaction when confirmingAttempt is null", () => {
      expect(getMintButtonText("submitting", t, baseOpts)).toBe(
        "submittingTransaction",
      );
    });

    it("returns confirmingAttempt key with attempt value when polling", () => {
      expect(
        getMintButtonText("submitting", t, {
          ...baseOpts,
          confirmingAttempt: 5,
        }),
      ).toBe("confirmingAttempt:5");
    });
  });

  describe("confirming state", () => {
    it("returns confirmingTransaction when confirmingAttempt is null", () => {
      expect(getMintButtonText("confirming", t, baseOpts)).toBe(
        "confirmingTransaction",
      );
    });

    it("returns confirmingAttempt key with attempt value when polling", () => {
      expect(
        getMintButtonText("confirming", t, {
          ...baseOpts,
          confirmingAttempt: 42,
        }),
      ).toBe("confirmingAttempt:42");
    });
  });

  describe("terminal states", () => {
    it("returns minted when confirmed", () => {
      expect(getMintButtonText("confirmed", t, baseOpts)).toBe("minted");
    });

    it("returns retryMint when failed (regardless of confirmingTimedOut)", () => {
      expect(getMintButtonText("failed", t, baseOpts)).toBe("retryMint");
      expect(
        getMintButtonText("failed", t, {
          ...baseOpts,
          confirmingTimedOut: true,
        }),
      ).toBe("retryMint");
    });
  });
});

// ---------------------------------------------------------------------------
// buildShareText
// ---------------------------------------------------------------------------

describe("buildShareText", () => {
  it("includes the persona, transaction count, and #StellarWrapped hashtag", () => {
    const text = buildShareText("The DeFi Patron", 142);
    expect(text).toContain("The DeFi Patron");
    expect(text).toContain("142");
    expect(text).toContain("#StellarWrapped");
  });

  it("uses the provided year", () => {
    const text = buildShareText("The Wizard", 0, 2025);
    expect(text).toContain("2025");
  });

  it("defaults to the current year when none is provided", () => {
    const currentYear = new Date().getFullYear();
    const text = buildShareText("The Oracle", 10);
    expect(text).toContain(String(currentYear));
  });

  it("produces a non-empty string for any valid inputs", () => {
    expect(buildShareText("Archetype", 0).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// getExplorerUrl
// ---------------------------------------------------------------------------

describe("getExplorerUrl", () => {
  describe("network mapping", () => {
    it("maps 'mainnet' to 'public' in the URL", () => {
      const url = getExplorerUrl("account", "GABC123", "mainnet");
      expect(url).toContain("/explorer/public/");
    });

    it("maps 'testnet' to 'testnet' in the URL", () => {
      const url = getExplorerUrl("account", "GABC123", "testnet");
      expect(url).toContain("/explorer/testnet/");
    });

    it("maps any unknown network string to 'testnet'", () => {
      const url = getExplorerUrl("account", "GABC123", "staging");
      expect(url).toContain("/explorer/testnet/");
    });
  });

  describe("resource types", () => {
    const hash =
      "a1b2c3d4e5f6071829ab0c1d2e3f4051627384950a1b2c3d4e5f60718293a4b5";

    it("builds an account URL", () => {
      const url = getExplorerUrl("account", "GABC123", "mainnet");
      expect(url).toBe(
        "https://stellar.expert/explorer/public/account/GABC123",
      );
    });

    it("builds a transaction URL", () => {
      const url = getExplorerUrl("tx", hash, "testnet");
      expect(url).toBe(
        `https://stellar.expert/explorer/testnet/tx/${hash}`,
      );
    });
  });

  it("always points to stellar.expert", () => {
    const url = getExplorerUrl("account", "GXYZ", "mainnet");
    expect(url.startsWith("https://stellar.expert/")).toBe(true);
  });
});
