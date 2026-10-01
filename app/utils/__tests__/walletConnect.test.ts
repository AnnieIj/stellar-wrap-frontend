import { isConnected, requestAccess } from "@stellar/freighter-api";
import {
  connectFreighter,
  FreighterNotInstalledError,
} from "../walletConnect";

jest.mock("@stellar/freighter-api", () => ({
  isConnected: jest.fn(),
  getAddress: jest.fn(),
  requestAccess: jest.fn(),
}));

describe("connectFreighter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete (window as Window & { freighter?: unknown }).freighter;
  });

  it("returns an actionable missing-extension error", async () => {
    (isConnected as jest.Mock).mockResolvedValue({ error: "not installed" });
    await expect(connectFreighter("mainnet")).rejects.toBeInstanceOf(
      FreighterNotInstalledError,
    );
  });

  it("keeps the generic request error for unknown failures", async () => {
    (isConnected as jest.Mock).mockResolvedValue({ error: null });
    (requestAccess as jest.Mock).mockRejectedValue(new Error("wallet unavailable"));
    await expect(connectFreighter("mainnet")).rejects.toThrow("wallet unavailable");
  });
});
