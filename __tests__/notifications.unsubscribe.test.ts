/**
 * Tests for the notifications unsubscribe route and the token store.
 *
 * Covers every assertion listed in the issue:
 *  ✓ Bare walletAddress alone is rejected (401)
 *  ✓ Token path succeeds with a valid, unexpired, channel-matching token
 *  ✓ Token is single-use (second call with same token is rejected)
 *  ✓ Token is channel-scoped (correct channel required)
 *  ✓ Expired token is rejected
 *  ✓ Proof-of-address path succeeds with a valid signature
 *  ✓ Proof-of-address path rejects a bad signature
 *  ✓ Replay nonce is rejected
 *  ✓ Missing required fields produce 400
 *  ✓ tokenStore unit tests (saveToken / consumeToken / purge)
 */

// ─── Next.js route handler test helpers ─────────────────────────────────────
//
// We don't spin up an HTTP server.  Instead we call the exported POST function
// directly with a minimal NextRequest mock and inspect the NextResponse.

import { NextRequest } from "next/server";
import { Keypair } from "stellar-sdk";

// Route under test
import { POST as unsubscribePOST } from "@/app/api/notifications/unsubscribe/route";

// Token store helpers
import {
  saveToken,
  consumeToken,
  peekToken,
  purgeExpiredTokens,
  _clearStoreForTests,
  TOKEN_TTL_MS,
  type Channel,
} from "@/app/api/notifications/tokenStore";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal NextRequest with a JSON body. */
function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/notifications/unsubscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Parse the JSON body of a NextResponse. */
async function json(res: Response): Promise<unknown> {
  return res.json();
}

/**
 * Generate a real Ed25519 key-pair and sign the canonical challenge message.
 * Returns everything the proof-of-address path needs.
 */
function buildProofOfAddress(
  channel: Channel,
  overrideNonce?: string,
): {
  walletAddress: string;
  signature: string;
  nonce: string;
  channel: Channel;
} {
  const keypair = Keypair.random();
  const nonce = overrideNonce ?? `test-nonce-${Math.random().toString(36).slice(2)}`;
  const message = `stellar-wrap-notifications-unsubscribe:${nonce}`;
  const sigBytes = keypair.sign(Buffer.from(message, "utf8"));
  return {
    walletAddress: keypair.publicKey(),
    signature: Buffer.from(sigBytes).toString("base64"),
    nonce,
    channel,
  };
}

// ─── tokenStore unit tests ────────────────────────────────────────────────────

