/**
 * Tests that runIndexingCore deduplicates transactions by paging_token
 * when the same record appears across multiple pages (cursor edge cases).
 */

import { calculateAchievements } from "../achievementCalculator";

jest.mock("@/app/utils/indexerEventEmitter", () => ({
  IndexerEventEmitter: {
    getInstance: jest.fn(() => ({
      emitStepChange: jest.fn(),
      emitStepProgress: jest.fn(),
      emitStepComplete: jest.fn(),
      emitIndexingComplete: jest.fn(),
      emitStepError: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    })),
  },
}));

jest.mock("@/app/utils/indexingAbort", () => ({
  getIndexingAbortSignal: jest.fn(() => null),
  isAbortError: jest.fn(() => false),
}));

jest.mock("../achievementCalculator");

const mockCalculate = calculateAchievements as jest.MockedFunction<
  typeof calculateAchievements
>;

// Build a fake transaction with operations() method
function makeTx(paging_token: string, daysAgo = 1) {
  const created_at = new Date(
    Date.now() - daysAgo * 86400 * 1000,
  ).toISOString();
  return {
    created_at,
    paging_token,
    hash: `hash-${paging_token}`,
    memo: undefined,
    operations: jest.fn().mockResolvedValue({ records: [] }),
  };
}

function mockHorizonServer(pages: ReturnType<typeof makeTx>[][]) {
  let callCount = 0;
  const builder = {
    forAccount: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    cursor: jest.fn().mockReturnThis(),
    call: jest.fn().mockImplementation(() => {
      const page = pages[callCount] ?? [];
      callCount++;
      const isLast = callCount >= pages.length;
      return Promise.resolve({
        records: page,
        _links: { self: { href: "" }, next: isLast ? undefined : { href: "next" } },
      });
    }),
  };
  return {
    transactions: jest.fn(() => builder),
  };
}

jest.mock("@/app/utils/stellarClient", () => ({
  getHorizonServer: jest.fn(),
}));

import { getHorizonServer } from "@/app/utils/stellarClient";
import { runIndexingCore } from "../indexerCore";

const mockGetServer = getHorizonServer as jest.MockedFunction<
  typeof getHorizonServer
>;

describe("runIndexingCore deduplication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCalculate.mockImplementation((txs) => ({
      accountId: "",
      totalTransactions: txs.length,
      totalVolume: 0,
      mostActiveAsset: "XLM",
      contractCalls: 0,
      gasSpent: 0,
      dapps: [],
      vibes: [],
    }));
  });

  it("deduplicates transactions with the same paging_token across pages", async () => {
    const tx1 = makeTx("tok-1");
    const tx2 = makeTx("tok-2");
    const tx3 = makeTx("tok-3");

    // Simulate cursor overlap: tx2 appears on both page 1 and page 2
    const pages = [[tx1, tx2], [tx2, tx3]];
    mockGetServer.mockReturnValue(mockHorizonServer(pages) as unknown as ReturnType<typeof getHorizonServer>);

    await runIndexingCore("G" + "A".repeat(55), "mainnet", "monthly", true);

    // calculateAchievements receives deduplicated list (3 unique, not 4)
    expect(mockCalculate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ paging_token: "tok-1" }),
        expect.objectContaining({ paging_token: "tok-2" }),
        expect.objectContaining({ paging_token: "tok-3" }),
      ]),
    );
    const receivedTxs = mockCalculate.mock.calls[0][0];
    expect(receivedTxs).toHaveLength(3);
  });

  it("counts unique transactions only in totals when duplicates exist", async () => {
    const tx = makeTx("dup-tok");
    // Same transaction repeated three times across pages
    const pages = [[tx], [tx], [tx]];
    mockGetServer.mockReturnValue(mockHorizonServer(pages) as unknown as ReturnType<typeof getHorizonServer>);

    await runIndexingCore("G" + "A".repeat(55), "mainnet", "monthly", true);

    const receivedTxs = mockCalculate.mock.calls[0][0];
    expect(receivedTxs).toHaveLength(1);
  });
});
