import { expect, test } from "@playwright/test";
import { mockWalletAndIndexer } from "./mockDependencies";

test.describe("Routing smoke flow", () => {
  test.beforeEach(async ({ page }) => {
    await mockWalletAndIndexer(page);
  });

  test("landing → connect → loading → persona → share", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/(en)?(\/)?$/);
    await page.getByRole("button", { name: /START WRAP/i }).click();
    await expect(page).toHaveURL(/\/connect/);

    await page.getByRole("button", { name: /try demo mode/i }).click();
    await expect(page).toHaveURL(/\/loading/);
    await expect(page.getByText("Indexing Your Wrapped")).toBeVisible();

    await page.waitForURL(/\/persona/, { timeout: 90_000 });

    await page.getByRole("link", { name: /go to share step/i }).click({ force: true });
    await expect(page).toHaveURL(/\/share/);
    await expect(
      page.getByText("View full history on Stellar.expert").first(),
    ).toBeVisible();
  });
});
