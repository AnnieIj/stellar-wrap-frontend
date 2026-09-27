import {
  signWithFreighter,
  signWithAlbedo,
  signWithProvider,
  isUserRejection,
  withTimeout,
  verifyWalletForNetwork,
  detectConnectedProvider,
  USER_REJECTED_MESSAGE,
  type WalletProvider,
  type Albedo,
} from "../transactionSigner";

jest.mock("@stellar/freighter-api", () => ({
  signTransaction: jest.fn(),
}));

import * as walletConnect from "../../utils/walletConnect";

jest.mock("../../utils/walletConnect", () => ({
  getFreighterNetwork: jest.fn(),
  isAlbedoInstalled: jest.fn(() => false),
  isFreighterInstalled: jest.fn(() => true),
  isXBullInstalled: jest.fn(() => false),
}));

import { signTransaction } from "@stellar/freighter-api";

const mockFreighterInstalled = walletConnect.isFreighterInstalled as jest.Mock;
const mockGetFreighterNetwork = walletConnect.getFreighterNetwork as jest.Mock;
const mockAlbedoInstalled = walletConnect.isAlbedoInstalled as jest.Mock;
const mockXBullInstalled = walletConnect.isXBullInstalled as jest.Mock;

function setAlbedoWindow(albedo?: Albedo): void {
  const target = globalThis as unknown as { window?: { albedo?: Albedo } };
  target.window = albedo ? { albedo } : {};
}

describe("isUserRejection", () => {
  it("detects Freighter-style rejections", () => {
    expect(isUserRejection("User declined the request")).toBe(true);
    expect(isUserRejection(new Error("User rejected"))).toBe(true);
    expect(isUserRejection("Transaction rejected by user")).toBe(true);
  });

  it("detects Albedo-style cancellations", () => {
    expect(isUserRejection("User canceled the request")).toBe(true);
    expect(isUserRejection("Canceled by user")).toBe(true);
  });

  it("does not flag unrelated errors", () => {
    expect(isUserRejection("Failed to fetch account")).toBe(false);
    expect(isUserRejection("Network error")).toBe(false);
  });
});

