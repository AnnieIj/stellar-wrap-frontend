import { buildMintWrapArgs, validateMintWrapInput } from "../../utils/contractArgsBuilder";

const validGAddr = "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function hexBytes(n: number): Uint8Array {
  const arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) arr[i] = i % 256;
  return arr;
}

function run() {
  // ── Happy path: exact arg count, order, and types ─────────────────────
  {
    const result = buildMintWrapArgs({
      accountAddress: validGAddr,
      period: "monthly",
      archetype: "The DeFi Patron",
      dataHash: hexBytes(32),
      signature: hexBytes(64),
    });

    assert(result.success, "buildMintWrapArgs succeeds with valid input");
    if (result.success) {
      assert(result.data.args.length === 5, "produces exactly 5 args");

      const [user, period, archetype, dataHash, signature] = result.data.args;
      assert(user.switch().name === "scvAddress", "arg0 (user) is scvAddress");
      assert(period.switch().name === "scvString", "arg1 (period) is scvString");
      assert(
        archetype.switch().name === "scvString",
        "arg2 (archetype) is scvString",
      );
      assert(
        dataHash.switch().name === "scvBytes",
        "arg3 (data_hash) is scvBytes",
      );
      assert(
        signature.switch().name === "scvBytes",
        "arg4 (signature) is scvBytes",
      );

      assert(period.str().toString() === "monthly", "period value preserved");
      assert(
        archetype.str().toString() === "The DeFi Patron",
        "archetype value preserved",
      );
      assert(dataHash.bytes().length === 32, "data_hash length preserved");
      assert(signature.bytes().length === 64, "signature length preserved");
    }
  }

  // ── Rejects invalid address ────────────────────────────────────────────
  {
    const result = buildMintWrapArgs({
      accountAddress: "not-a-real-address",
      period: "monthly",
      archetype: "The DeFi Patron",
      dataHash: hexBytes(32),
      signature: hexBytes(64),
    });
    assert(!result.success, "rejects invalid accountAddress");
  }

  // ── Rejects empty period ───────────────────────────────────────────────
  {
    const result = buildMintWrapArgs({
      accountAddress: validGAddr,
      period: "",
      archetype: "The DeFi Patron",
      dataHash: hexBytes(32),
      signature: hexBytes(64),
    });
    assert(!result.success, "rejects empty period");
  }

  // ── Rejects empty archetype ────────────────────────────────────────────
  {
    const result = buildMintWrapArgs({
      accountAddress: validGAddr,
      period: "monthly",
      archetype: "",
      dataHash: hexBytes(32),
      signature: hexBytes(64),
    });
    assert(!result.success, "rejects empty archetype");
  }

  // ── Rejects missing dataHash ───────────────────────────────────────────
  {
    const errors = validateMintWrapInput({
      accountAddress: validGAddr,
      period: "monthly",
      archetype: "The DeFi Patron",
      dataHash: new Uint8Array(0),
      signature: hexBytes(64),
    });
    assert(
      errors.some((e) => e.toLowerCase().includes("datahash")),
      "flags missing dataHash",
    );
  }

  // ── Rejects missing signature ──────────────────────────────────────────
  {
    const errors = validateMintWrapInput({
      accountAddress: validGAddr,
      period: "monthly",
      archetype: "The DeFi Patron",
      dataHash: hexBytes(32),
      signature: new Uint8Array(0),
    });
    assert(
      errors.some((e) => e.toLowerCase().includes("signature")),
      "flags missing signature",
    );
  }

  console.log("✅ mintWrapArgs tests passed");
}

run();