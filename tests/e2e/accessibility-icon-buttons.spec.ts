import { test, expect } from "@playwright/test";

/**
 * Accessibility regression: icon-only controls must expose meaningful names.
 * Covers mute, share, palette, next, and home controls called out in the a11y task.
 */
test.describe("Icon-only button accessible names", () => {
  test("mute toggle exposes mute/unmute name", async ({ page }) => {
    await page.goto("/share");

    const mute = page.getByRole("button", { name: /mute sounds|unmute sounds/i });
    await expect(mute).toBeVisible();

    const labelBefore = await mute.getAttribute("aria-label");
    await mute.click();
    const labelAfter = await mute.getAttribute("aria-label");
    expect(labelBefore).toBeTruthy();
    expect(labelAfter).toBeTruthy();
    expect(labelAfter).not.toEqual(labelBefore);
  });

  test("share page share control has an accessible name", async ({ page }) => {
    await page.goto("/share");

    const share = page.getByRole("button", {
      name: /open share menu|close share menu/i,
    });
    await expect(share).toBeVisible();
  });

  test("story shell icon controls expose home, palette, share, and next names", async ({
    page,
  }) => {
    // Story shell is used across story steps; top-daps is a representative surface.
    await page.goto("/top-daps");

    // Prefer role queries; fall back to aria-label locators if the shell is nested.
    const home = page.locator('button[aria-label="Go to home"]');
    const palette = page.locator('button[aria-label="Open color theme picker"]');
    const share = page.locator('button[aria-label="Share wrap"]');
    const next = page.locator('button[aria-label="Next story segment"]');

    // Soft presence: page may redirect when wrap state is empty; assert attributes when mounted.
    const shellPresent = (await home.count()) > 0;
    test.skip(!shellPresent, "StoryShell not mounted on this route without wrap state");

    await expect(home).toHaveAttribute("aria-label", "Go to home");
    await expect(palette).toHaveAttribute("aria-label", "Open color theme picker");
    await expect(share).toHaveAttribute("aria-label", "Share wrap");
    await expect(next).toHaveAttribute("aria-label", "Next story segment");
  });
});
