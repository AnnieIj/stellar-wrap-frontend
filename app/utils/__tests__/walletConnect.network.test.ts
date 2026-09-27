/**
 * Regression tests for #224 — wallet network validation before indexing.
 *
 * Covers:
 * - NetworkMismatchError is thrown when Freighter is on the wrong network
 * - connectFreighter succeeds when Freighter is on the correct network
 * - connectFreighter succeeds when network cannot be determined (null)
 * - getFreighterNetwork maps passphrases to the correct Network values
 *
 * @module walletConnect.network.test
 */

import { NETWORK_PASSPHRASES } from "@/src/config";
import {
  connectFreighter,
  getFreighterNetwork,
  NetworkMismatchError,
} from "@/app/utils/walletConnect";

// ─── Mock @stellar/freighter-api ────────────────────────────────────────────

jest.mock("@stellar/freighter-api", () => ({
  isConnected: jest.fn().mockResolvedValue({ error: null }),
  requestAccess: jest.fn().mockResolvedValue({
    address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
    error: null,
  }),
  getAddress: jest.fn().mockResolvedValue({
    address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
    error: null,
  }),
  getNetworkDetails: jest.fn(),
}));

import { getNetworkDetails } from "@stellar/freighter-api";
const mockGetNetworkDetails = getNetworkDetails as jest.Mock;

// ─── Helpers ────────────────────────────────────────────────────────────────

const MOCK_ADDRESS = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";

// The jest environment is "node" (see jest.config.ts) so `window` is
// undefined. isFreighterInstalled bails out early when window is missing.
// Inject a minimal global so the function reaches the isConnected() call.
beforeAll(() => {
  if (typeof global.window === "undefined") {
    // @ts-expect-error intentional window stub for node test env
    global.window = {};
  }
});

beforeEach(() => {
  jest.clearAllMocks();
  const freighterApi = jest.requireMock("@stellar/freighter-api");
  freighterApi.isConnected.mockResolvedValue({ error: null });
  freighterApi.requestAccess.mockResolvedValue({
    address: MOCK_ADDRESS,
    error: null,
  });
});

// ─── NetworkMismatchError ────────────────────────────────────────────────────

describe("NetworkMismatchError", () => {
  it("has the correct name", () => {
    const err = new NetworkMismatchError("testnet", "mainnet");
    expect(err.name).toBe("NetworkMismatchError");
  });

  it("exposes expected and actual networks", () => {
    const err = new NetworkMismatchError("testnet", "mainnet");
    expect(err.expected).toBe("testnet");
    expect(err.actual).toBe("mainnet");
  });

  it("is an instance of Error", () => {
    expect(new NetworkMismatchError("mainnet", "testnet")).toBeInstanceOf(Error);
  });

  it("message contains both network names", () => {
    const err = new NetworkMismatchError("testnet", "mainnet");
    expect(err.message).toContain("mainnet");
    expect(err.message).toContain("testnet");
  });
});

// ─── getFreighterNetwork ─────────────────────────────────────────────────────

