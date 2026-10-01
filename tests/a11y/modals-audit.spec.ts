import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const DEMO_ADDRESS = "GDEMOADDRESSFORSTELLARWRAPDEMOPURPOSES12345678";

/**
 * Axe audit of a modal/dialog/popup surface.
 *
 * Unlike `accessibility-audit.spec.ts`, `color-contrast` is ENABLED here so the
 * reduced-opacity whites found on dialog text cannot silently regress. The run
 * is scoped (via a CSS selector) to the surface element itself so page-wide
 * brand colors (which the global suite intentionally disables) are not
 * re-flagged.
 */
async function runAxe(page: Page, scopeSelector: string) {
  const results = await new AxeBuilder({ page })
    .include(scopeSelector)
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  return results.violations;
}

async function seedWrapStore(
  page: Page,
  status: "loading" | "ready",
  overrides: Record<string, unknown> = {},
) {
  await page.addInitScript(
    ([address, wrapStatus, extra]) => {
      localStorage.setItem(
        "stellar-wrap-store",
        JSON.stringify({
          state: {
            address,
            period: "yearly",
            network: "mainnet",
            status: wrapStatus,
            result: null,
            cacheMeta: null,
            ...extra,
          },
          version: 0,
        }),
      );
    },
    [DEMO_ADDRESS, status, overrides],
  );
}

const MAINNET_CONTRACT_ADDRESS = "CBUNDLEPROVIDERSOROBANCONTRACTADDR0000001";

/**
 * Zustand persists asynchronously, so right after `goto` the store can still
 * report `status: "idle"` (which makes NetworkToggle skip the dialog and switch
 * immediately). Click the trigger repeatedly until the dialog actually opens.
 */
async function openNetworkDialog(page: Page) {
  const dialog = page.getByRole("dialog", { name: /Switch Networks/i });
  const trigger = page
    .getByRole("button")
    .filter({ hasText: "Network" })
    .first();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await dialog.isVisible().catch(() => false)) return dialog;
    await trigger.click().catch(() => {});
    await page.waitForTimeout(100);
  }

  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("network switch confirmation dialog", () => {
  test.beforeEach(async ({ page }) => {
    // `currentContractAddress` is not persisted by partialize, but the default
    // zustand merge restores extra persisted keys. Seeding it non-null prevents
    // NetworkToggle's mount effect (which resets status to idle) from firing.
    await seedWrapStore(page, "ready", {
      currentContractAddress: MAINNET_CONTRACT_ADDRESS,
    });
  });

  test("has no axe violations and traps focus", async ({ page }) => {
    await page.goto("/");

    const dialog = await openNetworkDialog(page);

    const violations = await runAxe(
      page,
      '[aria-labelledby="network-switch-title"]',
    );
    expect(violations).toEqual([]);

    const cancelButton = dialog.getByRole("button", { name: /Cancel/i });
    const switchButton = dialog.getByRole("button", {
      name: /Switch Network/i,
    });

    await expect(cancelButton).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(switchButton).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(cancelButton).toBeFocused();
  });

  test("closes with Escape and returns focus to the trigger", async ({
    page,
  }) => {
    await page.goto("/");

    const dialog = await openNetworkDialog(page);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    const trigger = page
      .getByRole("button")
      .filter({ hasText: "Network" })
      .first();
    await expect(trigger).toBeFocused();
  });
});

test.describe("persona share popup", () => {
  test.beforeEach(async ({ page }) => {
    await seedWrapStore(page, "ready");
  });

  test("has no axe violations on the open share menu", async ({ page }) => {
    await page.goto("/persona");

    const trigger = page.getByRole("button", { name: /Share this wrap/i });
    await expect(trigger).toBeVisible();
    // The persona reveal keeps animating, so a normal click never becomes
    // "stable" to Playwright; dispatching the click keeps it deterministic.
    await trigger.dispatchEvent("click");

    const menu = page.getByRole("menu", { name: /Share this wrap/i });
    await expect(menu).toBeVisible();

    const violations = await runAxe(
      page,
      '[role="menu"][aria-label="Share this wrap"]',
    );
    expect(violations).toEqual([]);
  });
});
