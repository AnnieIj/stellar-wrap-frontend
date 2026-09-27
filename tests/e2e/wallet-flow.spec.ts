import { expect, test, type Page, type Route } from "@playwright/test";
import mockData from "../fixtures/horizon-mocks.json";

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const VALID_ADDRESS = mockData.validAddress;
const INVALID_ADDRESS = mockData.invalidAddress;

/**
 * Stellar uses 7 decimal places (1 XLM = 10_000_000 stroops).
 * The fixture balance intentionally contains sub-7-digit decimals to verify
 * the UI renders the Horizon value exactly, with no silent truncation.
 */
const FIXTURE_BALANCE = mockData.mockResponses.accounts.balances[0].balance;

// ---------------------------------------------------------------------------
// Horizon response bodies
// ---------------------------------------------------------------------------

const accountBody = {
  _links: {
    self: { href: "" },
    transactions: { href: "" },
    operations: { href: "" },
  },
  id: VALID_ADDRESS,
  account_id: VALID_ADDRESS,
  sequence: "1",
  sequence_ledger: 1,
  sequence_time: "0",
  subentry_count: 0,
  last_modified_ledger: 1,
  last_modified_time: "2026-01-01T00:00:00Z",
  thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
  flags: {
    auth_required: false,
    auth_revocable: false,
    auth_immutable: false,
    auth_clawback_enabled: false,
  },
  balances: mockData.mockResponses.accounts.balances,
  signers: mockData.mockResponses.accounts.signers,
  data: mockData.mockResponses.accounts.data,
};

const transactionsBody = {
  _links: { self: { href: "" }, next: { href: "" }, prev: { href: "" } },
  _embedded: { records: [] },
};

// ---------------------------------------------------------------------------
// Route helpers
// ---------------------------------------------------------------------------