describe("tokenStore", () => {
  beforeEach(() => {
    _clearStoreForTests();
  });

  it("saves and peeks a token", () => {
    saveToken("tok1", "GABCDE", "email");
    const rec = peekToken("tok1");
    expect(rec).toBeDefined();
    expect(rec?.walletAddress).toBe("GABCDE");
    expect(rec?.channel).toBe("email");
  });

  it("consumeToken succeeds and deletes on first use", () => {
    saveToken("tok2", "GABCDE", "sms");
    const rec = consumeToken("tok2", "sms");
    expect(rec).not.toBeNull();
    expect(rec?.channel).toBe("sms");
    // Token must be gone after consumption
    expect(peekToken("tok2")).toBeUndefined();
  });

  it("token is single-use: second consume returns null", () => {
    saveToken("tok3", "GABCDE", "push");
    consumeToken("tok3", "push"); // first use
    const second = consumeToken("tok3", "push"); // replay
    expect(second).toBeNull();
  });

  it("token is channel-scoped: wrong channel returns null and deletes token", () => {
    saveToken("tok4", "GABCDE", "email");
    const rec = consumeToken("tok4", "sms"); // wrong channel
    expect(rec).toBeNull();
    // Token was still deleted (prevents channel probing via retry)
    expect(peekToken("tok4")).toBeUndefined();
  });

  it("expired token is rejected", () => {
    saveToken("tok5", "GABCDE", "email");
    // Manually expire by patching expiresAt
    const entry = (peekToken as (t: string) => { expiresAt: number } | undefined)("tok5")!;
    Object.defineProperty(entry, "expiresAt", {
      value: Date.now() - 1,
      writable: true,
    });
    const rec = consumeToken("tok5", "email");
    expect(rec).toBeNull();
  });

  it("consumeToken on unknown token returns null", () => {
    expect(consumeToken("unknown-token", "email")).toBeNull();
  });

  it("purgeExpiredTokens removes only expired entries and returns count", () => {
    saveToken("live", "GABCDE", "email");
    saveToken("dead", "GABCDE", "sms");

    // Expire 'dead'
    const deadEntry = (peekToken as (t: string) => { expiresAt: number } | undefined)("dead")!;
    Object.defineProperty(deadEntry, "expiresAt", {
      value: Date.now() - 1,
      writable: true,
    });

    const removed = purgeExpiredTokens();
    expect(removed).toBe(1);
    expect(peekToken("live")).toBeDefined();
    expect(peekToken("dead")).toBeUndefined();
  });

  it("TOKEN_TTL_MS is 24 hours", () => {
    expect(TOKEN_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });
});

// ─── Unsubscribe route – bare walletAddress path (the #608 regression) ────────

describe("POST /api/notifications/unsubscribe – bare walletAddress path", () => {
  beforeEach(() => _clearStoreForTests());

  it("rejects walletAddress + channel with no token and no signature (401)", async () => {
    const res = await unsubscribePOST(
      makeRequest({
        walletAddress: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
        channel: "email",
      }),
    );
    expect(res.status).toBe(401);
    const body = await json(res) as Record<string, unknown>;
    expect(typeof body.error).toBe("string");
    expect((body.error as string).toLowerCase()).toContain("unauthenticated");
  });

  it("rejects walletAddress + channel (sms) with no token and no signature (401)", async () => {
    const res = await unsubscribePOST(
      makeRequest({
        walletAddress: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
        channel: "sms",
      }),
    );
    expect(res.status).toBe(401);
  });
});

// ─── Unsubscribe route – token path ──────────────────────────────────────────

describe("POST /api/notifications/unsubscribe – token path", () => {
  const WALLET = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

  beforeEach(() => _clearStoreForTests());

  it("succeeds with a valid token and matching channel (200)", async () => {
    saveToken("valid-token-1", WALLET, "email");
    const res = await unsubscribePOST(
      makeRequest({ token: "valid-token-1", channel: "email" }),
    );
    expect(res.status).toBe(200);
    const body = await json(res) as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.walletAddress).toBe(WALLET);
    expect(body.channel).toBe("email");
  });

  it("token is single-use: replaying the same token returns 401", async () => {
    saveToken("single-use-token", WALLET, "email");
    const first = await unsubscribePOST(
      makeRequest({ token: "single-use-token", channel: "email" }),
    );
    expect(first.status).toBe(200);

    const second = await unsubscribePOST(
      makeRequest({ token: "single-use-token", channel: "email" }),
    );
    expect(second.status).toBe(401);
    const body = await json(second) as Record<string, unknown>;
    expect(typeof body.error).toBe("string");
  });

  it("token is channel-scoped: using it with the wrong channel returns 401", async () => {
    saveToken("channel-scoped-token", WALLET, "email");
    const res = await unsubscribePOST(
      makeRequest({ token: "channel-scoped-token", channel: "sms" }),
    );
    expect(res.status).toBe(401);
  });

  it("correct channel after wrong-channel attempt also fails (token consumed)", async () => {
    saveToken("already-consumed", WALLET, "push");
    // First attempt: wrong channel – token gets deleted
    await unsubscribePOST(
      makeRequest({ token: "already-consumed", channel: "email" }),
    );
    // Second attempt: correct channel – token is gone
    const res = await unsubscribePOST(
      makeRequest({ token: "already-consumed", channel: "push" }),
    );
    expect(res.status).toBe(401);
  });

  it("unknown token returns 401", async () => {
    const res = await unsubscribePOST(
      makeRequest({ token: "does-not-exist", channel: "email" }),
    );
    expect(res.status).toBe(401);
  });

  it("expired token returns 401", async () => {
    saveToken("expired-token", WALLET, "email");
    // Force expiry
    const entry = (peekToken as (t: string) => { expiresAt: number } | undefined)("expired-token")!;
    Object.defineProperty(entry, "expiresAt", {
      value: Date.now() - 1,
      writable: true,
    });
    const res = await unsubscribePOST(
      makeRequest({ token: "expired-token", channel: "email" }),
    );
    expect(res.status).toBe(401);
  });

  it("missing channel returns 400", async () => {
    saveToken("no-channel-token", WALLET, "email");
    const res = await unsubscribePOST(
      makeRequest({ token: "no-channel-token" }),
    );
    expect(res.status).toBe(400);
  });

  it("invalid channel value returns 400", async () => {
    saveToken("bad-channel-token", WALLET, "email");
    const res = await unsubscribePOST(
      makeRequest({ token: "bad-channel-token", channel: "telegram" }),
    );
    expect(res.status).toBe(400);
  });

  it("empty token string returns 400", async () => {
    const res = await unsubscribePOST(
      makeRequest({ token: "   ", channel: "email" }),
    );
    expect(res.status).toBe(400);
  });
});

