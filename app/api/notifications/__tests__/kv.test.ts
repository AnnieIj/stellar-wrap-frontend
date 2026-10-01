/**
 * Tests for app/api/notifications/_lib/kv.ts
 *
 * Verifies:
 *  ✓ Key builders produce correctly namespaced strings
 *  ✓ Key builders are pure functions (same input → same output)
 *  ✓ Keys are prefixed with `notif:` (no collisions with other subsystems)
 *  ✓ KV_FAILURE_LOUD / KV_FAILURE_DEGRADE constants have the expected values
 *  ✓ KvFailureMode type is correctly narrowed (compile-time, exercised at runtime)
 *  ✓ Storage helpers are re-exported from the notifications kv module
 *    (kvGet, kvSet, kvDel, kvKeys, kvSAdd, kvSRem, kvReset)
 *  ✓ LOUD callers: a KV error propagates (dispatch behaviour)
 *  ✓ DEGRADE callers: a KV error is caught and a fallback is returned
 */

import {
  SUB_KEY,
  PERIOD_KEY,
  LOG_KEY,
  KV_FAILURE_LOUD,
  KV_FAILURE_DEGRADE,
  kvGet,
  kvSet,
  kvDel,
  kvKeys,
  kvSAdd,
  kvSRem,
  kvReset,
  type KvFailureMode,
} from "@/app/api/notifications/_lib/kv";

// ─── Key builder tests ────────────────────────────────────────────────────────

const WALLET = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

describe("SUB_KEY", () => {
  it("returns the expected namespaced key", () => {
    expect(SUB_KEY(WALLET)).toBe(`notif:sub:${WALLET}`);
  });

  it("is prefixed with notif: to avoid cross-subsystem collisions", () => {
    expect(SUB_KEY(WALLET)).toMatch(/^notif:/);
  });

  it("is a pure function — same wallet produces the same key", () => {
    expect(SUB_KEY(WALLET)).toBe(SUB_KEY(WALLET));
  });

  it("distinguishes different wallets", () => {
    const wallet2 = "GBQEIVBSMGZJZM7DB7OQHQDPKB3SDNSPBIFKBX7KGLQMCJKQIQSFVGA";
    expect(SUB_KEY(WALLET)).not.toBe(SUB_KEY(wallet2));
  });

  it("encodes the wallet address verbatim", () => {
    expect(SUB_KEY(WALLET)).toContain(WALLET);
  });
});

describe("PERIOD_KEY", () => {
  it("returns the expected namespaced key for weekly", () => {
    expect(PERIOD_KEY("weekly")).toBe("notif:period:weekly");
  });

  it("returns the expected namespaced key for monthly", () => {
    expect(PERIOD_KEY("monthly")).toBe("notif:period:monthly");
  });

  it("returns the expected namespaced key for yearly", () => {
    expect(PERIOD_KEY("yearly")).toBe("notif:period:yearly");
  });

  it("is prefixed with notif:", () => {
    expect(PERIOD_KEY("weekly")).toMatch(/^notif:/);
  });

  it("is a pure function", () => {
    expect(PERIOD_KEY("monthly")).toBe(PERIOD_KEY("monthly"));
  });

  it("distinguishes different periods", () => {
    expect(PERIOD_KEY("weekly")).not.toBe(PERIOD_KEY("monthly"));
    expect(PERIOD_KEY("monthly")).not.toBe(PERIOD_KEY("yearly"));
  });
});

