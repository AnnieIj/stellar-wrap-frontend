/**
 * `/api/wrapped` caching contract (issue #623).
 *
 * `openapi.yaml` declares `cached`, `cacheTimestamp` and
 * `refreshingInBackground` as *required* properties of `WrappedResponse`, but
 * nothing verified them, and the response dropped two of the three keys
 * whenever the indexer left them undefined.
 *
 * These tests pin the documented shape and each documented cache state:
 *   - cold fetch            -> cached: false, cacheTimestamp: null
 *   - warm fetch in window  -> cached: true, cacheTimestamp set
 *   - background re-index   -> refreshingInBackground: true
 *
 * The API itself is stateless (see `indexerServer.ts`), so the states are
 * exercised by driving `indexAccount`, which is what the route reports on.
 */

import { NextRequest } from "next/server";
import { GET } from "../route";
import { indexAccount } from "@/app/services/indexerServer";
import { CACHE_TTL_MINUTES } from "@/app/utils/indexer";

jest.mock("@/app/services/indexerServer", () => ({
  indexAccount: jest.fn(),
}));

const mockIndexAccount = indexAccount as jest.MockedFunction<typeof indexAccount>;

const ACCOUNT = "GDRZZGQDRBLJBAY24O3EMZFDGZ4EY6A7L24OERKQTPLT4T7SZKLUAZVQ";

function request(period = "monthly"): NextRequest {
  return new NextRequest(
    new URL(
      `/api/wrapped?accountId=${ACCOUNT}&period=${period}`,
      "http://localhost:3000",
    ),
  );
}

const RESULT = { accountId: ACCOUNT, totalTransactions: 142 };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("documented cache flags are always present", () => {
  it("emits all three required fields when the indexer omits them", async () => {
    // The stateless server path returns only `fromCache`, so the optional
    // fields arrive undefined. They must still appear in the JSON.
    mockIndexAccount.mockResolvedValue({
      result: RESULT as never,
      fromCache: false,
    });

    const res = await GET(request());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Object.keys(body)).toEqual(
      expect.arrayContaining([
        "cached",
        "cacheTimestamp",
        "refreshingInBackground",
      ]),
    );
    expect(body.cached).toBe(false);
    expect(body.cacheTimestamp).toBeNull();
    expect(body.refreshingInBackground).toBe(false);
  });

  it("serves a cold fetch as uncached with a null timestamp", async () => {
    mockIndexAccount.mockResolvedValue({
      result: RESULT as never,
      fromCache: false,
      cacheTimestamp: undefined,
      refreshingInBackground: undefined,
    });

    const body = await (await GET(request())).json();

    expect(body.cached).toBe(false);
    expect(body.cacheTimestamp).toBeNull();
    expect(body.refreshingInBackground).toBe(false);
  });
});

describe("warm fetch inside the 60-minute window", () => {
  it("reports cached: true with the cache entry's timestamp", async () => {
    const cachedAt = Date.parse("2026-09-25T10:00:00.000Z");
    mockIndexAccount.mockResolvedValue({
      result: RESULT as never,
      fromCache: true,
      cacheTimestamp: cachedAt,
      refreshingInBackground: false,
    });

    const body = await (await GET(request())).json();

    expect(body.cached).toBe(true);
    // Documented as an ISO-8601 date-time, not an epoch millisecond count.
    expect(body.cacheTimestamp).toBe("2026-09-25T10:00:00.000Z");
    expect(Date.parse(body.cacheTimestamp)).toBe(cachedAt);
    expect(body.refreshingInBackground).toBe(false);
  });

  it("reports a background re-index via refreshingInBackground", async () => {
    mockIndexAccount.mockResolvedValue({
      result: RESULT as never,
      fromCache: true,
      cacheTimestamp: Date.now() - CACHE_TTL_MINUTES * 60 * 1000 - 1,
      refreshingInBackground: true,
    });

    const body = await (await GET(request())).json();

    expect(body.cached).toBe(true);
    expect(body.refreshingInBackground).toBe(true);
    expect(body.cacheTimestamp).toEqual(expect.any(String));
  });

  it("keeps the flags coherent for every period", async () => {
    for (const period of ["weekly", "monthly", "yearly"]) {
      jest.clearAllMocks();
      mockIndexAccount.mockResolvedValue({
        result: RESULT as never,
        fromCache: true,
        cacheTimestamp: Date.now(),
        refreshingInBackground: false,
      });

      const body = await (await GET(request(period))).json();

      expect(mockIndexAccount).toHaveBeenCalledWith(ACCOUNT, "mainnet", period);
      expect(body.cached).toBe(true);
      expect(body.refreshingInBackground).toBe(false);
    }
  });
});

describe("background refresh racing a concurrent request for the same account", () => {
  it("answers both requests from cache while the re-index is still running", async () => {
    const cachedAt = Date.now() - CACHE_TTL_MINUTES * 60 * 1000 - 1;

    // The first caller triggers the re-index and gets stale data back
    // immediately; the second caller arrives while that is still in flight.
    mockIndexAccount.mockResolvedValueOnce({
      result: RESULT as never,
      fromCache: true,
      cacheTimestamp: cachedAt,
      refreshingInBackground: true,
    });
    mockIndexAccount.mockResolvedValueOnce({
      result: RESULT as never,
      fromCache: true,
      cacheTimestamp: cachedAt,
      refreshingInBackground: true,
    });

    const [first, second] = await Promise.all([GET(request()), GET(request())]);

    const [firstBody, secondBody] = await Promise.all([
      first.json(),
      second.json(),
    ]);

    // Neither caller is made to wait on the refresh, and neither is told the
    // payload is fresh: the documented flag says a refresh is in progress.
    expect(firstBody.cached).toBe(true);
    expect(secondBody.cached).toBe(true);
    expect(firstBody.refreshingInBackground).toBe(true);
    expect(secondBody.refreshingInBackground).toBe(true);
    expect(firstBody.cacheTimestamp).toBe(
      new Date(cachedAt).toISOString(),
    );
    expect(secondBody.cacheTimestamp).toBe(
      new Date(cachedAt).toISOString(),
    );
    expect(mockIndexAccount).toHaveBeenCalledTimes(2);
  });

  it("surfaces a fresh payload once the re-index has completed", async () => {
    const refreshedAt = Date.now();
    mockIndexAccount.mockResolvedValue({
      result: { ...RESULT, totalTransactions: 150 } as never,
      fromCache: true,
      cacheTimestamp: refreshedAt,
      refreshingInBackground: false,
    });

    const body = await (await GET(request())).json();

    expect(body.totalTransactions).toBe(150);
    expect(body.refreshingInBackground).toBe(false);
    expect(body.cacheTimestamp).toBe(new Date(refreshedAt).toISOString());
  });
});
