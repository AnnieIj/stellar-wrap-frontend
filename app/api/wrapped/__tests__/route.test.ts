import { NextRequest } from "next/server";
import { GET } from "../route";

// Mock the indexer to isolate route logic
jest.mock("@/app/services/indexerServer", () => ({
  indexAccount: jest.fn().mockResolvedValue({
    result: { success: true },
    fromCache: false,
    cacheTimestamp: Date.now(),
    refreshingInBackground: false,
  }),
}));

describe("GET /api/wrapped route validation", () => {
  const createRequest = (url: string) => {
    return new NextRequest(new URL(url, "http://localhost:3000"));
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 when accountId is missing", async () => {
    const req = createRequest("/api/wrapped");
    const response = await GET(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Missing accountId parameter");
  });

  it("returns 400 for malformed account ID length", async () => {
    const req = createRequest("/api/wrapped?accountId=GSHORTID");
    const response = await GET(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Invalid address length");
  });

  it("returns 400 for valid length but invalid checksum", async () => {
    // String is 56 chars and starts with G but fails checksum
    const invalidChecksumId = "GBDTABC1234567890123456789012345678901234567890123456789";
    const req = createRequest(`/api/wrapped?accountId=${invalidChecksumId}`);
    const response = await GET(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("checksum validation failed");
  });

  it("returns 400 for invalid prefix", async () => {
    const invalidPrefixId = "XBDTABC1234567890123456789012345678901234567890123456789";
    const req = createRequest(`/api/wrapped?accountId=${invalidPrefixId}`);
    const response = await GET(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Stellar address must start with G");
  });

  describe("period query parameter normalization", () => {
    // Use a properly formatted valid Stellar test address
    const validAccountId = "GDRZZGQDRBLJBAY24O3EMZFDGZ4EY6A7L24OERKQTPLT4T7SZKLUAZVQ";

    it("defaults to monthly when period is missing", async () => {
      const req = createRequest(`/api/wrapped?accountId=${validAccountId}`);
      const response = await GET(req);
      expect(response.status).toBe(200);
    });

    it("accepts lowercase period values", async () => {
      const req = createRequest(
        `/api/wrapped?accountId=${validAccountId}&period=weekly`,
      );
      const response = await GET(req);
      expect(response.status).toBe(200);
    });

    it("normalizes uppercase period to lowercase", async () => {
      const req = createRequest(
        `/api/wrapped?accountId=${validAccountId}&period=YEARLY`,
      );
      const response = await GET(req);
      expect(response.status).toBe(200);
    });

    it("normalizes mixed-case period to lowercase", async () => {
      const req = createRequest(
        `/api/wrapped?accountId=${validAccountId}&period=Monthly`,
      );
      const response = await GET(req);
      expect(response.status).toBe(200);
    });

    it("returns 400 for invalid period values", async () => {
      const req = createRequest(
        `/api/wrapped?accountId=${validAccountId}&period=daily`,
      );
      const response = await GET(req);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Invalid period");
      expect(data.details).toContain("weekly");
      expect(data.details).toContain("monthly");
      expect(data.details).toContain("yearly");
    });

    it("uses only the first value when period is repeated", async () => {
      // URLSearchParams.get() returns the first value
      const req = createRequest(
        `/api/wrapped?accountId=${validAccountId}&period=yearly&period=weekly`,
      );
      const response = await GET(req);
      expect(response.status).toBe(200);
    });
  });
});
