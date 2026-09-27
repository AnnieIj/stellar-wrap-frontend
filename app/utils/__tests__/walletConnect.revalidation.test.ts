/**
 * Tests for session re-validation (`validateWalletConnection`) used when
 * restoring a persisted wallet connection across page refreshes.
 */

import {
  validateWalletConnection,
} from "@/app/utils/walletConnect";

jest.mock("@stellar/freighter-api", () => ({
  isConnected: jest.fn(),
  getAddress: jest.fn(),
  requestAccess: jest.fn(),
  getNetworkDetails: jest.fn(),
}));

import { isConnected, getNetworkDetails } from "@stellar/freighter-api";
const mockIsConnected = isConnected as jest.Mock;
const mockGetNetworkDetails = getNetworkDetails as jest.Mock;

const MOCK_ADDRESS = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
const INVALID_ADDRESS = "not-a-valid-stellar-address";

const VALID_ADDRESS_SET = MOCK_ADDRESS;

// `isValidStellarAddress` requires a lowercase-free base32 of length 56. Reuse
// a known-valid fixture by building it from the same char set.
function makeValidAddress(): string {
  return VALID_ADDRESS_SET;
}

beforeAll(() => {
  if (typeof global.window === "undefined") {
    (global as { window?: unknown }).window = {};
  }
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("validateWalletConnection", () => {
  it("returns disconnected when the address is empty", async () => {
    const result = await validateWalletConnection("freighter", "", "mainnet");
    expect(result).toEqual({ ok: false, reason: "disconnected" });
  });

  it("returns disconnected for an invalid address", async () => {
    const result = await validateWalletConnection(
      "manual",
      INVALID_ADDRESS,
      "mainnet",
    );
    expect(result).toEqual({ ok: false, reason: "disconnected" });
  });

  it("returns ok for a manual session with a valid address (no wallet to probe)", async () => {
    const result = await validateWalletConnection(
      "manual",
      makeValidAddress(),
      "mainnet",
    );
    expect(result).toEqual({ ok: true });
  });

  it("returns ok for a demo session with a valid address", async () => {
    const result = await validateWalletConnection(
      "demo",
      makeValidAddress(),
      "testnet",
    );
    expect(result).toEqual({ ok: true });
  });

  it("returns ok for walletconnect without a live probe", async () => {
    const result = await validateWalletConnection(
      "walletconnect",
      makeValidAddress(),
      "mainnet",
    );
    expect(result).toEqual({ ok: true });
  });

  it("returns disconnected when there is no provider", async () => {
    const result = await validateWalletConnection(
      null,
      makeValidAddress(),
      "mainnet",
    );
    expect(result).toEqual({ ok: false, reason: "disconnected" });
  });

  describe("freighter", () => {
    it("returns disconnected when freighter is not installed", async () => {
      mockIsConnected.mockResolvedValue({ error: "not installed" });
      delete (window as Window & { freighter?: unknown }).freighter;
      const result = await validateWalletConnection(
        "freighter",
        makeValidAddress(),
        "mainnet",
      );
      expect(result).toEqual({ ok: false, reason: "disconnected" });
    });

    it("returns ok when freighter is installed and on the matching network", async () => {
      mockIsConnected.mockResolvedValue({ error: null });
      mockGetNetworkDetails.mockResolvedValue({
        networkPassphrase: "Public Global Stellar Network ; September 2015",
        network: "PUBLIC",
        networkUrl: "",
      });
      const result = await validateWalletConnection(
        "freighter",
        makeValidAddress(),
        "mainnet",
      );
      expect(result).toEqual({ ok: true });
    });

    it("returns network-mismatch when freighter is on a different network", async () => {
      mockIsConnected.mockResolvedValue({ error: null });
      mockGetNetworkDetails.mockResolvedValue({
        networkPassphrase: "Test SDF Network ; September 2015",
        network: "TESTNET",
        networkUrl: "",
      });
      const result = await validateWalletConnection(
        "freighter",
        makeValidAddress(),
        "mainnet",
      );
      expect(result).toEqual({ ok: false, reason: "network-mismatch" });
    });
  });

  describe("albedo / xbull", () => {
    it("returns ok when the albedo extension global exists", async () => {
      (window as Window & { albedo?: unknown }).albedo = {};
      const result = await validateWalletConnection(
        "albedo",
        makeValidAddress(),
        "mainnet",
      );
      expect(result).toEqual({ ok: true });
    });

    it("returns disconnected when the albedo extension is missing", async () => {
      delete (window as Window & { albedo?: unknown }).albedo;
      const result = await validateWalletConnection(
        "albedo",
        makeValidAddress(),
        "mainnet",
      );
      expect(result).toEqual({ ok: false, reason: "disconnected" });
    });

    it("returns ok when the xbull extension global exists", async () => {
      (window as Window & { xBull?: unknown }).xBull = {};
      const result = await validateWalletConnection(
        "xbull",
        makeValidAddress(),
        "mainnet",
      );
      expect(result).toEqual({ ok: true });
    });

    it("returns disconnected when the xbull extension is missing", async () => {
      delete (window as Window & { xBull?: unknown }).xBull;
      const result = await validateWalletConnection(
        "xbull",
        makeValidAddress(),
        "mainnet",
      );
      expect(result).toEqual({ ok: false, reason: "disconnected" });
    });
  });
});
