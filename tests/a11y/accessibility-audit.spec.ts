import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockWalletAndIndexer } from "../e2e/mockDependencies";

const DEMO_ADDRESS = "GDEMOADDRESSFORSTELLARSWRAPDESMOPRPTRPOSES12345678";

const THEMES = [
  "green",
  "pink",
  "yellow",
  "red",
  "purple",
  "cosmic-purple"
] as const;

const MODES = ["dark", "light"] as const;

type Theme = (typeof THEMES)[number];
type Mode = (typeof MODES)[number];

/**
 * Rules intentionally disabled and why:
 * - color-contrast: contrast depends on the active color theme, several of
 *   which use brand colors below WCAG AA on purpose. Tracked in #150 follow-ups.
 * - region: axe flags landmarks-only content on hero/share cards; semantic
 *   structure is fine for this marketing flow.
 */
const DISABLED_RULES = ["color-contrast", "region"];

async function setTheme(page: Page, color: Theme, mode: Mode) {
  await page.addInitScript(
    ([themeColor, themeMode]) => {
      localStorage.setItem("stellar-theme-color", themeColor);
      localStorage.setItem("stellar-theme-mode", themeMode);
    },
    [color, mode],
  );
}

async function runAxe(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .disableRules(DISABLED_RULES)
    .analyze();

  return results.violations;
}

test.describe("axe accessibility audit (WCAG 2.1 AA)", () => {
  test.describe("landing page", () => {
    for (const color of THEMES) {
      for (const mode of MODES) {
        test(`has no violations on / with ${color} ${mode} theme`, async ({ page }) => {
          await setTheme(page, color, mode);
          await page.goto("/");

          await expect(page.getByRole("main")).toBeVisible();
          const violations = await runAxe(page);

          expect(violations).toEqual([]);
        });
      }
    }
  });

  test.describe("connect page", () => {
    for (const color of THEMES) {
      for (const mode of MODES) {
        test(`has no violations on /connect with ${color} ${mode} theme`, async ({ page }) => {
          await setTheme(page, color, mode);
          await mockWalletAndIndexer(page);
          await page.goto("/connect");

          await expect(
            page.getByRole("textbox", {
              name: /stellar wallet address input/i,
            }),
          ).toBeVisible();
          const violations = await runAxe(page);

          expect(violations).toEqual([]);
        });
      }
    }
  });

  test.describe("loading page", () => {
    for (const color of THEMES) {
      for (const mode of MODES) {
        test(`has no violations on /loading with ${color} ${mode} theme`, async ({ page }) => {
          await setTheme(page, color, mode);
          await page.addInitScript(
            (address) => {
              localStorage.setItem(
                "stellar-wrap-store",
                JSON.stringify({
                  state: {
                    address,
                    period: "yearly",
                    network: "mainnet",
                    status: "loading",
                    result: null,
                    cacheMeta: null,
                  },
                  version: 0,
                }),
              );
            },
            [DEMO_ADDRESS],
          );
          await page.goto("/loading");

          await expect(page.getByText("Indexing Your Wrapped")).toBeVisible();
          const violations = await runAxe(page);

          expect(violations).toEqual([]);
        });
      }
    }
  });

  test.describe("persona page", () => {
    for (const color of THEMES) {
      for (const mode of MODES) {
        test(`has no violations on /persona with ${color} ${mode} theme`, async ({ page }) => {
          await setTheme(page, color, mode);
          await page.goto("/persona");

          await expect(page.getByText(/Transactions/).first()).toBeVisible();
          const violations = await runAxe(page);

          expect(violations).toEqual([]);
        });
      }
    }
  });

  test.describe("share page", () => {
    for (const color of THEMES) {
      for (const mode of MODES) {
        test(`has no violations on /share with ${color} ${mode} theme`, async ({ page }) => {
          await setTheme(page, color, mode);
          await page.addInitScript(
            (address) => {
              localStorage.setItem(
                "stellar-wrap-store",
                JSON.stringify({
                  state: {
                    address,
                    period: "yearly",
                    network: "mainnet",
                    status: "ready",
                    result: null,
                    cacheMeta: null,
                  },
                  version: 0,
                }),
              );
            },
            [DEMO_ADDRESS],
          );
          await page.goto("/share");

          await expect(
            page.getByRole("link", {
              name: /View full history on Stellar.expert/i,
            }).first(),
          ).toBeVisible();
          const violations = await runAxe(page);

          expect(violations).toEqual([]);
        });
      }
    }
  });

  test.describe("token selector", () => {
    for (const color of THEMES) {
      for (const mode of MODES) {
        test(`has no violations on /persona token selector with ${color} ${mode} theme`, async ({ page }) => {
          await setTheme(page, color, mode);
          await page.addInitScript(
            (address) => {
              localStorage.setItem(
                "stellar-wrap-store",
                JSON.stringify({
                  state: {
                    address,
                    period: "yearly",
                    network: "mainnet",
                    status: "ready",
                    result: [
                      { code: "USDC", issuer: "GBSTRSUD", domain: "centre.io" },
                      { code: "XLM", issuer: "", domain: "stellar.org" },
                    ],
                    cacheMeta: null,
                  },
                  version: 0,
                }),
              );
            },
            [DEMO_ADDRESS],
          );
          await page.goto("/persona");

          const tokenSelector = page
            .getByRole("combobox", { name: /token/i })
            .first();
          await expect(tokenSelector).toBeVisible();
          const violations = await runAxe(page);

          expect(violations).toEqual([]);
        });
      }
    }
  });
});