describe("signWithFreighter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFreighterInstalled.mockResolvedValue(true);
  });

  it("returns the signed XDR on success", async () => {
    (signTransaction as jest.Mock).mockResolvedValue({
      signedTxXdr: "SIGNED_XDR",
      signerAddress: "GABC",
    });

    const result = await signWithFreighter({
      transactionXdr: "TX_XDR",
      network: "testnet",
    });

    expect(result).toEqual({
      ok: true,
      signedXdr: "SIGNED_XDR",
      provider: "freighter",
    });
    expect(signTransaction).toHaveBeenCalledWith("TX_XDR", {
      networkPassphrase: "Test SDF Network ; September 2015",
    });
  });

  it("maps a user rejection to a clear message", async () => {
    (signTransaction as jest.Mock).mockResolvedValue({
      error: { code: 1000, message: "User declined the request", ext: [] },
      signedTxXdr: "",
      signerAddress: "",
    });

    const result = await signWithFreighter({
      transactionXdr: "TX_XDR",
      network: "testnet",
    });

    expect(result).toEqual({
      ok: false,
      code: "rejected",
      message: USER_REJECTED_MESSAGE,
      provider: "freighter",
    });
  });

  it("reports when Freighter is not installed", async () => {
    mockFreighterInstalled.mockResolvedValue(false);

    const result = await signWithFreighter({
      transactionXdr: "TX_XDR",
      network: "testnet",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("not-installed");
      expect(result.provider).toBe("freighter");
    }
  });

  it("reports an empty signed transaction", async () => {
    (signTransaction as jest.Mock).mockResolvedValue({
      signedTxXdr: "",
      signerAddress: "GABC",
    });

    const result = await signWithFreighter({
      transactionXdr: "TX_XDR",
      network: "testnet",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("sign-error");
    }
  });

  it("times out instead of hanging when the wallet never responds", async () => {
    (signTransaction as jest.Mock).mockReturnValue(new Promise(() => {}));

    const result = await signWithFreighter({
      transactionXdr: "TX_XDR",
      network: "testnet",
      timeoutMs: 20,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("timeout");
    }
  });
});

describe("signWithAlbedo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setAlbedoWindow(undefined);
  });

  it("returns the signed XDR on success", async () => {
    const tx = jest.fn().mockResolvedValue({ tx: "SIGNED_XDR", signed: true, network: "testnet", pubkey: "GABC" });
    setAlbedoWindow({ publicKey: jest.fn(), tx });
    mockAlbedoInstalled.mockReturnValue(true);

    const result = await signWithAlbedo({
      transactionXdr: "TX_XDR",
      network: "mainnet",
    });

    expect(result).toEqual({ ok: true, signedXdr: "SIGNED_XDR", provider: "albedo" });
    expect(tx).toHaveBeenCalledWith({
      tx: "TX_XDR",
      network: "Public Global Stellar Network ; September 2015",
      submit: false,
    });
  });

  it("reports when Albedo is not available", async () => {
    mockAlbedoInstalled.mockReturnValue(false);

    const result = await signWithAlbedo({
      transactionXdr: "TX_XDR",
      network: "testnet",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("not-installed");
    }
  });

  it("maps user cancellation to a rejection", async () => {
    const tx = jest.fn().mockRejectedValue(new Error("User canceled the request"));
    setAlbedoWindow({ publicKey: jest.fn(), tx });
    mockAlbedoInstalled.mockReturnValue(true);

    const result = await signWithAlbedo({
      transactionXdr: "TX_XDR",
      network: "testnet",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("rejected");
    }
  });

  it("maps a passphrase mismatch to a network-mismatch failure", async () => {
    const tx = jest
      .fn()
      .mockRejectedValue(new Error("Selected network does not match the transaction"));
    setAlbedoWindow({ publicKey: jest.fn(), tx });
    mockAlbedoInstalled.mockReturnValue(true);

    const result = await signWithAlbedo({
      transactionXdr: "TX_XDR",
      network: "testnet",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("network-mismatch");
    }
  });
});

describe("signWithProvider", () => {
  it("dispatches to the matching provider signer", async () => {
    (signTransaction as jest.Mock).mockResolvedValue({
      signedTxXdr: "SIGNED_XDR",
      signerAddress: "GABC",
    });
    mockFreighterInstalled.mockResolvedValue(true);

    const result = await signWithProvider("freighter", {
      transactionXdr: "TX_XDR",
      network: "testnet",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.signedXdr).toBe("SIGNED_XDR");
    }
  });

  it("rejects unsupported providers with a structured failure", async () => {
    const result = await signWithProvider("xbull" as WalletProvider, {
      transactionXdr: "TX_XDR",
      network: "testnet",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("sign-error");
    }
  });
});

describe("withTimeout", () => {
  it("resolves when the promise beats the deadline", async () => {
    await expect(
      withTimeout(Promise.resolve("fast"), 100, "slow"),
    ).resolves.toBe("fast");
  });

  it("rejects with the timeout message when the promise lags", async () => {
    const slow = new Promise<string>(() => {});
    await expect(
      withTimeout(slow, 20, "timed out waiting"),
    ).rejects.toThrow("timed out waiting");
  });
});

describe("verifyWalletForNetwork", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFreighterInstalled.mockResolvedValue(true);
  });

  it("blocks the switch on a Freighter network mismatch", async () => {
    mockGetFreighterNetwork.mockResolvedValue("testnet");

    const result = await verifyWalletForNetwork("mainnet");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("network-mismatch");
      expect(result.actual).toBe("testnet");
    }
  });

  it("allows the switch when Freighter matches the target", async () => {
    mockGetFreighterNetwork.mockResolvedValue("mainnet");

    await expect(verifyWalletForNetwork("mainnet")).resolves.toEqual({ ok: true });
  });

  it("allows the switch when no wallet is installed", async () => {
    mockFreighterInstalled.mockResolvedValue(false);

    await expect(verifyWalletForNetwork("testnet")).resolves.toEqual({ ok: true });
  });
});

describe("detectConnectedProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("prefers Freighter when installed", async () => {
    mockFreighterInstalled.mockResolvedValue(true);
    await expect(detectConnectedProvider()).resolves.toBe("freighter");
  });

  it("falls back to Albedo when Freighter is missing", async () => {
    mockFreighterInstalled.mockResolvedValue(false);
    mockAlbedoInstalled.mockReturnValue(true);
    await expect(detectConnectedProvider()).resolves.toBe("albedo");
  });

  it("returns null when nothing is connected", async () => {
    mockFreighterInstalled.mockResolvedValue(false);
    mockAlbedoInstalled.mockReturnValue(false);
    mockXBullInstalled.mockReturnValue(false);
    await expect(detectConnectedProvider()).resolves.toBeNull();
  });
});