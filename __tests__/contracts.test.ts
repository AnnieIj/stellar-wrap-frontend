/**
 * Unit tests for network-aware contract configuration.
 * Run with: npm test
 */

import {
  isValidContractAddress,
  isPlaceholderContractAddress,
  getContractAddress,
  getContractConfigForAllNetworks,
  PLACEHOLDER_CONTRACT_ADDRESS,
  PlaceholderContractAddressError,
} from "../config/contracts";
import { NETWORKS, type Network } from "../src/config";

const VALID_CONTRACT_ID =
  "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE";

describe("isValidContractAddress", () => {
  it("accepts valid 56-char C-prefix base32 address", () => {
    expect(isValidContractAddress(VALID_CONTRACT_ID)).toBe(true);
  });

  it("accepts placeholder address format (still C + 55 A's)", () => {
    expect(isValidContractAddress(PLACEHOLDER_CONTRACT_ADDRESS)).toBe(true);
  });

  it("rejects non-C prefix", () => {
    expect(isValidContractAddress("G" + "A".repeat(55))).toBe(false);
  });

  it("rejects wrong length", () => {
    expect(isValidContractAddress("C" + "A".repeat(54))).toBe(false);
    expect(isValidContractAddress("C" + "A".repeat(56))).toBe(false);
  });

  it("rejects invalid base32 characters", () => {
    expect(isValidContractAddress("C" + "1".repeat(55))).toBe(false);
  });
});

describe("isPlaceholderContractAddress", () => {
  it("detects full CAAAAA… placeholder", () => {
    expect(isPlaceholderContractAddress(PLACEHOLDER_CONTRACT_ADDRESS)).toBe(
      true,
    );
  });

  it("detects partial CAAAAAAA prefix used by legacy bridges", () => {
    expect(isPlaceholderContractAddress("CAAAAAAAA" + "B".repeat(47))).toBe(
      true,
    );
  });

  it("does not flag a real contract id", () => {
    expect(isPlaceholderContractAddress(VALID_CONTRACT_ID)).toBe(false);
  });
});

describe("getContractConfigForAllNetworks", () => {
  it("returns config for mainnet and testnet", () => {
    const config = getContractConfigForAllNetworks();
    expect(config).toHaveProperty("mainnet");
    expect(config).toHaveProperty("testnet");
    expect(config.mainnet).toHaveProperty("contractAddress");
    expect(config.testnet).toHaveProperty("contractAddress");
  });
});

describe("getContractAddress rejects placeholders / missing env", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    delete process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_MAINNET;
    delete process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_TESTNET;
  });

  it("throws PlaceholderContractAddressError when mainnet env is missing", () => {
    delete process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    delete process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_MAINNET;

    expect(() => getContractAddress(NETWORKS.MAINNET)).toThrow(
      PlaceholderContractAddressError,
    );
    try {
      getContractAddress(NETWORKS.MAINNET);
    } catch (e) {
      expect(e).toBeInstanceOf(PlaceholderContractAddressError);
      const err = e as PlaceholderContractAddressError;
      expect(err.userMessage).toMatch(/not ready for minting/i);
      expect(err.developerHint).toMatch(/NEXT_PUBLIC_CONTRACT_ADDRESS_MAINNET/);
    }
  });

  it("throws PlaceholderContractAddressError when testnet env is missing", () => {
    delete process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    delete process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_TESTNET;

    expect(() => getContractAddress(NETWORKS.TESTNET)).toThrow(
      PlaceholderContractAddressError,
    );
    try {
      getContractAddress(NETWORKS.TESTNET);
    } catch (e) {
      expect(e).toBeInstanceOf(PlaceholderContractAddressError);
      const err = e as PlaceholderContractAddressError;
      expect(err.developerHint).toMatch(/NEXT_PUBLIC_CONTRACT_ADDRESS_TESTNET/);
    }
  });

  it("returns configured address when env is set", () => {
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_MAINNET = VALID_CONTRACT_ID;
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_TESTNET = VALID_CONTRACT_ID;
    expect(getContractAddress(NETWORKS.MAINNET)).toBe(VALID_CONTRACT_ID);
    expect(getContractAddress(NETWORKS.TESTNET)).toBe(VALID_CONTRACT_ID);
  });

  it("throws on invalid network", () => {
    expect(() => getContractAddress("invalid" as Network)).toThrow();
  });
});