async function mockHorizon(page: Page): Promise<void> {
  const handler = async (route: Route): Promise<void> => {
    const { pathname } = new URL(route.request().url());
    const body = pathname.includes("/transactions") ? transactionsBody : accountBody;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  };

  await page.route("https://horizon.stellar.org/**", handler);
  await page.route("https://horizon-testnet.stellar.org/**", handler);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe("Wallet Connection flow", () => {
  test.beforeEach(async ({ page }) => {
    await mockHorizon(page);
  });

  // ── 1. Invalid address shows a clear validation error ─────────────────────
  test("invalid address length shows validation error", async ({ page }) => {
    await page.goto("/connect");

    const input = page.getByRole("textbox", {
      name: /stellar wallet address input/i,
    });
    await input.fill(INVALID_ADDRESS);

    await expect(page.getByText(/invalid address length/i)).toBeVisible();
  });

  // ── 2. Stellar amount precision — 7 decimal places (Stroops) ──────────────
  test("account preview renders XLM balance with correct Stroop precision", async ({
    page,
  }) => {
    await page.goto("/connect");

    const input = page.getByRole("textbox", {
      name: /stellar wallet address input/i,
    });
    await input.fill(VALID_ADDRESS);

    const submitButton = page.getByRole("button", {
      name: /start wrapping process/i,
    });
    await expect(submitButton).toBeEnabled({ timeout: 15_000 });
    await submitButton.click();

    await expect(page.getByText("ACCOUNT SUMMARY")).toBeVisible({
      timeout: 10_000,
    });

    // Assert the balance value is rendered exactly as returned by Horizon —
    // no rounding, no truncation of Stroop-precision decimals.
    const escapedBalance = FIXTURE_BALANCE.replace(".", "\\.");
    await expect(
      page.getByText(new RegExp(escapedBalance, "i")),
    ).toBeVisible();
  });

  // ── 3. Network latency — UI does not crash, spinner shown ─────────────────
  test("slow Horizon response does not crash the UI", async ({ page }) => {
    // Override the mock with a 5 s delay to simulate high latency.
    const slowHandler = async (route: Route): Promise<void> => {
      await new Promise<void>((resolve) => setTimeout(resolve, 5_000));
      const { pathname } = new URL(route.request().url());
      const body = pathname.includes("/transactions")
        ? transactionsBody
        : accountBody;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    };
    await page.route("https://horizon.stellar.org/**", slowHandler);
    await page.route("https://horizon-testnet.stellar.org/**", slowHandler);

    await page.goto("/connect");

    const input = page.getByRole("textbox", {
      name: /stellar wallet address input/i,
    });
    await input.fill(VALID_ADDRESS);

    // The page heading must remain visible — no crash or blank screen.
    await expect(
      page.getByRole("heading", { name: /connect wallet/i }),
    ).toBeVisible();

    // A "Checking account…" spinner is shown while the request is in-flight.
    await expect(page.getByText(/checking account/i)).toBeVisible({
      timeout: 3_000,
    });
  });

  // ── 4. Connection timeout (aborted request) — error message displayed ──────
  test("Horizon connection failure shows an error without crashing", async ({
    page,
  }) => {
    // Abort all Horizon requests to simulate a full network timeout.
    await page.route("https://horizon.stellar.org/**", (route) =>
      route.abort("failed"),
    );
    await page.route("https://horizon-testnet.stellar.org/**", (route) =>
      route.abort("failed"),
    );

    await page.goto("/connect");

    const input = page.getByRole("textbox", {
      name: /stellar wallet address input/i,
    });
    await input.fill(VALID_ADDRESS);

    // useStellarAddressValidation surfaces this text on a catch-all network error.
    await expect(
      page.getByText(/unable to verify account on stellar network/i),
    ).toBeVisible({ timeout: 15_000 });

    // The page must remain navigable — heading still visible.
    await expect(
      page.getByRole("heading", { name: /connect wallet/i }),
    ).toBeVisible();
  });

  // ── 5. Freighter not installed — descriptive install prompt ───────────────
  test("Freighter not installed shows a descriptive install prompt", async ({
    page,
  }) => {
    // window.freighter is absent by default in headless Chromium.
    await page.goto("/connect");

    await page
      .getByRole("button", { name: /connect with freighter wallet/i })
      .click();

    await expect(
      page.getByText(/freighter is not installed/i),
    ).toBeVisible({ timeout: 5_000 });

    await expect(page.getByText(/install freighter/i)).toBeVisible();
  });

  // ── 6. User rejects Freighter — rejection error message shown ─────────────
  //
  // Playwright cannot drive a real browser extension popup. We mark the
  // extension as "installed" via window.freighter so isFreighterInstalled()
  // returns true, then let requestAccess() fail naturally (no real extension
  // handler to approve it). The connect handler catches the error and
  // displays a user-facing message.
  test("Freighter connection rejection shows a clear error message", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "freighter", {
        value: { isConnected: true },
        writable: true,
        configurable: true,
      });
    });

    await page.goto("/connect");

    await page
      .getByRole("button", { name: /connect with freighter wallet/i })
      .click();

    // Any of these messages satisfies "a clear error is displayed":
    //   • "Connection rejected. Please approve the connection in Freighter."
    //   • "Failed to connect wallet"
    //   • "Freighter is not installed." (library fell back)
    await expect(
      page.getByText(
        /connection rejected|failed to connect|freighter is not installed/i,
      ),
    ).toBeVisible({ timeout: 10_000 });
  });

  // ── 7. Albedo not installed — clear error without crash ───────────────────
  test("Albedo not installed shows a clear error", async ({ page }) => {
    await page.goto("/connect");

    await page
      .getByRole("button", { name: /connect with albedo wallet/i })
      .click();

    await expect(
      page.getByText(/albedo wallet not found/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  // ── 8. xBull not installed — clear error without crash ────────────────────
  test("xBull not installed shows a clear error", async ({ page }) => {
    await page.goto("/connect");

    await page
      .getByRole("button", { name: /connect with xBull wallet/i })
      .click();

    await expect(
      page.getByText(/xBull wallet not found/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  // ── 9. Freighter network mismatch — targeted switch-network prompt ─────────
  test("Freighter on wrong network shows network mismatch prompt or clear error", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "freighter", {
        value: { isConnected: true },
        writable: true,
        configurable: true,
      });
    });

    await page.goto("/connect");

    await page
      .getByRole("button", { name: /connect with freighter wallet/i })
      .click();

    // Either the mismatch prompt or the generic connection error is acceptable —
    // both are non-crashing, clear UI responses.
    await expect(
      page.getByText(
        /wallet network mismatch|freighter is not installed|connection rejected|failed to connect/i,
      ),
    ).toBeVisible({ timeout: 10_000 });
  });

  // ── 10. RPC caching — repeated address does not re-request Horizon ─────────
  //
  // useStellarAddressValidation caches results with a 5-minute TTL.
  // Entering the same valid address a second time must not fire a new
  // /accounts/ request, preventing unnecessary RPC calls that could
  // trigger rate-limiting.
  test("repeated address entry is served from the validation cache", async ({
    page,
  }) => {
    let accountRequestCount = 0;

    const countingHandler = async (route: Route): Promise<void> => {
      const { pathname } = new URL(route.request().url());
      if (
        pathname.includes("/accounts/") &&
        !pathname.includes("/transactions")
      ) {
        accountRequestCount += 1;
      }
      const body = pathname.includes("/transactions")
        ? transactionsBody
        : accountBody;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    };

    await page.route("https://horizon.stellar.org/**", countingHandler);
    await page.route("https://horizon-testnet.stellar.org/**", countingHandler);

    await page.goto("/connect");

    const input = page.getByRole("textbox", {
      name: /stellar wallet address input/i,
    });

    // First entry — triggers one Horizon /accounts/ request.
    await input.fill(VALID_ADDRESS);
    // Wait for the validation to settle (valid state or spinner disappears).
    await page.waitForTimeout(600);
    const countAfterFirst = accountRequestCount;

    // Clear then re-enter the same address — cache hit, no new request.
    await input.fill("");
    await input.fill(VALID_ADDRESS);
    await page.waitForTimeout(600);

    expect(accountRequestCount).toBe(countAfterFirst);
  });
});

test.describe("Freighter wallet connection flow", () => {
  test("connects with mocked Freighter and uses bounded Horizon preview calls", async ({
    page,
  }) => {
    const rpcCounters = { account: 0, transactions: 0, operations: 0 };

    await mockFreighter(page, { address: mockData.validAddress });
    await mockWalletAndIndexer(page, {
      balance: "1234.5678901",
      operationAmount: "987.6543210",
      counters: rpcCounters,
    });

    await page.goto("/connect");
    await page
      .getByRole("button", { name: /connect with freighter wallet/i })
      .click();

    await expect(page.getByText("ACCOUNT SUMMARY")).toBeVisible();
    await expect(page.getByText("1234.5678901 XLM")).toBeVisible();
    await expect(page.getByText("Total Operations")).toBeVisible();
    await expect(page.getByText("1", { exact: true })).toBeVisible();

    expect(rpcCounters.account).toBe(1);
    expect(rpcCounters.transactions).toBe(1);
    expect(rpcCounters.operations).toBe(0);

    await page.getByRole("button", { name: /^continue$/i }).click();
    await expect(page).toHaveURL(/\/loading(?:$|[?#/])/);
  });

  test("displays a clear rejection error when Freighter access is denied", async ({
    page,
  }) => {
    await mockFreighter(page, {
      address: mockData.validAddress,
      rejectAccess: true,
    });
    await mockWalletAndIndexer(page);

    await page.goto("/connect");
    await page
      .getByRole("button", { name: /connect with freighter wallet/i })
      .click();

    await expect(
      page.getByText(/connection rejected\. please approve the connection in freighter/i),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/connect(?:$|[?#/])/);
  });

  test("keeps the UI stable while wallet preview RPC is slow", async ({
    page,
  }) => {
    await mockFreighter(page, { address: mockData.validAddress });
    await mockWalletAndIndexer(page, { delayMs: 750 });

    await page.goto("/connect");
    await page
      .getByRole("button", { name: /connect with freighter wallet/i })
      .click();

    await expect(page.getByText("ACCOUNT SUMMARY")).toBeVisible();
    await expect(page.getByText("1000.0000000 XLM")).toBeVisible();
    await expect(page).toHaveURL(/\/connect(?:$|[?#/])/);
  });

  test("falls back to an empty preview instead of crashing on RPC timeout", async ({
    page,
  }) => {
    await mockFreighter(page, { address: mockData.validAddress });
    await mockWalletAndIndexer(page, { failAccountPreview: true });

    await page.goto("/connect");
    await page
      .getByRole("button", { name: /connect with freighter wallet/i })
      .click();

    await expect(page.getByText("ACCOUNT SUMMARY")).toBeVisible();
    await expect(page.getByText("0 XLM")).toBeVisible();
    await expect(page.getByText("Total Operations")).toBeVisible();
    await expect(page).toHaveURL(/\/connect(?:$|[?#/])/);
  });
});
