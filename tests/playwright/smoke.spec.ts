import { test, expect } from '@playwright/test';

test.describe('Public smoke tests', () => {
  test('homepage loads with hero title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Galante/i);
    // Hero section must be visible
    const hero = page.locator('section').first();
    await expect(hero).toBeVisible();
  });

  test('navigation links are present', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Collections/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Contact/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Shop/i }).first()).toBeVisible();
  });

  test('shop page loads from header button', async ({ page }) => {
    await page.goto('/');
    const shopLink = page.getByRole('link', { name: /Shop/i }).first();
    await expect(shopLink).toBeVisible();
    await shopLink.click();
    await expect(page).toHaveURL(/\/shop/);
    await expect(page.getByRole('heading', { name: /Our Jewelry Collection|Shop/i })).toBeVisible();
  });

  test('collections page loads and shows featured products or fallback', async ({ page }) => {
    await page.goto('/collections');
    await expect(page).toHaveURL(/\/collections/);
    await expect(page.getByRole('heading', { name: /Celebrate Timeless Design|Fine Collections/i })).toBeVisible();
  });

  test('health endpoint returns ok', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
  });

  test('contact page loads', async ({ page }) => {
    await page.goto('/contact');
    await expect(page).toHaveURL(/\/contact/);
  });
});
