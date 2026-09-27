/** @jest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { useTransactionSigning } from "../useTransactionSigning";
import { signWithProvider } from "../../services/transactionSigner";

jest.mock("../../services/transactionSigner", () => ({
  signWithProvider: jest.fn(),
}));

const mockedSignWithProvider = signWithProvider as jest.MockedFunction<typeof signWithProvider>;

describe("useTransactionSigning", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns to idle without an error when the user rejects signing", async () => {
    mockedSignWithProvider.mockResolvedValue({
      ok: false,
      code: "rejected",
      message: "The transaction signature was rejected in your wallet.",
      provider: "freighter",
    });

    const { result } = renderHook(() => useTransactionSigning());

    await act(async () => {
      await result.current.sign("freighter", {
        transactionXdr: "TX_XDR",
        network: "testnet",
      });
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.failure).toBeNull();
    expect(result.current.signedXdr).toBeNull();
  });
});
