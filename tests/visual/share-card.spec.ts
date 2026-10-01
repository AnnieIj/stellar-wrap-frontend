import { expect, test } from "@playwright/test";

const themes = ["green", "pink", "yellow", "red", "purple"] as const;
const scenarios = [
  { name: "short-name-one-transaction", query: "scenario=short" },
  { name: "long-name-one-hundred-transactions", query: "scenario=long" },
  { name: "formatted-large-transaction-count", query: "scenario=max" },
  { name: "missing-archetype-and-vibes", query: "scenario=missing" },
] as const;

test.describe("ShareImageCard visual regression", () => {
  for (const theme of themes) {
    test(`matches ${theme} theme baseline`, async ({ page }) => {
      await page.goto(`/visual-tests/share-card?theme=${theme}&scenario=max`);
      await expect(page.getByTestId("share-image-card")).toHaveScreenshot(`theme-${theme}.png`);
    });
  }

  for (const scenario of scenarios) {
    test(`matches ${scenario.name} baseline`, async ({ page }) => {
      await page.goto(`/visual-tests/share-card?theme=green&${scenario.query}`);
      await expect(page.getByTestId("share-image-card")).toHaveScreenshot(`${scenario.name}.png`);
    });
  }
});
