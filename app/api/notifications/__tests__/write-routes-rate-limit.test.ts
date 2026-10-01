/**
 * Rate limiting coverage for every public write route (issue #617).
 *
 * `subscribe` and `subscribe-email` already had limits; `preferences`,
 * `unsubscribe` and `confirm-email` did not, so they were reachable without a
 * throttle. This file covers each route's per-IP and per-target limit, plus the
 * fail-closed behaviour of the limiter itself when KV is unreachable.
 *
 * `confirm-email` is a GET but it activates a pending subscription, so it is
 * treated as a write and throttled the same way as the others.
 */

import { NextRequest } from "next/server";

jest.mock("../_lib/email", () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));

// Wrap KV so individual tests can simulate an outage while everything else
// still runs against the real in-process store.
jest.mock("../_lib/kv", () => {
  const actual = jest.requireActual("../_lib/kv");
  return {
    ...actual,
    kvGet: jest.fn(actual.kvGet),
    kvSet: jest.fn(actual.kvSet),
  };
});

import { PUT as preferencesPUT } from "../preferences/[wallet]/route";
import { POST as unsubscribePOST } from "../unsubscribe/route";
import { GET as confirmEmailGET } from "../confirm-email/route";
import { POST as subscribePOST } from "../subscribe/route";
import { POST as subscribeEmailPOST } from "../subscribe-email/route";
import { kvGet, kvSet, kvReset, SUB_KEY } from "../_lib/kv";
import {
  PREFERENCES_IP_LIMIT,
  PREFERENCES_WALLET_LIMIT,
  UNSUBSCRIBE_IP_LIMIT,
  UNSUBSCRIBE_TARGET_LIMIT,
  CONFIRM_EMAIL_IP_LIMIT,
  CONFIRM_EMAIL_TOKEN_LIMIT,
} from "../_lib/rateLimit";
import type { SubscriptionRecord } from "@/app/types/notifications";

const actualKv = jest.requireActual("../_lib/kv");

const WALLET = "GDRZZGQDRBLJBAY24O3EMZFDGZ4EY6A7L24OERKQTPLT4T7SZKLUAZVQ";
const TOKEN = "confirm-token-abc";

function jsonRequest(
  url: string,
  init: { method?: string; body?: unknown; ip?: string } = {},
): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.ip) headers["x-forwarded-for"] = init.ip;

  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: init.method ?? "GET",
    headers,
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

const walletParams = { params: Promise.resolve({ wallet: WALLET }) };

/** Seeds a confirmed-on-request subscription used by the PUT/DELETE tests. */
async function seedSubscription(): Promise<void> {
  const record: SubscriptionRecord = {
    walletAddress: WALLET,
    consentGiven: true,
    consentTimestamp: new Date().toISOString(),
    email: {
      address: "owner@example.com",
      status: "pending",
      confirmationToken: TOKEN,
      unsubscribeToken: "unsub-token",
      periods: { weekly: true, monthly: false, yearly: false },
      createdAt: new Date().toISOString(),
    },
  };
  await kvSet(SUB_KEY(WALLET), record);
}

