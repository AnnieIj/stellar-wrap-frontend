import {
  expect,
  test,
  type Locator,
  type Page,
  type Route,
} from "@playwright/test";
import mockData from "../fixtures/horizon-mocks.json";

const accountResponse = {
  _links: {
    self: { href: "" },
    transactions: { href: "" },
    operations: { href: "" },
  },
  id: mockData.validAddress,
  account_id: mockData.validAddress,
  sequence: "1",
  sequence_ledger: 1,
  sequence_time: "0",
  subentry_count: 0,
  last_modified_ledger: 1,
  last_modified_time: "2026-01-01T00:00:00Z",
  thresholds: {
    low_threshold: 0,
    med_threshold: 0,
    high_threshold: 0,
  },
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

const operationsResponse = {
  _links: {
    self: { href: "" },
    next: { href: "" },
    prev: { href: "" },
  },
  _embedded: mockData.mockResponses.operations._embedded,
};

async function mockHorizon(page: Page) {
  const handleHorizonRoute = async (route: Route) => {
    const { pathname } = new URL(route.request().url());
    const body = pathname.includes("/operations")
      ? operationsResponse
      : accountResponse;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  };

  await page.route("https://horizon.stellar.org/**", handleHorizonRoute);
  await page.route("https://horizon-testnet.stellar.org/**", handleHorizonRoute);
}

async function tabTo(page: Page, target: Locator, label: string, maxTabs = 40) {
  await expect(target).toBeVisible();

  for (let pressCount = 0; pressCount <= maxTabs; pressCount += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) {
      return;
    }

    await page.keyboard.press("Tab");
  }

  const activeElement = await page.evaluate(() => {
    const active = document.activeElement;
    if (!active) return "none";

    const accessibleName =
      active.getAttribute("aria-label") || active.textContent?.trim() || "";

    return `${active.tagName.toLowerCase()} ${accessibleName}`;
  });

  throw new Error(
    `Unable to reach ${label} with Tab. Active element: ${activeElement}`,
  );
}

async function expectVisibleKeyboardFocus(locator: Locator) {
  await expect(locator).toBeFocused();
  await expect(locator).toBeInViewport();

  const focusStyles = await locator.evaluate((element) => {
    const styles = window.getComputedStyle(element);
    const outlineWidth = Number.parseFloat(styles.outlineWidth);
    const hasOutline = styles.outlineStyle !== "none" && outlineWidth > 0;
    const hasBoxShadow = styles.boxShadow !== "none";

    return {
      isFocusVisible: element.matches(":focus-visible"),
      hasVisibleIndicator: hasOutline || hasBoxShadow,
      outlineColor: styles.outlineColor,
    };
  });

  expect(focusStyles.isFocusVisible).toBe(true);
  expect(focusStyles.hasVisibleIndicator).toBe(true);
  expect(focusStyles.outlineColor).not.toBe("rgba(0, 0, 0, 0)");
}

async function expectConnectScreen(page: Page) {
  await expect(page).toHaveURL(/\/connect(?:$|[?#/])/);
  await expect(
    page.getByRole("textbox", { name: /stellar wallet address input/i }),
  ).toBeVisible();
}

test.describe("onboarding keyboard accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await mockHorizon(page);
  });

  test("supports a keyboard-only path from landing CTA through manual address entry", async ({ page }) => {
    await page.goto("/");

    const startButton = page.getByRole("button", { name: /start wrap/i });
    await tabTo(page, startButton, "landing start CTA");
    await expectVisibleKeyboardFocus(startButton);
    await page.keyboard.press("Enter");

    await expectConnectScreen(page);

    const addressInput = page.getByRole("textbox", {
      name: /stellar wallet address input/i,
    });
    await tabTo(page, addressInput, "wallet address input");
    await expectVisibleKeyboardFocus(addressInput);
    await page.keyboard.type(mockData.validAddress);

    const submitButton = page.getByRole("button", {
      name: /start wrapping process/i,
    });
    await expect(submitButton).toBeEnabled();
    await tabTo(page, submitButton, "start wrapping button");
    await expectVisibleKeyboardFocus(submitButton);
    await page.keyboard.press("Space");

    await expect(page.getByText("ACCOUNT SUMMARY")).toBeVisible();

    const continueButton = page.getByRole("button", { name: /^continue$/i });
    await tabTo(page, continueButton, "account preview continue button");
    await expectVisibleKeyboardFocus(continueButton);
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/loading(?:$|[?#/])/);
  });

  test("activates the landing CTA with Space the same way as click", async ({ page }) => {
    await page.goto("/");

    const startButton = page.getByRole("button", { name: /start wrap/i });
    await tabTo(page, startButton, "landing start CTA");
    await expectVisibleKeyboardFocus(startButton);
    await page.keyboard.press("Space");
    await expectConnectScreen(page);

    await page.goto("/");
    await page.getByRole("button", { name: /start wrap/i }).click();
    await expectConnectScreen(page);
  });

  test("keeps wallet buttons focus-visible and mirrors click behavior for Enter and Space", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.open = (() => null) as typeof window.open;
    });

    await page.goto("/connect");

    const albedoButton = page.getByRole("button", {
      name: /connect with albedo wallet/i,
    });
    await tabTo(page, albedoButton, "Albedo wallet button");
    await expectVisibleKeyboardFocus(albedoButton);
    await page.keyboard.press("Enter");
    await expect(page.getByText(/Albedo wallet not found/i)).toBeVisible();

    await page.goto("/connect");
    await page
      .getByRole("button", { name: /connect with albedo wallet/i })
      .click();
    await expect(page.getByText(/Albedo wallet not found/i)).toBeVisible();

    await page.goto("/connect");

    const xbullButton = page.getByRole("button", {
      name: /connect with xBull wallet/i,
    });
    await tabTo(page, xbullButton, "xBull wallet button");
    await expectVisibleKeyboardFocus(xbullButton);
    await page.keyboard.press("Space");
    await expect(page.getByText(/xBull wallet not found/i)).toBeVisible();

    await page.goto("/connect");
    await page
      .getByRole("button", { name: /connect with xBull wallet/i })
      .click();
    await expect(page.getByText(/xBull wallet not found/i)).toBeVisible();
  });
});