// ─── Unsubscribe route – proof-of-address path ───────────────────────────────

describe("POST /api/notifications/unsubscribe – proof-of-address path", () => {
  beforeEach(() => _clearStoreForTests());

  it("succeeds with a valid signature (200)", async () => {
    const poa = buildProofOfAddress("email");
    const res = await unsubscribePOST(makeRequest(poa));
    expect(res.status).toBe(200);
    const body = await json(res) as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.walletAddress).toBe(poa.walletAddress);
    expect(body.channel).toBe("email");
  });

  it("rejects a tampered signature (401)", async () => {
    const poa = buildProofOfAddress("sms");
    // Corrupt the signature
    const badSig = Buffer.from("bad-sig").toString("base64");
    const res = await unsubscribePOST(
      makeRequest({ ...poa, signature: badSig }),
    );
    expect(res.status).toBe(401);
    const body = await json(res) as Record<string, unknown>;
    expect((body.error as string).toLowerCase()).toContain("signature");
  });

  it("rejects a replayed nonce (401)", async () => {
    const nonce = "replay-nonce-xyz";
    const poa = buildProofOfAddress("push", nonce);
    const first = await unsubscribePOST(makeRequest(poa));
    expect(first.status).toBe(200);

    // Replay: same wallet + same nonce (re-sign to get a valid sig)
    const poa2 = buildProofOfAddress("push", nonce);
    // Re-use the first wallet's nonce but with a fresh wallet; what matters is
    // the nonce is the same string – the server tracks nonces globally
    const second = await unsubscribePOST(makeRequest({ ...poa, ...{ nonce } }));
    expect(second.status).toBe(401);
    const body = await json(second) as Record<string, unknown>;
    expect((body.error as string).toLowerCase()).toContain("nonce");
    // suppress unused variable warning
    void poa2;
  });

  it("rejects an invalid Stellar address format (400)", async () => {
    const poa = buildProofOfAddress("email");
    const res = await unsubscribePOST(
      makeRequest({ ...poa, walletAddress: "not-a-stellar-address" }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects missing nonce (400)", async () => {
    const { walletAddress, signature, channel } = buildProofOfAddress("email");
    const res = await unsubscribePOST(
      makeRequest({ walletAddress, signature, channel }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid nonce characters (400)", async () => {
    const poa = buildProofOfAddress("email");
    const res = await unsubscribePOST(
      makeRequest({ ...poa, nonce: "bad nonce with spaces!" }),
    );
    expect(res.status).toBe(400);
  });
});

// ─── Unsubscribe route – general input validation ─────────────────────────────

describe("POST /api/notifications/unsubscribe – input validation", () => {
  beforeEach(() => _clearStoreForTests());

  it("returns 400 for a non-JSON body", async () => {
    const req = new NextRequest(
      "http://localhost/api/notifications/unsubscribe",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not json {{",
      },
    );
    const res = await unsubscribePOST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for an empty body (no token, no wallet)", async () => {
    const res = await unsubscribePOST(makeRequest({}));
    expect(res.status).toBe(400);
  });
});
