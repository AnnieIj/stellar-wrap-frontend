import { useTrustlineStore } from "../trustlineStore";

describe("useTrustlineStore", () => {
  beforeEach(() => {
    useTrustlineStore.getState().clearAll();
  });

  it("optimistically adds a trustline with pending status", () => {
    const item = useTrustlineStore
      .getState()
      .optimisticAddTrustline(
        "USDC",
        "GBBD47UZQ5O5K7PGQWUBZPC34EYWXVJ7UNVIOVG53FDKQ57ESVENSKWM",
        "1000"
      );

    expect(item.assetCode).toBe("USDC");
    expect(item.status).toBe("pending");
    expect(item.optimistic).toBe(true);

    const trustlines = useTrustlineStore.getState().trustlines;
    expect(trustlines.length).toBe(1);
    expect(trustlines[0].status).toBe("pending");
    expect(trustlines[0].optimistic).toBe(true);
  });

  it("confirms an optimistic trustline on success", () => {
    useTrustlineStore
      .getState()
      .optimisticAddTrustline(
        "USDC",
        "GBBD47UZQ5O5K7PGQWUBZPC34EYWXVJ7UNVIOVG53FDKQ57ESVENSKWM"
      );

    useTrustlineStore
      .getState()
      .confirmTrustline(
        "USDC",
        "GBBD47UZQ5O5K7PGQWUBZPC34EYWXVJ7UNVIOVG53FDKQ57ESVENSKWM",
        "txhash123"
      );

    const trustlines = useTrustlineStore.getState().trustlines;
    expect(trustlines.length).toBe(1);
    expect(trustlines[0].status).toBe("active");
    expect(trustlines[0].optimistic).toBe(false);
    expect(trustlines[0].transactionHash).toBe("txhash123");
  });

  it("reverts an optimistic trustline and sets error message on failure", () => {
    useTrustlineStore
      .getState()
      .optimisticAddTrustline(
        "USDC",
        "GBBD47UZQ5O5K7PGQWUBZPC34EYWXVJ7UNVIOVG53FDKQ57ESVENSKWM"
      );

    expect(useTrustlineStore.getState().trustlines.length).toBe(1);

    useTrustlineStore
      .getState()
      .revertTrustline(
        "USDC",
        "GBBD47UZQ5O5K7PGQWUBZPC34EYWXVJ7UNVIOVG53FDKQ57ESVENSKWM",
        "Transaction was rejected by the user in the wallet."
      );

    const trustlines = useTrustlineStore.getState().trustlines;
    expect(trustlines.length).toBe(0);
    expect(useTrustlineStore.getState().activeError).toBe(
      "Transaction was rejected by the user in the wallet."
    );
  });

  it("removes a trustline by code and issuer", () => {
    useTrustlineStore
      .getState()
      .optimisticAddTrustline(
        "USDC",
        "GBBD47UZQ5O5K7PGQWUBZPC34EYWXVJ7UNVIOVG53FDKQ57ESVENSKWM"
      );

    useTrustlineStore
      .getState()
      .removeTrustline(
        "USDC",
        "GBBD47UZQ5O5K7PGQWUBZPC34EYWXVJ7UNVIOVG53FDKQ57ESVENSKWM"
      );

    expect(useTrustlineStore.getState().trustlines.length).toBe(0);
  });
});