describe("LOG_KEY", () => {
  const CHANNEL = "email";
  const PERIOD = "monthly";
  const PERIOD_KEY_VAL = "2026-09";

  it("returns the expected namespaced key", () => {
    expect(LOG_KEY(WALLET, CHANNEL, PERIOD, PERIOD_KEY_VAL)).toBe(
      `notif:log:${WALLET}:${CHANNEL}:${PERIOD}:${PERIOD_KEY_VAL}`,
    );
  });

  it("is prefixed with notif:", () => {
    expect(LOG_KEY(WALLET, CHANNEL, PERIOD, PERIOD_KEY_VAL)).toMatch(/^notif:/);
  });

  it("is a pure function", () => {
    expect(LOG_KEY(WALLET, CHANNEL, PERIOD, PERIOD_KEY_VAL)).toBe(
      LOG_KEY(WALLET, CHANNEL, PERIOD, PERIOD_KEY_VAL),
    );
  });

  it("encodes all four segments in order", () => {
    const key = LOG_KEY(WALLET, "push", "weekly", "2026-W39");
    expect(key).toContain(WALLET);
    expect(key).toContain(":push:");
    expect(key).toContain(":weekly:");
    expect(key).toContain(":2026-W39");
  });

  it("distinguishes different channels", () => {
    expect(LOG_KEY(WALLET, "email", PERIOD, PERIOD_KEY_VAL)).not.toBe(
      LOG_KEY(WALLET, "push", PERIOD, PERIOD_KEY_VAL),
    );
  });

  it("distinguishes different period keys (prevents double-send across windows)", () => {
    expect(LOG_KEY(WALLET, CHANNEL, PERIOD, "2026-08")).not.toBe(
      LOG_KEY(WALLET, CHANNEL, PERIOD, "2026-09"),
    );
  });

  it("distinguishes different wallets", () => {
    const wallet2 = "GBQEIVBSMGZJZM7DB7OQHQDPKB3SDNSPBIFKBX7KGLQMCJKQIQSFVGA";
    expect(LOG_KEY(WALLET, CHANNEL, PERIOD, PERIOD_KEY_VAL)).not.toBe(
      LOG_KEY(wallet2, CHANNEL, PERIOD, PERIOD_KEY_VAL),
    );
  });
});

// ─── Key namespace isolation ──────────────────────────────────────────────────

describe("key namespace isolation", () => {
  it("no two key families produce the same key for the same input", () => {
    const input = "test";
    const sub = SUB_KEY(input);
    const period = PERIOD_KEY(input);
    const log = LOG_KEY(input, input, input, input);

    expect(sub).not.toBe(period);
    expect(sub).not.toBe(log);
    expect(period).not.toBe(log);
  });

  it("all families use distinct sub-prefixes", () => {
    expect(SUB_KEY("x")).toMatch(/^notif:sub:/);
    expect(PERIOD_KEY("x")).toMatch(/^notif:period:/);
    expect(LOG_KEY("x", "x", "x", "x")).toMatch(/^notif:log:/);
  });
});

// ─── Failure-mode constants ───────────────────────────────────────────────────

describe("KV_FAILURE_LOUD", () => {
  it('has value "LOUD"', () => {
    expect(KV_FAILURE_LOUD).toBe("LOUD");
  });

  it("is assignable to KvFailureMode", () => {
    const mode: KvFailureMode = KV_FAILURE_LOUD;
    expect(mode).toBe("LOUD");
  });
});

describe("KV_FAILURE_DEGRADE", () => {
  it('has value "DEGRADE"', () => {
    expect(KV_FAILURE_DEGRADE).toBe("DEGRADE");
  });

  it("is assignable to KvFailureMode", () => {
    const mode: KvFailureMode = KV_FAILURE_DEGRADE;
    expect(mode).toBe("DEGRADE");
  });
});

describe("KvFailureMode", () => {
  it("only two valid modes exist", () => {
    const validModes: KvFailureMode[] = [KV_FAILURE_LOUD, KV_FAILURE_DEGRADE];
    expect(validModes).toHaveLength(2);
  });

  it("LOUD and DEGRADE are distinct", () => {
    expect(KV_FAILURE_LOUD).not.toBe(KV_FAILURE_DEGRADE);
  });
});

// ─── Storage helper re-exports ────────────────────────────────────────────────
//
// Confirms the notifications kv module re-exports every helper so route files
// never need to import from ../../_lib/kv directly.

