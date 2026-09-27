/**
 * @jest-environment jsdom
 *
 * Tests for useStellarAddressValidation hook
 *
 * Covers the three acceptance criteria for manual address entry:
 *   1. Empty input → idle state (would trigger "required error" in the page)
 *   2. Invalid checksum → invalid-format state (blocks navigation)
 *   3. Valid address → valid state after debounce (routes to loading)
 *
 * Run with: npm test -- --testPathPattern=useStellarAddressValidation
 */

import { renderHook, act } from "@testing-library/react";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const VALID_ADDRESS = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
const VALID_ADDRESS_2 = "GAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN70";

const ALL_VALID = [VALID_ADDRESS, VALID_ADDRESS_2];

const mockLoadAccount = jest.fn();

jest.mock("stellar-sdk", () => ({
  StrKey: {
    isValidEd25519PublicKey: jest.fn((addr: string) => {
      return ALL_VALID.includes(addr);
    }),
    isValidMed25519PublicKey: jest.fn(() => false),
  },
  Horizon: {
    Server: jest.fn().mockImplementation(() => ({
      loadAccount: mockLoadAccount,
    })),
  },
}));

jest.mock("../../config", () => ({
  RPC_ENDPOINTS: {
    mainnet: "https://horizon.stellar.org",
    testnet: "https://horizon-testnet.stellar.org",
  },
}));

// Import after mocks are set up
import { useStellarAddressValidation } from "../useStellarAddressValidation";
import { StrKey } from "stellar-sdk";

// ─── Helpers ────────────────────────────────────────────────────────────────

function renderHookWithDefaults(overrides = {}) {
  return renderHook(() =>
    useStellarAddressValidation({ network: "mainnet", debounceMs: 50, ...overrides })
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("useStellarAddressValidation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("empty input → idle state (acceptance: empty submit shows required error)", () => {
    it("starts in idle state with empty address", () => {
      const { result } = renderHookWithDefaults();

      expect(result.current.address).toBe("");
      expect(result.current.validationState).toBe("idle");
      expect(result.current.isValid).toBe(false);
      expect(result.current.errorMessage).toBeNull();
    });

    it("returns to idle when address is cleared", () => {
      const { result } = renderHookWithDefaults();

      act(() => {
        result.current.handleAddressChange(VALID_ADDRESS);
      });

      act(() => {
        jest.advanceTimersByTime(50);
      });

      act(() => {
        result.current.handleAddressChange("");
      });

      expect(result.current.address).toBe("");
      expect(result.current.validationState).toBe("idle");
      expect(result.current.isValid).toBe(false);
    });

    it("returns to idle when only whitespace is entered", () => {
      const { result } = renderHookWithDefaults();

      act(() => {
        result.current.handleAddressChange("   ");
      });

      expect(result.current.validationState).toBe("idle");
      expect(result.current.isValid).toBe(false);
    });
  });

  describe("invalid checksum → invalid-format state (acceptance: blocks navigation)", () => {
    it("rejects address with wrong checksum (56 chars, G prefix)", () => {
      const { result } = renderHookWithDefaults();

      const badChecksum = "G" + "A".repeat(55);

      act(() => {
        result.current.handleAddressChange(badChecksum);
      });

      act(() => {
        jest.advanceTimersByTime(50);
      });

      expect(result.current.isValid).toBe(false);
      expect(result.current.validationState).toBe("invalid-format");
      expect(StrKey.isValidEd25519PublicKey).toHaveBeenCalledWith(badChecksum);
    });

    it("rejects address with wrong length", () => {
      const { result } = renderHookWithDefaults();

      act(() => {
        result.current.handleAddressChange("GABC");
      });

      act(() => {
        jest.advanceTimersByTime(50);
      });

      expect(result.current.isValid).toBe(false);
      expect(result.current.validationState).toBe("invalid-format");
    });

    it("rejects address with wrong prefix (S = secret key)", () => {
      const { result } = renderHookWithDefaults();

      act(() => {
        result.current.handleAddressChange("SBCXOGZJR2O4XQ2D6K5D4Z5J3RFLBZ2N6K5D4Z5");
      });

      act(() => {
        jest.advanceTimersByTime(50);
      });

      expect(result.current.isValid).toBe(false);
      expect(result.current.validationState).toBe("invalid-format");
    });

    it("does not call Horizon loadAccount for invalid format", () => {
      const { result } = renderHookWithDefaults();

      act(() => {
        result.current.handleAddressChange("GABC");
      });

      act(() => {
        jest.advanceTimersByTime(50);
      });

      expect(mockLoadAccount).not.toHaveBeenCalled();
    });
  });

  describe("valid address → valid state (acceptance: stores trimmed value and routes to loading)", () => {
    it("transitions to valid after format + network check pass", async () => {
      mockLoadAccount.mockResolvedValueOnce({ account_id: VALID_ADDRESS });

      const { result } = renderHookWithDefaults();

      act(() => {
        result.current.handleAddressChange(VALID_ADDRESS);
      });

      act(() => {
        jest.advanceTimersByTime(50);
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.isValid).toBe(true);
      expect(result.current.validationState).toBe("valid");
      expect(result.current.errorMessage).toBeNull();
    });

    it("stores trimmed address (removes whitespace)", async () => {
      mockLoadAccount.mockResolvedValueOnce({ account_id: VALID_ADDRESS });

      const { result } = renderHookWithDefaults();

      act(() => {
        result.current.handleAddressChange(`  ${VALID_ADDRESS}  `);
      });

      act(() => {
        jest.advanceTimersByTime(50);
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.address).toBe(VALID_ADDRESS);
      expect(result.current.isValid).toBe(true);
    });

    it("calls Horizon loadAccount for valid format", async () => {
      mockLoadAccount.mockResolvedValueOnce({ account_id: VALID_ADDRESS_2 });

      const { result } = renderHookWithDefaults();

      act(() => {
        result.current.handleAddressChange(VALID_ADDRESS_2);
      });

      act(() => {
        jest.advanceTimersByTime(50);
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockLoadAccount).toHaveBeenCalledWith(VALID_ADDRESS_2);
      expect(result.current.isValid).toBe(true);
    });
  });

  describe("address formatting", () => {
    it("auto-removes whitespace", () => {
      const { result } = renderHookWithDefaults();

      act(() => {
        result.current.handleAddressChange(" G A A Z I ");
      });

      expect(result.current.address).toBe("GAAZI");
    });

    it("auto-uppercases", () => {
      const { result } = renderHookWithDefaults();

      act(() => {
        result.current.handleAddressChange("gaazi4tcr3ty5ojhctjc2a4qsy6cjwjh5iajtgkin2er7lbnvkoccwn7");
      });

      expect(result.current.address).toBe(VALID_ADDRESS);
    });
  });

  describe("reset", () => {
    it("clears all state back to idle", async () => {
      mockLoadAccount.mockResolvedValueOnce({ account_id: VALID_ADDRESS });

      const { result } = renderHookWithDefaults();

      act(() => {
        result.current.handleAddressChange(VALID_ADDRESS);
      });

      act(() => {
        jest.advanceTimersByTime(50);
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.isValid).toBe(true);

      act(() => {
        result.current.reset();
      });

      expect(result.current.address).toBe("");
      expect(result.current.validationState).toBe("idle");
      expect(result.current.isValid).toBe(false);
      expect(result.current.errorMessage).toBeNull();
    });
  });
});
