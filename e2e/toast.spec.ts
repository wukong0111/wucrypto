import { expect, test } from "@playwright/test";

test("closing a deletion toast removes it from the page", async ({ page }) => {
  await page.goto("/register", { waitUntil: "networkidle" });

  const username = `pwuser_${Date.now()}`;
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill("testpass123");
  await page.locator('button:has-text("Register")').click();

  await page.waitForURL("/settings?error=missing_key", { timeout: 5000 });
  await page.goto("/settings", { waitUntil: "networkidle" });

  await page.locator('input[name="apiKey"]').fill("test-api-key");
  await page.locator('button:has-text("Save")').click();
  await expect(page.locator("text=API key updated")).toBeVisible();

  await page.goto("/", { waitUntil: "networkidle" });

  await page.locator('input[name="name"]').fill("Playwright Group");
  await page.locator('button:has-text("New Group")').click();
  await expect(page.locator("text=Playwright Group")).toBeVisible();

  const deleteBtn = page.locator("[data-confirm-delete]").first();
  await deleteBtn.click();
  await expect(deleteBtn).toHaveClass(/confirm-pending/);
  await deleteBtn.click();

  const toast = page.locator("[data-toast]");
  await expect(toast).toBeVisible();
  await expect(toast).toContainText("Se ha eliminado el grupo Playwright Group");

  await page.locator('[data-toast] button[aria-label="Close notification"]').click();
  await expect(toast).toBeHidden();
  await expect(page.locator("[data-toast]")).toHaveCount(0);
});
