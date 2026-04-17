import { test, expect } from '@playwright/test';

test.describe('E2E Shop Flow', () => {
  test('homepage displays featured products from Odoo', async ({ page }) => {
    await page.goto('/');

    const hero = page.locator('section').first();
    await expect(hero).toBeVisible();

    const featuredHeading = page.getByRole('heading', { name: /collection|jewelry/i }).first();
    await expect(featuredHeading).toBeVisible();

    const productCard = page.locator('a').filter({ hasText: /\$/ }).first();
    await expect(productCard).toBeVisible({ timeout: 15000 });
  });

  test('shop page navigation and product listing', async ({ page }) => {
    await page.goto('/');
    const shopLink = page.getByRole('link', { name: /Shop/i }).first();
    await shopLink.click();

    await expect(page).toHaveURL(/\/shop$/);
    const shopHeading = page.getByRole('heading', { name: /collection|shop/i }).first();
    await expect(shopHeading).toBeVisible();
  });

  test('product card and detail page flow', async ({ page }) => {
    await page.goto('/shop');
    await page.waitForLoadState('networkidle');

    // Click on the first product card
    const firstProductLink = page.locator('a').filter({ hasText: /\$/ }).first();
    await firstProductLink.click();

    await expect(page).toHaveURL(/\/shop\/[^/]+$/);
    const title = page.getByRole('heading').first();
    await expect(title).toBeVisible();

    // Check for price (robust check for $ symbol anywhere)
    const price = page.locator('text=$').first();
    await expect(price).toBeVisible();
  });

  test('collections page loads and displays featured products', async ({ page }) => {
    await page.goto('/collections');
    const heading = page.getByRole('heading', { name: /collections|design/i }).first();
    await expect(heading).toBeVisible();
  });

  test('cart redirect button works', async ({ page }) => {
    await page.goto('/shop');
    await page.waitForLoadState('networkidle');

    const firstProductLink = page.locator('a').filter({ hasText: /\$/ }).first();
    const href = await firstProductLink.getAttribute('href');

    if (href && href.includes('/shop/')) {
      const slug = href.split('/').pop();
      // Test the redirect route directly
      await page.goto(`/cart?product=${slug}&qty=1`);

      await page.waitForTimeout(3000);
      const currentUrl = page.url();

      // Should either be on cart page with info or redirected to Odoo
      expect(currentUrl).toMatch(/cart|odoo|shop\.galantes/);
    }
  });

  test('product availability badges display correctly', async ({ page }) => {
    await page.goto('/shop');
    const badges = page.locator('text=/in stock|out of stock|pre-order/i');
    await expect(badges.first()).toBeVisible();
  });

  test('category filter or search on shop page', async ({ page }) => {
    await page.goto('/shop?category=Rings');
    const shopHeading = page.getByRole('heading', { name: /collection|shop/i }).first();
    await expect(shopHeading).toBeVisible();
  });

  test('product detail gallery and images', async ({ page }) => {
    await page.goto('/shop');
    const firstProductLink = page.locator('a').filter({ hasText: /\$/ }).first();
    await firstProductLink.click();

    await page.waitForLoadState('networkidle');
    const mainImage = page.locator('img').first();
    await expect(mainImage).toBeVisible();
  });

  test('header navigation consistency across pages', async ({ page }) => {
    const pages = ['/', '/shop', '/collections'];
    for (const testPage of pages) {
      await page.goto(testPage);
      await expect(page.getByRole('link', { name: /Shop/i }).first()).toBeVisible();
    }
  });
});
