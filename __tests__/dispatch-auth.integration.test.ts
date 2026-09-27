import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("next/server", () => {
  class MockNextResponse extends Response {
    static json(body: unknown, init?: ResponseInit) {
      return new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { "content-type": "application/json" },
      });
    }
  }

  class MockNextRequest extends Request {
    constructor(input: string | URL | Request, init?: RequestInit) {
      super(input, init);
    }
  }

  return { NextRequest: MockNextRequest, NextResponse: MockNextResponse };
});

vi.mock("@/app/api/notifications/_lib/kv", () => ({
  kvGet: vi.fn().mockResolvedValue(null),
  kvSet: vi.fn().mockResolvedValue(undefined),
  kvKeys: vi.fn().mockResolvedValue([]),
  SUB_KEY: (w: string) => `notif:sub:${w}`,
  LOG_KEY: (w: string, c: string, p: string, pk: string) =>
    `notif:log:${w}:${c}:${p}:${pk}`,
}));

vi.mock("@/app/api/notifications/_lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/app/utils/notifications/pushPayloadFormatter", () => ({
  formatPushPayload: vi.fn().mockReturnValue({ title: "", body: "", url: "" }),
}));

vi.mock("@/app/utils/notifications/emailTemplate", () => ({
  renderEmailTemplate: vi.fn().mockReturnValue("<html></html>"),
}));

vi.mock("@/app/utils/notifications/periodKey", () => ({
  getPeriodKey: vi.fn().mockReturnValue("2026-01"),
  getActivePeriodsForNow: vi.fn().mockReturnValue([]),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body?: Record<string, unknown>, authHeader?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (authHeader !== undefined) {
    headers["authorization"] = authHeader;
  }
  return new Request("http://localhost/api/notifications/dispatch", {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? { periods: ["monthly"] }),
  });
}

async function importRoute() {
  const mod = await import(
    "@/app/api/notifications/dispatch/route"
  );
  return mod.POST;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/notifications/dispatch auth", () => {
  const CORRECT_SECRET = "super-secret-cron-key-12345";

  beforeEach(() => {
    vi.resetModules();
    delete process.env.CRON_SECRET;
  });

  it("returns 500 when CRON_SECRET is not set", async () => {
    const POST = await importRoute();
    const res = await POST(makeRequest() as never);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Server misconfiguration");
  });

  it("returns 401 when the authorization header is missing", async () => {
    process.env.CRON_SECRET = CORRECT_SECRET;

    const POST = await importRoute();
    const res = await POST(makeRequest(undefined, undefined) as never);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when the authorization header is wrong", async () => {
    process.env.CRON_SECRET = CORRECT_SECRET;

    const POST = await importRoute();
    const res = await POST(makeRequest(undefined, "Bearer wrong-secret") as never);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("allows access with the correct Bearer token", async () => {
    process.env.CRON_SECRET = CORRECT_SECRET;

    const POST = await importRoute();
    const res = await POST(makeRequest(undefined, `Bearer ${CORRECT_SECRET}`) as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });
});
