import {
  buildStellarAsset,
  parseTrustlineError,
  TrustlineError,
} from "../trustlineService";

describe("trustlineService", () => {
  describe("buildStellarAsset", () => {
    it("creates an Asset instance for valid code and issuer", () => {
      const asset = buildStellarAsset(
        "USDC",
        "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI"
      );
      expect(asset.getCode()).toBe("USDC");
      expect(asset.getIssuer()).toBe(
        "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI"
      );
    });

    it("throws TrustlineError on empty or invalid asset code", () => {
      expect(() =>
        buildStellarAsset(
          "",
          "GBBD47UZQ5O5K7PGQWUBZPC34EYWXVJ7UNVIOVG53FDKQ57ESVENSKWM"
        )
      ).toThrow(/Invalid asset code/);

      expect(() =>
        buildStellarAsset(
          "TOOLONGASSETCODE123",
          "GBBD47UZQ5O5K7PGQWUBZPC34EYWXVJ7UNVIOVG53FDKQ57ESVENSKWM"
        )
      ).toThrow(/Invalid asset code/);
    });

    it("throws TrustlineError on invalid issuer", () => {
      expect(() => buildStellarAsset("USDC", "NOTANISSUER")).toThrow(
        /Invalid asset issuer/
      );
    });
  });

  describe("parseTrustlineError", () => {
    it("recognizes user cancellation / rejection from Freighter", () => {
      const err = new Error("User declined transaction");
      expect(parseTrustlineError(err)).toBe(
        "Transaction was rejected by the user in the wallet."
      );

      const err2 = new Error("Transaction rejected");
      expect(parseTrustlineError(err2)).toBe(
        "Transaction was rejected by the user in the wallet."
      );
    });

    it("recognizes timeout errors", () => {
      const err = new Error("Request timed out");
      expect(parseTrustlineError(err)).toBe(
        "Network connection timed out. Please check your network connection and retry."
      );
    });

    it("recognizes insufficient reserve errors", () => {
      const err = new Error("op_low_reserve");
      expect(parseTrustlineError(err)).toBe(
        "Account does not have enough XLM reserve to create a new trustline."
      );
    });

    it("recognizes rate limits", () => {
      const err = new Error("Rate limit exceeded 429");
      expect(parseTrustlineError(err)).toBe(
        "Network rate limit reached. The request has been queued for automatic retry."
      );
    });
  });
});