describe("getFreighterNetwork", () => {
  it("returns 'mainnet' when passphrase matches mainnet", async () => {
    mockGetNetworkDetails.mockResolvedValue({
      networkPassphrase: NETWORK_PASSPHRASES.mainnet,
      network: "PUBLIC",
      networkUrl: "https://horizon.stellar.org",
    });
    expect(await getFreighterNetwork()).toBe("mainnet");
  });

  it("returns 'testnet' when passphrase matches testnet", async () => {
    mockGetNetworkDetails.mockResolvedValue({
      networkPassphrase: NETWORK_PASSPHRASES.testnet,
      network: "TESTNET",
      networkUrl: "https://horizon-testnet.stellar.org",
    });
    expect(await getFreighterNetwork()).toBe("testnet");
  });

  it("returns null for an unknown/custom network passphrase", async () => {
    mockGetNetworkDetails.mockResolvedValue({
      networkPassphrase: "Custom Standalone Network ; 2024",
      network: "STANDALONE",
      networkUrl: "http://localhost:8000",
    });
    expect(await getFreighterNetwork()).toBeNull();
  });

  it("returns null when getNetworkDetails returns an error", async () => {
    mockGetNetworkDetails.mockResolvedValue({
      error: { message: "Not connected" },
      networkPassphrase: "",
      network: "",
      networkUrl: "",
    });
    expect(await getFreighterNetwork()).toBeNull();
  });

  it("returns null when getNetworkDetails throws", async () => {
    mockGetNetworkDetails.mockRejectedValue(new Error("Extension not found"));
    expect(await getFreighterNetwork()).toBeNull();
  });

  it("handles leading/trailing whitespace in passphrase", async () => {
    mockGetNetworkDetails.mockResolvedValue({
      networkPassphrase: `  ${NETWORK_PASSPHRASES.testnet}  `,
      network: "TESTNET",
      networkUrl: "",
    });
    expect(await getFreighterNetwork()).toBe("testnet");
  });
});

// ─── connectFreighter — network validation regression (#224) ─────────────────

describe("connectFreighter — network mismatch regression (#224)", () => {
  it("throws NetworkMismatchError when wallet is on mainnet but app expects testnet", async () => {
    mockGetNetworkDetails.mockResolvedValue({
      networkPassphrase: NETWORK_PASSPHRASES.mainnet,
      network: "PUBLIC",
      networkUrl: "",
    });
    await expect(connectFreighter("testnet")).rejects.toBeInstanceOf(NetworkMismatchError);
  });

  it("thrown NetworkMismatchError has correct expected/actual fields", async () => {
    mockGetNetworkDetails.mockResolvedValue({
      networkPassphrase: NETWORK_PASSPHRASES.mainnet,
      network: "PUBLIC",
      networkUrl: "",
    });
    await expect(connectFreighter("testnet")).rejects.toMatchObject({
      expected: "testnet",
      actual: "mainnet",
    });
  });

  it("throws NetworkMismatchError when wallet is on testnet but app expects mainnet", async () => {
    mockGetNetworkDetails.mockResolvedValue({
      networkPassphrase: NETWORK_PASSPHRASES.testnet,
      network: "TESTNET",
      networkUrl: "",
    });
    await expect(connectFreighter("mainnet")).rejects.toBeInstanceOf(NetworkMismatchError);
  });

  it("resolves with the public key when wallet and app are both on testnet", async () => {
    mockGetNetworkDetails.mockResolvedValue({
      networkPassphrase: NETWORK_PASSPHRASES.testnet,
      network: "TESTNET",
      networkUrl: "",
    });
    await expect(connectFreighter("testnet")).resolves.toBe(MOCK_ADDRESS);
  });

  it("resolves with the public key when wallet and app are both on mainnet", async () => {
    mockGetNetworkDetails.mockResolvedValue({
      networkPassphrase: NETWORK_PASSPHRASES.mainnet,
      network: "PUBLIC",
      networkUrl: "",
    });
    await expect(connectFreighter("mainnet")).resolves.toBe(MOCK_ADDRESS);
  });

  it("does NOT throw NetworkMismatchError for unknown/custom network (graceful degradation)", async () => {
    mockGetNetworkDetails.mockResolvedValue({
      networkPassphrase: "Custom Network ; 2024",
      network: "STANDALONE",
      networkUrl: "",
    });
    await expect(connectFreighter("testnet")).resolves.toBe(MOCK_ADDRESS);
  });

  it("does NOT throw NetworkMismatchError when getNetworkDetails fails (graceful degradation)", async () => {
    mockGetNetworkDetails.mockRejectedValue(new Error("Freighter unavailable"));
    await expect(connectFreighter("mainnet")).resolves.toBe(MOCK_ADDRESS);
  });
});