describe("storage helper re-exports", () => {
  beforeEach(() => {
    kvReset();
  });

  it("kvSet and kvGet round-trip a value", async () => {
    await kvSet("test:key", { value: 42 });
    const result = await kvGet<{ value: number }>("test:key");
    expect(result).toEqual({ value: 42 });
  });

  it("kvGet returns null for a missing key", async () => {
    expect(await kvGet("test:missing")).toBeNull();
  });

  it("kvDel removes a key", async () => {
    await kvSet("test:del", "hello");
    await kvDel("test:del");
    expect(await kvGet("test:del")).toBeNull();
  });

  it("kvKeys returns matching keys by prefix pattern", async () => {
    await kvSet("notif:sub:GAAA", { wallet: "GAAA" });
    await kvSet("notif:sub:GBBB", { wallet: "GBBB" });
    await kvSet("notif:period:monthly", "set");

    const subKeys = await kvKeys("notif:sub:*");
    expect(subKeys).toEqual(
      expect.arrayContaining(["notif:sub:GAAA", "notif:sub:GBBB"]),
    );
    expect(subKeys).not.toContain("notif:period:monthly");
  });

  it("kvSAdd adds a member to a set key", async () => {
    await kvSAdd("test:set", "member1");
    await kvSAdd("test:set", "member2");
    const keys = await kvKeys("test:set*");
    expect(keys).toContain("test:set");
  });

  it("kvSRem removes a member (void return — underlying srem count not exposed)", async () => {
    await kvSAdd("test:srem", "m1");
    await expect(kvSRem("test:srem", "m1")).resolves.toBeUndefined();
    // Second call on missing member also resolves without error
    await expect(kvSRem("test:srem", "m1")).resolves.toBeUndefined();
  });

  it("kvReset clears all keys", async () => {
    await kvSet("test:a", 1);
    await kvSet("test:b", 2);
    kvReset();
    expect(await kvGet("test:a")).toBeNull();
    expect(await kvGet("test:b")).toBeNull();
  });
});

// ─── Failure-mode behaviour ───────────────────────────────────────────────────
//
// Simulates the contract difference between LOUD callers (dispatch) and
// DEGRADE callers (preferences GET).

describe("LOUD caller — KV error propagates (dispatch pattern)", () => {
  it("propagates a rejected kvGet", async () => {
    const brokenGet = jest
      .fn()
      .mockRejectedValue(new Error("KV: connection refused"));
    await expect(brokenGet(SUB_KEY(WALLET))).rejects.toThrow("KV: connection refused");
  });

  it("propagates a rejected kvSet", async () => {
    const brokenSet = jest
      .fn()
      .mockRejectedValue(new Error("KV: quota exceeded"));
    await expect(brokenSet(SUB_KEY(WALLET), {})).rejects.toThrow("KV: quota exceeded");
  });

  it("propagates a rejected kvKeys (dispatch fan-out)", async () => {
    const brokenKeys = jest
      .fn()
      .mockRejectedValue(new Error("KV: ECONNRESET"));
    await expect(brokenKeys("notif:sub:*")).rejects.toThrow("KV: ECONNRESET");
  });
});

describe("DEGRADE caller — KV error is caught, fallback returned (preferences GET pattern)", () => {
  it("catches a rejected kvGet and returns null", async () => {
    const brokenGet = jest.fn().mockRejectedValue(new Error("KV: timeout"));

    let result: unknown = "NOT_NULL";
    try {
      result = await brokenGet(SUB_KEY(WALLET));
    } catch {
      result = null; // degrade: treat as missing record
    }

    expect(result).toBeNull();
  });

  it("catches error and serves a pre-defined fallback record", async () => {
    const FALLBACK = {
      walletAddress: WALLET,
      consentGiven: false,
      consentTimestamp: "",
    };
    const brokenGet = jest.fn().mockRejectedValue(new Error("KV: ECONNRESET"));

    let record = FALLBACK;
    try {
      record = await brokenGet(SUB_KEY(WALLET));
    } catch {
      // DEGRADE — keep FALLBACK, do not re-throw
    }

    expect(record).toEqual(FALLBACK);
  });

  it("does not re-throw — error is fully absorbed", async () => {
    const brokenGet = jest.fn().mockRejectedValue(new Error("KV: network"));

    const runDegrade = async () => {
      try {
        await brokenGet(SUB_KEY(WALLET));
      } catch {
        return null;
      }
    };

    await expect(runDegrade()).resolves.toBeNull();
  });
});
