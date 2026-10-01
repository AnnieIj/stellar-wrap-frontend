import { NextRequest } from "next/server";
import { POST as subscribePOST } from "../subscribe/route";
import { POST as subscribeEmailPOST } from "../subscribe-email/route";
import { kvKeys, kvGet, kvSet } from "../_lib/kv";
import {
  SUBSCRIBE_IP_LIMIT,
  SUBSCRIBE_EMAIL_IP_LIMIT,
  SUBSCRIBE_EMAIL_TARGET_LIMIT,
} from "../_lib/rateLimit";
import type { SubscriptionRecord } from "@/app/types/notifications";

jest.mock("../_lib/email", () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));

const VALID_WALLET_1 = "GDRZZGQDRBLJBAY24O3EMZFDGZ4EY6A7L24OERKQTPLT4T7SZKLUAZVQ";
const VALID_WALLET_2 = "GBDTABC1234567890123456789012345678901234567890123456789";

function createPostRequest(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("Notification Subscribe Rate Limiting & Idempotency", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    // Clear all KV store keys before each test
    const keys = await kvKeys("*");
    for (const key of keys) {
      // In localKv test environment, resetting store
      const { kvDel } = await import("../_lib/kv");
      await kvDel(key);
    }
  });

  describe("POST /api/notifications/subscribe", () => {
    it("enforces per-IP rate limit and returns 429 with Retry-After header", async () => {
      const clientIp = "192.168.1.10";
      const requestHeaders = { "x-forwarded-for": clientIp };

      const payload = {
        walletAddress: VALID_WALLET_1,
        subscription: { endpoint: "https://push.example.com/sub/1" },
        periods: { weekly: true, monthly: true, yearly: false },
      };

      // Requests up to SUBSCRIBE_IP_LIMIT should succeed
      for (let i = 0; i < SUBSCRIBE_IP_LIMIT; i++) {
        const req = createPostRequest(
          "/api/notifications/subscribe",
          payload,
          requestHeaders,
        );
        const res = await subscribePOST(req);
        expect(res.status).toBe(200);
      }

      // Limit + 1 request from same IP should be blocked with 429
      const blockedReq = createPostRequest(
        "/api/notifications/subscribe",
        payload,
        requestHeaders,
      );
      const blockedRes = await subscribePOST(blockedReq);

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.headers.get("Retry-After")).toBeTruthy();
      const body = await blockedRes.json();
      expect(body.error).toContain("Too many requests");

      // Request from a different IP should succeed
      const newIpReq = createPostRequest(
        "/api/notifications/subscribe",
        payload,
        { "x-forwarded-for": "192.168.1.11" },
      );
      const newIpRes = await subscribePOST(newIpReq);
      expect(newIpRes.status).toBe(200);
    });

    it("ensures repeated subscribes for an existing wallet are idempotent", async () => {
      const payload = {
        walletAddress: VALID_WALLET_1,
        subscription: { endpoint: "https://push.example.com/sub/1" },
        periods: { weekly: true, monthly: false, yearly: false },
      };

      // First subscribe
      const req1 = createPostRequest("/api/notifications/subscribe", payload, {
        "x-forwarded-for": "10.0.0.1",
      });
      const res1 = await subscribePOST(req1);
      expect(res1.status).toBe(200);

      // Second subscribe with updated periods
      const payload2 = {
        ...payload,
        periods: { weekly: true, monthly: true, yearly: true },
      };
      const req2 = createPostRequest("/api/notifications/subscribe", payload2, {
        "x-forwarded-for": "10.0.0.2",
      });
      const res2 = await subscribePOST(req2);
      expect(res2.status).toBe(200);

      // Check KV store keys - must have only 1 key for the wallet
      const subKeys = await kvKeys("notif:sub:*");
      expect(subKeys).toEqual([`notif:sub:${VALID_WALLET_1}`]);

      const record = await kvGet<SubscriptionRecord>(`notif:sub:${VALID_WALLET_1}`);
      expect(record).not.toBeNull();
      expect(record?.walletAddress).toBe(VALID_WALLET_1);
      expect(record?.push?.periods).toEqual({ weekly: true, monthly: true, yearly: true });
    });
  });

  describe("POST /api/notifications/subscribe-email", () => {
    it("enforces per-IP rate limit and returns 429 with Retry-After header", async () => {
      const clientIp = "192.168.2.20";
      const requestHeaders = { "x-forwarded-for": clientIp };

      // Make SUBSCRIBE_EMAIL_IP_LIMIT requests with distinct email addresses
      for (let i = 0; i < SUBSCRIBE_EMAIL_IP_LIMIT; i++) {
        const req = createPostRequest(
          "/api/notifications/subscribe-email",
          {
            walletAddress: VALID_WALLET_1,
            email: `user${i}@example.com`,
            periods: { weekly: true, monthly: false, yearly: false },
          },
          requestHeaders,
        );
        const res = await subscribeEmailPOST(req);
        expect(res.status).toBe(200);
      }

      // Next request from same IP should return 429
      const blockedReq = createPostRequest(
        "/api/notifications/subscribe-email",
        {
          walletAddress: VALID_WALLET_1,
          email: "user_blocked@example.com",
          periods: { weekly: true, monthly: false, yearly: false },
        },
        requestHeaders,
      );
      const blockedRes = await subscribeEmailPOST(blockedReq);

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.headers.get("Retry-After")).toBeTruthy();
    });

    it("enforces per-email-address rate limit across multiple IPs", async () => {
      const targetEmail = "victim@example.com";

      // Make requests up to SUBSCRIBE_EMAIL_TARGET_LIMIT from different IPs
      for (let i = 0; i < SUBSCRIBE_EMAIL_TARGET_LIMIT; i++) {
        const req = createPostRequest(
          "/api/notifications/subscribe-email",
          {
            walletAddress: i === 0 ? VALID_WALLET_1 : VALID_WALLET_2,
            email: targetEmail,
            periods: { weekly: true, monthly: false, yearly: false },
          },
          { "x-forwarded-for": `192.168.3.${10 + i}` },
        );
        const res = await subscribeEmailPOST(req);
        expect(res.status).toBe(200);
      }

      // Next request targeting the same email from a new IP should fail with 429
      const blockedReq = createPostRequest(
        "/api/notifications/subscribe-email",
        {
          walletAddress: VALID_WALLET_1,
          email: targetEmail,
          periods: { weekly: true, monthly: false, yearly: false },
        },
        { "x-forwarded-for": "192.168.3.99" },
      );
      const blockedRes = await subscribeEmailPOST(blockedReq);

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.headers.get("Retry-After")).toBeTruthy();
      const body = await blockedRes.json();
      expect(body.error).toContain("this email address");
    });

    it("ensures repeated email subscribes for an existing wallet are idempotent", async () => {
      const email = "idempotent@example.com";
      const payload = {
        walletAddress: VALID_WALLET_1,
        email,
        periods: { weekly: true, monthly: false, yearly: false },
      };

      // First subscribe
      const req1 = createPostRequest("/api/notifications/subscribe-email", payload, {
        "x-forwarded-for": "10.1.0.1",
      });
      const res1 = await subscribeEmailPOST(req1);
      expect(res1.status).toBe(200);
      const data1 = await res1.json();
      expect(data1.status).toBe("pending");

      // Simulate confirmation by setting email status to active in KV
      const record = await kvGet<SubscriptionRecord>(`notif:sub:${VALID_WALLET_1}`);
      if (record?.email) {
        record.email.status = "active";
        await kvSet(`notif:sub:${VALID_WALLET_1}`, record);
      }

      // Second subscribe for same wallet and email
      const req2 = createPostRequest(
        "/api/notifications/subscribe-email",
        {
          ...payload,
          periods: { weekly: true, monthly: true, yearly: true },
        },
        { "x-forwarded-for": "10.1.0.2" },
      );
      const res2 = await subscribeEmailPOST(req2);
      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.status).toBe("active");

      // Verify KV key count remains 1
      const subKeys = await kvKeys("notif:sub:*");
      expect(subKeys).toEqual([`notif:sub:${VALID_WALLET_1}`]);

      const updatedRecord = await kvGet<SubscriptionRecord>(`notif:sub:${VALID_WALLET_1}`);
      expect(updatedRecord?.email?.status).toBe("active");
      expect(updatedRecord?.email?.periods).toEqual({ weekly: true, monthly: true, yearly: true });
    });
  });
});