beforeEach(() => {
  kvReset();
  (kvGet as jest.Mock).mockImplementation(actualKv.kvGet);
  (kvSet as jest.Mock).mockImplementation(actualKv.kvSet);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("PUT /api/notifications/preferences/:wallet", () => {
  it("throttles per IP", async () => {
    await seedSubscription();
    const ip = "203.0.113.5";

    for (let i = 0; i < PREFERENCES_IP_LIMIT; i++) {
      const res = await preferencesPUT(
        jsonRequest(`/api/notifications/preferences/${WALLET}`, {
          method: "PUT",
          body: { consentGiven: true },
          ip,
        }),
        walletParams,
      );
      expect(res.status).toBe(200);
    }

    const blocked = await preferencesPUT(
      jsonRequest(`/api/notifications/preferences/${WALLET}`, {
        method: "PUT",
        body: { consentGiven: true },
        ip,
      }),
      walletParams,
    );

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
  });

  it("throttles per target wallet across many IPs", async () => {
    await seedSubscription();

    for (let i = 0; i < PREFERENCES_WALLET_LIMIT; i++) {
      const res = await preferencesPUT(
        jsonRequest(`/api/notifications/preferences/${WALLET}`, {
          method: "PUT",
          body: { consentGiven: true },
          ip: `198.51.100.${i + 1}`,
        }),
        walletParams,
      );
      expect(res.status).toBe(200);
    }

    const blocked = await preferencesPUT(
      jsonRequest(`/api/notifications/preferences/${WALLET}`, {
        method: "PUT",
        body: { consentGiven: true },
        ip: "198.51.100.200",
      }),
      walletParams,
    );

    expect(blocked.status).toBe(429);
  });
});

describe("POST /api/notifications/unsubscribe", () => {
  it("throttles per IP", async () => {
    await seedSubscription();
    const ip = "203.0.113.9";

    for (let i = 0; i < UNSUBSCRIBE_IP_LIMIT; i++) {
      const res = await unsubscribePOST(
        jsonRequest("/api/notifications/unsubscribe", {
          method: "POST",
          body: { walletAddress: WALLET, channel: "email" },
          ip,
        }),
      );
      expect(res.status).toBe(200);
    }

    const blocked = await unsubscribePOST(
      jsonRequest("/api/notifications/unsubscribe", {
        method: "POST",
        body: { walletAddress: WALLET, channel: "email" },
        ip,
      }),
    );

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
  });

  it("throttles per target across many IPs", async () => {
    for (let i = 0; i < UNSUBSCRIBE_TARGET_LIMIT; i++) {
      await seedSubscription();
      const res = await unsubscribePOST(
        jsonRequest("/api/notifications/unsubscribe", {
          method: "POST",
          body: { walletAddress: WALLET, channel: "email" },
          ip: `198.51.100.${i + 11}`,
        }),
      );
      expect(res.status).toBe(200);
    }

    await seedSubscription();
    const blocked = await unsubscribePOST(
      jsonRequest("/api/notifications/unsubscribe", {
        method: "POST",
        body: { walletAddress: WALLET, channel: "email" },
        ip: "198.51.100.222",
      }),
    );

    expect(blocked.status).toBe(429);
  });
});

describe("GET /api/notifications/confirm-email", () => {
  const confirmUrl = `/api/notifications/confirm-email?token=${TOKEN}&wallet=${WALLET}`;

  it("throttles per IP", async () => {
    const ip = "203.0.113.77";

    for (let i = 0; i < CONFIRM_EMAIL_IP_LIMIT; i++) {
      await seedSubscription();
      const res = await confirmEmailGET(jsonRequest(confirmUrl, { ip }));
      // A successful confirmation redirects; it must never be throttled here.
      expect(res.status).not.toBe(429);
    }

    const blocked = await confirmEmailGET(jsonRequest(confirmUrl, { ip }));

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
  });

  it("throttles per confirmation token across many IPs", async () => {
    for (let i = 0; i < CONFIRM_EMAIL_TOKEN_LIMIT; i++) {
      await seedSubscription();
      const res = await confirmEmailGET(
        jsonRequest(confirmUrl, { ip: `198.51.100.${i + 31}` }),
      );
      expect(res.status).not.toBe(429);
    }

    await seedSubscription();
    const blocked = await confirmEmailGET(
      jsonRequest(confirmUrl, { ip: "198.51.100.240" }),
    );

    expect(blocked.status).toBe(429);
  });
});

describe("rate limiter fails closed when KV is unavailable", () => {
  const outage = () => new Error("KV unreachable");

  // Each entry is a public write route with a request that would otherwise
  // reach KV. With the backend down every one of them must be refused, so an
  // unreachable limiter can never be used to bypass throttling.
  const routes: Array<[string, () => Promise<Response>]> = [
    [
      "preferences",
      () =>
        preferencesPUT(
          jsonRequest(`/api/notifications/preferences/${WALLET}`, {
            method: "PUT",
            body: { consentGiven: true },
            ip: "203.0.113.30",
          }),
          walletParams,
        ),
    ],
    [
      "unsubscribe",
      () =>
        unsubscribePOST(
          jsonRequest("/api/notifications/unsubscribe", {
            method: "POST",
            body: { walletAddress: WALLET, channel: "email" },
            ip: "203.0.113.31",
          }),
        ),
    ],
    [
      "confirm-email",
      () =>
        confirmEmailGET(
          jsonRequest(`/api/notifications/confirm-email?token=${TOKEN}&wallet=${WALLET}`, {
            ip: "203.0.113.32",
          }),
        ),
    ],
    [
      "subscribe",
      () =>
        subscribePOST(
          jsonRequest("/api/notifications/subscribe", {
            method: "POST",
            body: {
              walletAddress: WALLET,
              subscription: { endpoint: "https://push.example.com/sub/1" },
              periods: { weekly: true, monthly: false, yearly: false },
            },
            ip: "203.0.113.33",
          }),
        ),
    ],
    [
      "subscribe-email",
      () =>
        subscribeEmailPOST(
          jsonRequest("/api/notifications/subscribe-email", {
            method: "POST",
            body: {
              walletAddress: WALLET,
              email: "owner@example.com",
              periods: { weekly: true, monthly: false, yearly: false },
            },
            ip: "203.0.113.34",
          }),
        ),
    ],
  ];

  it.each(routes)("refuses %s with 503 instead of allowing it", async (_name, call) => {
    kvReset();
    (kvGet as jest.Mock).mockRejectedValue(outage());

    const res = await call();

    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: "RATE_LIMIT_UNAVAILABLE" });
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("denies rather than throwing when the limiter write fails", async () => {
    kvReset();
    (kvSet as jest.Mock).mockRejectedValue(outage());

    const res = await preferencesPUT(
      jsonRequest(`/api/notifications/preferences/${WALLET}`, {
        method: "PUT",
        body: { consentGiven: true },
        ip: "203.0.113.35",
      }),
      walletParams,
    );

    expect(res.status).toBe(503);
  });
});
