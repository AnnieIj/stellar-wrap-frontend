import { NextRequest } from "next/server";
import { GET } from "../route";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitConfig,
} from "@/app/api/_lib/rateLimit";
import { kvReset } from "@/app/api/_lib/kv";

// Mock the indexer to isolate route and rate limiting logic
jest.mock("@/app/services/indexerServer", () => ({
  indexAccount: jest.fn().mockResolvedValue({
    result: { success: true, totalTransactions: 42 },
    fromCache: false,
    cacheTimestamp: Date.now(),
    refreshingInBackground: false,
  }),
}));

const VALID_ACCOUNT_1 = "GDRZZGQDRBLJBAY24O3EMZFDGZ4EY6A7L24OERKQTPLT4T7SZKLUAZVQ";
const VALID_ACCOUNT_2 = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";


function createRequest(
  urlPath: string,
  headers: Record<string, string> = {},
): NextRequest {
  const url = new URL(urlPath, "http://localhost:3000");
  const reqHeaders = new Headers(headers);
  return new NextRequest(url, { headers: reqHeaders });
}

describe("Server-Side Rate Limiting for /api/wrapped", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    kvReset();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("checkRateLimit helper unit tests", () => {
    it("allows requests under the limit", async () => {
      const config = { windowSeconds: 60, maxRequests: 3 };
      const now = 1000000;

      const res1 = await checkRateLimit("test-key", config, now);
      expect(res1.allowed).toBe(true);
      expect(res1.remaining).toBe(2);
      expect(res1.retryAfterSeconds).toBe(0);

      const res2 = await checkRateLimit("test-key", config, now + 1000);
      expect(res2.allowed).toBe(true);
      expect(res2.remaining).toBe(1);
    });

    it("allows request at the exact limit", async () => {
      const config = { windowSeconds: 60, maxRequests: 2 };
      const now = 1000000;

      await checkRateLimit("test-at-limit", config, now);
      const res = await checkRateLimit("test-at-limit", config, now + 500);

      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(0);
      expect(res.retryAfterSeconds).toBe(0);
    });

    it("rejects requests exceeding the limit with accurate retryAfterSeconds", async () => {
      const config = { windowSeconds: 60, maxRequests: 2 };
      const now = 1000000;

      await checkRateLimit("test-over-limit", config, now); // t0
      await checkRateLimit("test-over-limit", config, now + 10000); // t0 + 10s

      // 3rd request at t0 + 20s (exceeds maxRequests = 2)
      const res = await checkRateLimit("test-over-limit", config, now + 20000);

      expect(res.allowed).toBe(false);
      expect(res.remaining).toBe(0);
      // Oldest request was at `now`. Window is 60s. Reset is at `now + 60000`.
      // At `now + 20000`, retryAfter = (60000 - 20000) / 1000 = 40s.
      expect(res.retryAfterSeconds).toBe(40);
    });

    it("resets capacity after sliding window passes", async () => {
      const config = { windowSeconds: 60, maxRequests: 1 };
      const now = 1000000;

      const res1 = await checkRateLimit("test-window-reset", config, now);
      expect(res1.allowed).toBe(true);

      const res2 = await checkRateLimit("test-window-reset", config, now + 10000);
      expect(res2.allowed).toBe(false);

      // Window expired after 60s
      const res3 = await checkRateLimit(
        "test-window-reset",
        config,
        now + 61000,
      );
      expect(res3.allowed).toBe(true);
      expect(res3.remaining).toBe(0);
    });
  });

  describe("getClientIp extraction", () => {
    it("extracts first IP from x-forwarded-for header", () => {
      const req = createRequest("/api/wrapped", {
        "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178",
      });
      expect(getClientIp(req)).toBe("203.0.113.195");
    });

    it("extracts IP from x-real-ip header when x-forwarded-for is missing", () => {
      const req = createRequest("/api/wrapped", {
        "x-real-ip": "198.51.100.42",
      });
      expect(getClientIp(req)).toBe("198.51.100.42");
    });

    it("extracts IP from cf-connecting-ip header when others missing", () => {
      const req = createRequest("/api/wrapped", {
        "cf-connecting-ip": "192.0.2.1",
      });
      expect(getClientIp(req)).toBe("192.0.2.1");
    });

    it("falls back to 127.0.0.1 when no IP headers exist", () => {
      const req = createRequest("/api/wrapped");
      expect(getClientIp(req)).toBe("127.0.0.1");
    });
  });

  describe("getRateLimitConfig environment variables", () => {
    it("uses default values when env vars are unset", () => {
      delete process.env.RATE_LIMIT_WINDOW_SECONDS;
      delete process.env.RATE_LIMIT_IP_MAX;
      delete process.env.RATE_LIMIT_ACCOUNT_MAX;

      const config = getRateLimitConfig();
      expect(config.windowSeconds).toBe(60);
      expect(config.ipMax).toBe(30);
      expect(config.accountMax).toBe(10);
    });

    it("parses valid custom env vars", () => {
      process.env.RATE_LIMIT_WINDOW_SECONDS = "120";
      process.env.RATE_LIMIT_IP_MAX = "50";
      process.env.RATE_LIMIT_ACCOUNT_MAX = "5";

      const config = getRateLimitConfig();
      expect(config.windowSeconds).toBe(120);
      expect(config.ipMax).toBe(50);
      expect(config.accountMax).toBe(5);
    });

    it("falls back to defaults for invalid non-numeric env vars", () => {
      process.env.RATE_LIMIT_WINDOW_SECONDS = "-10";
      process.env.RATE_LIMIT_IP_MAX = "invalid";
      process.env.RATE_LIMIT_ACCOUNT_MAX = "0";

      const config = getRateLimitConfig();
      expect(config.windowSeconds).toBe(60);
      expect(config.ipMax).toBe(30);
      expect(config.accountMax).toBe(10);
    });
  });

  describe("Route Integration: Per-IP Rate Limiting", () => {
    it("allows requests under the IP limit and returns 200", async () => {
      process.env.RATE_LIMIT_IP_MAX = "3";
      process.env.RATE_LIMIT_ACCOUNT_MAX = "10";

      const req1 = createRequest(
        `/api/wrapped?accountId=${VALID_ACCOUNT_1}`,
        { "x-forwarded-for": "10.0.0.1" },
      );
      const res1 = await GET(req1);
      expect(res1.status).toBe(200);

      const req2 = createRequest(
        `/api/wrapped?accountId=${VALID_ACCOUNT_2}`,
        { "x-forwarded-for": "10.0.0.1" },
      );
      const res2 = await GET(req2);
      expect(res2.status).toBe(200);
    });

    it("allows requests at the exact IP limit and rejects over-limit with 429", async () => {
      process.env.RATE_LIMIT_IP_MAX = "2";
      process.env.RATE_LIMIT_ACCOUNT_MAX = "10";

      const req1 = createRequest(
        `/api/wrapped?accountId=${VALID_ACCOUNT_1}`,
        { "x-forwarded-for": "10.0.0.2" },
      );
      const res1 = await GET(req1);
      expect(res1.status).toBe(200);

      const req2 = createRequest(
        `/api/wrapped?accountId=${VALID_ACCOUNT_2}`,
        { "x-forwarded-for": "10.0.0.2" },
      );
      const res2 = await GET(req2);
      expect(res2.status).toBe(200);

      // 3rd request from same IP exceeds limit of 2
      const req3 = createRequest(
        `/api/wrapped?accountId=${VALID_ACCOUNT_1}`,
        { "x-forwarded-for": "10.0.0.2" },
      );
      const res3 = await GET(req3);
      expect(res3.status).toBe(429);

      // Verify Retry-After header and structured error response
      expect(res3.headers.get("Retry-After")).toBeDefined();
      expect(Number(res3.headers.get("Retry-After"))).toBeGreaterThan(0);
      expect(res3.headers.get("X-RateLimit-Limit")).toBe("2");
      expect(res3.headers.get("X-RateLimit-Remaining")).toBe("0");

      const body = await res3.json();
      expect(body.code).toBe("RATE_LIMITED");
      expect(body.error).toContain("IP rate limit exceeded");
      expect(body.retryAfter).toBeGreaterThan(0);
    });
  });

  describe("Route Integration: Per-Account Rate Limiting", () => {
    it("rejects over-limit requests targeting the same account across different IPs", async () => {
      process.env.RATE_LIMIT_IP_MAX = "10";
      process.env.RATE_LIMIT_ACCOUNT_MAX = "2";

      // Request 1: IP A -> Account 1
      const req1 = createRequest(
        `/api/wrapped?accountId=${VALID_ACCOUNT_1}`,
        { "x-forwarded-for": "192.168.1.1" },
      );
      const res1 = await GET(req1);
      expect(res1.status).toBe(200);

      // Request 2: IP B -> Account 1
      const req2 = createRequest(
        `/api/wrapped?accountId=${VALID_ACCOUNT_1}`,
        { "x-forwarded-for": "192.168.1.2" },
      );
      const res2 = await GET(req2);
      expect(res2.status).toBe(200);

      // Request 3: IP C -> Account 1 (Account 1 limit of 2 exceeded)
      const req3 = createRequest(
        `/api/wrapped?accountId=${VALID_ACCOUNT_1}`,
        { "x-forwarded-for": "192.168.1.3" },
      );
      const res3 = await GET(req3);
      expect(res3.status).toBe(429);

      expect(res3.headers.get("Retry-After")).toBeDefined();
      expect(Number(res3.headers.get("Retry-After"))).toBeGreaterThan(0);
      expect(res3.headers.get("X-RateLimit-Limit")).toBe("2");

      const body = await res3.json();
      expect(body.code).toBe("RATE_LIMITED");
      expect(body.error).toContain("Account rate limit exceeded");
      expect(body.retryAfter).toBeGreaterThan(0);

      // A different account from IP C should still succeed if under IP and account limit
      const reqOther = createRequest(
        `/api/wrapped?accountId=${VALID_ACCOUNT_2}`,
        { "x-forwarded-for": "192.168.1.3" },
      );
      const resOther = await GET(reqOther);
      expect(resOther.status).toBe(200);
    });
  });
});
