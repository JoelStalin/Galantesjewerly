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
  });

  test('health endpoint returns ok', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
  });

  test('contact page loads', async ({ page }) => {
    await page.goto('/contact');
    await expect(page).toHaveURL(/\/contact/);
  });

  test('collections page loads', async ({ page }) => {
    await page.goto('/collections');
    await expect(page).toHaveURL(/\/collections/);
  });
});
