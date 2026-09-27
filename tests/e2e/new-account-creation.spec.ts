import { test, expect, type Page } from "@playwright/test";
import mockData from "../fixtures/horizon-mocks.json";
import { mockWalletAndIndexer } from "./mockDependencies";

const VALID_ADDRESS = mockData.validAddress;
const SECOND_VALID_ADDRESS = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

/** Helper to mock Horizon and Indexer endpoints deterministically for various account states */
async function setupCustomHorizonMocks(
  page: Page,
  options?: {
    customBalances?: Array<{ asset_type: string; balance: string }>;
    accountNotFound?: boolean;
    networkError?: boolean;
    customOperations?: Array<Record<string, unknown>>;
  },
) {
  const recentTransaction = {
    id: "mock-tx-id",
    paging_token: "mock-paging-token",
    hash: "mock-hash",
    ledger: 1,
    created_at: new Date().toISOString(),
    source_account: VALID_ADDRESS,
    source_account_sequence: "1",
    fee_account: VALID_ADDRESS,
    fee_charged: "100",
    operation_count: 1,
    envelope_xdr: "",
    result_xdr: "",
    result_meta_xdr: "",
    memo_type: "none",
    signatures: [],
    valid_after: "",
    valid_before: "",
    _links: {
      self: { href: "https://horizon.stellar.org/transactions/mock-tx-id" },
      operations: { href: "https://horizon.stellar.org/transactions/mock-tx-id/operations" },
    },
  };

  const handleHorizonRoute = async (route: import("@playwright/test").Route) => {
    const url = route.request().url();

    if (options?.networkError) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          type: "https://stellar.org/horizon-errors/server_error",
          title: "Internal Server Error",
          status: 500,
        }),
      });
      return;
    }

    if (options?.accountNotFound && url.includes("/accounts/")) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({
          type: "https://stellar.org/horizon-errors/not_found",
          title: "Resource Missing",
          status: 404,
          detail: "The resource at the given url was not found",
        }),
      });
      return;
    }

    if (url.includes("/accounts/") && !url.includes("/transactions")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: VALID_ADDRESS,
          account_id: VALID_ADDRESS,
          sequence: "1",
          balances: options?.customBalances ?? [
            { asset_type: "native", balance: "1000.0000000" },
          ],
        }),
      });
      return;
    }

    if (url.includes("/transactions") && url.includes("/operations")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          _embedded: {
            records: options?.customOperations ?? [
              {
                id: "mock-op-id",
                paging_token: "mock-op-paging",
                type: "payment",
                type_i: 1,
                created_at: new Date().toISOString(),
                transaction_hash: recentTransaction.hash,
                source_account: VALID_ADDRESS,
                amount: "100",
                asset_type: "native",
              },
            ],
          },
        }),
      });
      return;
    }

    if (url.includes("/transactions")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          _embedded: { records: [recentTransaction] },
          _links: {
            self: { href: url },
          },
        }),
      });
      return;
    }

    await route.continue();
  };

  await page.route("**/horizon.stellar.org/**", handleHorizonRoute);
  await page.route("**/horizon-testnet.stellar.org/**", handleHorizonRoute);
}

