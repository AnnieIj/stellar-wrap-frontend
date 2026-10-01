/**
 * Tests for /api/wrapped error handling with structured HorizonError.
 * Verifies 404, 429, 500, and timeout responses are mapped correctly.
 */

import { HorizonError } from "@/app/services/indexerCore";

jest.mock("@/app/services/indexerServer", () => ({
  indexAccount: jest.fn(),
}));

jest.mock("@/app/utils/indexer", () => ({
  PERIODS: { monthly: 30, weekly: 7, yearly: 365 },
  NEXT_PUBLIC_RPC_ENDPOINTS: {
    mainnet: "https://horizon.stellar.org",
    testnet: "https://horizon-testnet.stellar.org",
  },
  normalizePeriod: (raw: string | null | undefined) =>
    raw ? (raw.toLowerCase() as "weekly" | "monthly" | "yearly") : "monthly",
}));


import { GET } from "../route";
import { indexAccount } from "@/app/services/indexerServer";

const mockIndexAccount = indexAccount as jest.MockedFunction<typeof indexAccount>;

function makeRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/wrapped");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return { nextUrl: { searchParams: url.searchParams } } as Parameters<typeof GET>[0];
}

const VALID_ACCOUNT = "GDRZZGQDRBLJBAY24O3EMZFDGZ4EY6A7L24OERKQTPLT4T7SZKLUAZVQ";


describe("/api/wrapped error handling", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 404 when HorizonError not_found is thrown", async () => {
    mockIndexAccount.mockRejectedValue(
      new HorizonError("Account not found (404).", 404, "not_found"),
    );
    const res = await GET(makeRequest({ accountId: VALID_ACCOUNT }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 429 when HorizonError rate_limited is thrown", async () => {
    mockIndexAccount.mockRejectedValue(
      new HorizonError("Rate limit exceeded (429).", 429, "rate_limited"),
    );
    const res = await GET(makeRequest({ accountId: VALID_ACCOUNT }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/rate limit/i);
  });

  it("returns 500 when HorizonError server_error is thrown", async () => {
    mockIndexAccount.mockRejectedValue(
      new HorizonError("Server error (500).", 500, "server_error"),
    );
    const res = await GET(makeRequest({ accountId: VALID_ACCOUNT }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/server error/i);
  });

  it("returns 408 when HorizonError timeout is thrown", async () => {
    mockIndexAccount.mockRejectedValue(
      new HorizonError("Network timeout.", 408, "timeout"),
    );
    const res = await GET(makeRequest({ accountId: VALID_ACCOUNT }));
    expect(res.status).toBe(408);
    const body = await res.json();
    expect(body.error).toMatch(/timed out/i);
  });

  it("returns 500 for generic (non-Horizon) errors", async () => {
    mockIndexAccount.mockRejectedValue(new Error("Unexpected failure"));
    const res = await GET(makeRequest({ accountId: VALID_ACCOUNT }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.details).toMatch(/Unexpected failure/);
  });

  it("returns 400 for missing accountId", async () => {
    const res = await GET(makeRequest({}));
    expect(res.status).toBe(400);
  });
});