test.describe("New Account Creation / Onboarding User Journey", () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage & sessionStorage before each run for clean state
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test.describe("Happy Paths: Start to Finish Flow", () => {
    test("Full flow: Landing -> Connect (manual valid address) -> Account Summary Preview -> Loading -> Wrap Story", async ({
      page,
    }) => {
      await setupCustomHorizonMocks(page);

      // 1. Visit landing page
      await page.goto("/");
      await expect(page).toHaveURL(/\/(en)?(\/)?$/);

      // 2. Click start wrap CTA to navigate to Connect page
      const startWrapButton = page.getByRole("button", { name: /START WRAP/i });
      await expect(startWrapButton).toBeVisible();
      await startWrapButton.click();
      await expect(page).toHaveURL(/\/connect/);

      // 3. Verify Connect page UI
      const addressInput = page.getByRole("textbox", {
        name: /stellar wallet address input/i,
      });
      await expect(addressInput).toBeVisible();

      // 4. Fill with valid Stellar address (56 chars, Ed25519)
      await addressInput.fill(VALID_ADDRESS);

      // 5. Submit valid address
      const submitButton = page.getByRole("button", {
        name: /start wrapping process/i,
      });
      await expect(submitButton).toBeEnabled();
      await submitButton.click();

      // 6. Verify Account Summary Preview appears with accurate details
      await expect(page.getByText("ACCOUNT SUMMARY")).toBeVisible();
      await expect(page.getByText("Total Operations")).toBeVisible();

      // 7. Click Continue to start wrapping
      const continueButton = page.getByRole("button", { name: /^CONTINUE$/i });
      await expect(continueButton).toBeVisible();
      await continueButton.click();

      // 8. Verify transition to /loading screen
      await expect(page).toHaveURL(/\/loading/);
      await expect(page.getByText("Indexing Your Wrapped")).toBeVisible();
      await expect(page.getByRole("heading", { name: "STELLAR" })).toBeVisible();
    });

    test("Returning user one-tap reconnect flow via last-used address", async ({ page }) => {
      await setupCustomHorizonMocks(page);

      // Seed localStorage with a previously used address
      await page.addInitScript((addr) => {
        window.localStorage.setItem("lastUsedStellarAddress", addr);
      }, VALID_ADDRESS);

      await page.goto("/connect");

      // Verify "Continue as GAAA..." shortcut appears
      const continueAsButton = page.getByRole("button", {
        name: new RegExp(`Continue as ${VALID_ADDRESS.slice(0, 4)}`, "i"),
      });
      await expect(continueAsButton).toBeVisible();

      // Clicking shortcut navigates directly to loading
      await continueAsButton.click();
      await expect(page).toHaveURL(/\/loading/);
      await expect(page.getByText("Indexing Your Wrapped")).toBeVisible();
    });

    test("Dismiss last-used address and enter different new account", async ({ page }) => {
      await setupCustomHorizonMocks(page);

      await page.addInitScript((addr) => {
        window.localStorage.setItem("lastUsedStellarAddress", addr);
      }, VALID_ADDRESS);

      await page.goto("/connect");

      // Click "Use a different wallet"
      const switchWalletBtn = page.getByRole("button", {
        name: /use a different wallet/i,
      });
      await expect(switchWalletBtn).toBeVisible();
      await switchWalletBtn.click();

      // Ensure the saved address shortcut is cleared from view
      await expect(switchWalletBtn).not.toBeVisible();

      // Enter second new valid address
      const addressInput = page.getByRole("textbox", {
        name: /stellar wallet address input/i,
      });
      await addressInput.fill(SECOND_VALID_ADDRESS);

      const submitButton = page.getByRole("button", {
        name: /start wrapping process/i,
      });
      await expect(submitButton).toBeEnabled();
      await submitButton.click();

      // Account summary preview appears for the new address
      await expect(page.getByText("ACCOUNT SUMMARY")).toBeVisible();
    });
  });

  test.describe("Unhappy Paths & Error Handling", () => {
    test("Fails on invalid address length with real-time format validation", async ({ page }) => {
      await setupCustomHorizonMocks(page);
      await page.goto("/connect");

      const addressInput = page.getByRole("textbox", {
        name: /stellar wallet address input/i,
      });
      await addressInput.fill("GSHORTADDR123");

      await expect(
        page.getByText(/Invalid address length\. Expected 56 characters/i),
      ).toBeVisible();

      const submitButton = page.getByRole("button", {
        name: /start wrapping process/i,
      });
      await expect(submitButton).toBeDisabled();
    });

    test("Fails on invalid prefix (non G/M starting character)", async ({ page }) => {
      await setupCustomHorizonMocks(page);
      await page.goto("/connect");

      const addressInput = page.getByRole("textbox", {
        name: /stellar wallet address input/i,
      });
      // 56 chars starting with 'S' (Secret seed prefix instead of public key)
      const invalidPrefixAddr = "S" + "A".repeat(55);
      await addressInput.fill(invalidPrefixAddr);

      await expect(
        page.getByText(/Stellar address must start with G/i),
      ).toBeVisible();

      const submitButton = page.getByRole("button", {
        name: /start wrapping process/i,
      });
      await expect(submitButton).toBeDisabled();
    });

    test("Fails on invalid checksum for 56-character string", async ({ page }) => {
      await setupCustomHorizonMocks(page);
      await page.goto("/connect");

      const addressInput = page.getByRole("textbox", {
        name: /stellar wallet address input/i,
      });
      // 56 chars starting with G but invalid Ed25519 checksum
      const invalidChecksumAddr = "G" + "1".repeat(55);
      await addressInput.fill(invalidChecksumAddr);

      await expect(
        page.getByText(/checksum validation failed/i),
      ).toBeVisible();

      const submitButton = page.getByRole("button", {
        name: /start wrapping process/i,
      });
      await expect(submitButton).toBeDisabled();
    });

    test("Handles account not found (unfunded account on Horizon)", async ({ page }) => {
      await setupCustomHorizonMocks(page, { accountNotFound: true });
      await page.goto("/connect");

      const addressInput = page.getByRole("textbox", {
        name: /stellar wallet address input/i,
      });
      await addressInput.fill(VALID_ADDRESS);

      await expect(
        page.getByText(/Account not found on Stellar Mainnet/i),
      ).toBeVisible({ timeout: 15_000 });

      const submitButton = page.getByRole("button", {
        name: /start wrapping process/i,
      });
      await expect(submitButton).toBeDisabled();
    });

    test("Handles Horizon network or RPC error gracefully", async ({ page }) => {
      await setupCustomHorizonMocks(page, { networkError: true });
      await page.goto("/connect");

      const addressInput = page.getByRole("textbox", {
        name: /stellar wallet address input/i,
      });
      await addressInput.fill(VALID_ADDRESS);

      await expect(
        page.getByText(/Unable to verify account on Stellar network/i),
      ).toBeVisible({ timeout: 15_000 });
    });

    test("Shows uninstalled wallet guidance when clicking third-party extension button", async ({
      page,
    }) => {
      await setupCustomHorizonMocks(page);
      await page.addInitScript(() => {
        window.open = (() => null) as typeof window.open;
      });

      await page.goto("/connect");

      // Click Albedo wallet connect when extension not injected
      const albedoBtn = page.getByRole("button", {
        name: /connect with albedo wallet/i,
      });
      await albedoBtn.click();
      await expect(page.getByText(/Albedo wallet not found/i)).toBeVisible();

      // Click xBull wallet connect when extension not injected
      const xbullBtn = page.getByRole("button", {
        name: /connect with xBull wallet/i,
      });
      await xbullBtn.click();
      await expect(page.getByText(/xBull wallet not found/i)).toBeVisible();
    });
  });

  test.describe("Edge Cases & Global State / Network Handling", () => {
    test("Auto-formats pasted input (trims whitespace and converts to uppercase)", async ({
      page,
    }) => {
      await setupCustomHorizonMocks(page);
      await page.goto("/connect");

      const addressInput = page.getByRole("textbox", {
        name: /stellar wallet address input/i,
      });

      // Fill with lower-case and leading/trailing spaces
      const rawInput = `  ${VALID_ADDRESS.toLowerCase()}  `;
      await addressInput.fill(rawInput);

      // Expect input value to be auto-formatted to upper-case without spaces
      await expect(addressInput).toHaveValue(VALID_ADDRESS);

      const submitButton = page.getByRole("button", {
        name: /start wrapping process/i,
      });
      await expect(submitButton).toBeEnabled();
    });

    test("Handles zero-activity valid accounts with honest empty state", async ({
      page,
    }) => {
      // Mock Horizon with 0 transactions/operations for the period
      await page.route("**/horizon.stellar.org/**", async (route) => {
        const url = route.request().url();
        if (url.includes("/accounts/")) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              id: VALID_ADDRESS,
              account_id: VALID_ADDRESS,
              sequence: "10",
              balances: [{ asset_type: "native", balance: "10.0000000" }],
            }),
          });
          return;
        }
        if (url.includes("/transactions")) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              _embedded: { records: [] },
              _links: { self: { href: url } },
            }),
          });
          return;
        }
        await route.continue();
      });

      await page.goto("/connect");

      const addressInput = page.getByRole("textbox", {
        name: /stellar wallet address input/i,
      });
      await addressInput.fill(VALID_ADDRESS);

      const submitButton = page.getByRole("button", {
        name: /start wrapping process/i,
      });
      await expect(submitButton).toBeEnabled();
      await submitButton.click();

      const continueButton = page.getByRole("button", { name: /^CONTINUE$/i });
      await expect(continueButton).toBeVisible();
      await continueButton.click();

      await expect(page).toHaveURL(/\/loading/);

      // Zero activity empty state banner should appear with actions
      await expect(
        page.getByTestId("zero-activity-empty-state"),
      ).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/No activity in this period/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /Change wallet/i })).toBeVisible();
    });

    test("Keyboard navigation: Enter key submits manual address when valid", async ({ page }) => {
      await setupCustomHorizonMocks(page);
      await page.goto("/connect");

      const addressInput = page.getByRole("textbox", {
        name: /stellar wallet address input/i,
      });
      await addressInput.fill(VALID_ADDRESS);

      // Wait until validation succeeds
      const submitButton = page.getByRole("button", {
        name: /start wrapping process/i,
      });
      await expect(submitButton).toBeEnabled();

      // Press Enter in the input
      await addressInput.press("Enter");

      // Verify Account summary appears
      await expect(page.getByText("ACCOUNT SUMMARY")).toBeVisible();
    });

    test("Escape key returns to previous screen / home", async ({ page }) => {
      await setupCustomHorizonMocks(page);
      await page.goto("/connect");

      // Blur input by pressing Escape or focusing body and pressing Escape
      await page.keyboard.press("Escape");
      await expect(page).toHaveURL(/\/(en)?(\/)?$/);
    });

    test("Switching locale changes copy on /connect route across en, es, and fr", async ({ page }) => {
      await setupCustomHorizonMocks(page);

      // English
      await page.goto("/en/connect");
      await expect(page.getByRole("heading", { name: /CONNECT WALLET/i })).toBeVisible();
      await expect(page.getByText("STELLAR ADDRESS")).toBeVisible();
      await expect(page.getByRole("button", { name: /Connect with Freighter wallet/i })).toBeVisible();

      // Spanish
      await page.goto("/es/connect");
      await expect(page.getByRole("heading", { name: /CONECTAR BILLETERA/i })).toBeVisible();
      await expect(page.getByText("DIRECCIÓN STELLAR")).toBeVisible();
      await expect(page.getByRole("button", { name: /Conectar con la billetera Freighter/i })).toBeVisible();

      // French
      await page.goto("/fr/connect");
      await expect(page.getByRole("heading", { name: /CONNECTER LE PORTEFEUILLE/i })).toBeVisible();
      await expect(page.getByText("ADRESSE STELLAR")).toBeVisible();
      await expect(page.getByRole("button", { name: /Se connecter avec le portefeuille Freighter/i })).toBeVisible();
    });
  });
});
