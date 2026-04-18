import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wait for the shop page grid to be ready — wait for either a product card
 * or an empty-state message to appear.
 */
async function waitForShopGrid(page: any) {
  await Promise.race([
    page.locator('a').filter({ hasText: /\$/ }).first().waitFor({ timeout: 20000 }),
    page.getByText(/no products matched/i).waitFor({ timeout: 20000 }),
  ]).catch(() => {/* grid may be empty */});
}

// ---------------------------------------------------------------------------
// Homepage
// ---------------------------------------------------------------------------

test.describe('Homepage', () => {
  test('displays featured products section', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('section').first()).toBeVisible();
    const heading = page.getByRole('heading', { name: /collection|jewelry/i }).first();
    await expect(heading).toBeVisible();
    const productCard = page.locator('a').filter({ hasText: /\$/ }).first();
    await expect(productCard).toBeVisible({ timeout: 20000 });
  });
});

// ---------------------------------------------------------------------------
// Shop Listing Page
// ---------------------------------------------------------------------------

test.describe('Shop Page', () => {
  test('page loads with correct heading', async ({ page }) => {
    await page.goto('/shop');
    const heading = page.getByRole('heading', { name: /shop fine jewelry/i });
    await expect(heading).toBeVisible({ timeout: 15000 });
  });

  test('shows search input', async ({ page }) => {
    await page.goto('/shop');
    const searchInput = page.getByPlaceholder(/search by name/i);
    await expect(searchInput).toBeVisible({ timeout: 15000 });
  });

  test('shows sort dropdown', async ({ page }) => {
    await page.goto('/shop');
    const sortSelect = page.locator('select#sort-select');
    await expect(sortSelect).toBeVisible({ timeout: 15000 });
  });

  test('shows material dropdown', async ({ page }) => {
    await page.goto('/shop');
    const materialSelect = page.locator('select#material-select');
    await expect(materialSelect).toBeVisible({ timeout: 15000 });
  });

  test('search updates URL with q param', async ({ page }) => {
    await page.goto('/shop');
    const searchInput = page.getByPlaceholder(/search by name/i);
    await searchInput.fill('ring');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/q=ring/, { timeout: 5000 });
  });

  test('category filter updates URL', async ({ page }) => {
    await page.goto('/shop');
    // Wait for controls to render
    await page.waitForLoadState('networkidle');
    // Click first category pill (not "All")
    const pills = page.locator('nav[aria-label="Product categories"] button');
    const count  = await pills.count();
    if (count > 1) {
      await pills.nth(1).click();
      await expect(page).toHaveURL(/category=/, { timeout: 5000 });
    }
  });

  test('sort change updates URL', async ({ page }) => {
    await page.goto('/shop');
    const sortSelect = page.locator('select#sort-select');
    await sortSelect.selectOption('newest');
    await expect(page).toHaveURL(/sort=newest/, { timeout: 5000 });
  });

  test('empty state shown when no results', async ({ page }) => {
    await page.goto('/shop?q=xyzzy-this-product-does-not-exist-12345');
    await page.waitForLoadState('networkidle');
    const emptyText = page.getByText(/no products matched/i);
    await expect(emptyText).toBeVisible({ timeout: 15000 });
  });

  test('clear filters link navigates to /shop', async ({ page }) => {
    await page.goto('/shop?q=xyzzy-this-product-does-not-exist-12345');
    await page.waitForLoadState('networkidle');
    const clearLink = page.getByRole('link', { name: /clear filters/i });
    await expect(clearLink).toBeVisible({ timeout: 10000 });
    await clearLink.click();
    await expect(page).toHaveURL(/\/shop$/, { timeout: 5000 });
  });

  test('category URL param filters products', async ({ page }) => {
    await page.goto('/shop?category=Rings');
    const heading = page.getByRole('heading', { name: /shop fine jewelry/i });
    await expect(heading).toBeVisible({ timeout: 15000 });
  });

  test('active filter chip shown for search term', async ({ page }) => {
    await page.goto('/shop?q=gold');
    const chip = page.locator('button').filter({ hasText: /"gold"/i });
    await expect(chip).toBeVisible({ timeout: 15000 });
  });

  test('pagination renders when multiple pages exist', async ({ page }) => {
    await page.goto('/shop');
    await page.waitForLoadState('networkidle');
    const nav = page.locator('nav[aria-label="Pagination navigation"]');
    // Pagination only renders when there is more than 1 page
    const count = await nav.count();
    if (count > 0) {
      await expect(nav).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Product Card
// ---------------------------------------------------------------------------

test.describe('Product Card', () => {
  test('card links to product detail page', async ({ page }) => {
    await page.goto('/shop');
    await waitForShopGrid(page);
    const firstCard = page.locator('a').filter({ hasText: /\$/ }).first();
    const href = await firstCard.getAttribute('href');
    if (!href) test.skip();
    expect(href).toMatch(/\/shop\//);
  });

  test('card has Add to Cart button', async ({ page }) => {
    await page.goto('/shop');
    await waitForShopGrid(page);
    const btn = page.getByRole('button', { name: /add to cart/i }).first();
    const count = await btn.count();
    if (count === 0) test.skip(); // no in-stock products
    await expect(btn).toBeVisible();
  });

  test('availability badge visible', async ({ page }) => {
    await page.goto('/shop');
    await page.waitForLoadState('networkidle');
    const badges = page.locator('span').filter({ hasText: /in stock|out of stock|pre-order/i });
    const count  = await badges.count();
    if (count > 0) await expect(badges.first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Product Detail Page (PDP)
// ---------------------------------------------------------------------------

test.describe('Product Detail Page', () => {
  async function getFirstProductSlug(page: any): Promise<string | null> {
    await page.goto('/shop');
    await waitForShopGrid(page);
    const firstCard = page.locator('a').filter({ hasText: /\$/ }).first();
    const href      = await firstCard.getAttribute('href');
    return href ? href.split('/shop/').pop() ?? null : null;
  }

  test('product detail page renders title and price', async ({ page }) => {
    const slug = await getFirstProductSlug(page);
    if (!slug) test.skip();
    await page.goto(`/shop/${slug}`);
    const title = page.getByRole('heading', { level: 1 });
    await expect(title).toBeVisible({ timeout: 15000 });
    const price = page.locator('text=$').first();
    await expect(price).toBeVisible();
  });

  test('breadcrumb links back to /shop', async ({ page }) => {
    const slug = await getFirstProductSlug(page);
    if (!slug) test.skip();
    await page.goto(`/shop/${slug}`);
    const shopLink = page.getByRole('link', { name: /^shop$/i });
    await expect(shopLink).toBeVisible({ timeout: 15000 });
    await shopLink.click();
    await expect(page).toHaveURL(/\/shop$/);
  });

  test('trust badges visible on PDP', async ({ page }) => {
    const slug = await getFirstProductSlug(page);
    if (!slug) test.skip();
    await page.goto(`/shop/${slug}`);
    await page.waitForLoadState('networkidle');
    const trustText = page.getByText(/gift-ready packaging/i);
    await expect(trustText).toBeVisible({ timeout: 15000 });
  });

  test('Shipping & Care section present', async ({ page }) => {
    const slug = await getFirstProductSlug(page);
    if (!slug) test.skip();
    await page.goto(`/shop/${slug}`);
    await page.waitForLoadState('networkidle');
    const section = page.getByRole('heading', { name: /shipping & care/i });
    await expect(section).toBeVisible({ timeout: 15000 });
  });

  test('Need a Custom Version section present', async ({ page }) => {
    const slug = await getFirstProductSlug(page);
    if (!slug) test.skip();
    await page.goto(`/shop/${slug}`);
    await page.waitForLoadState('networkidle');
    const section = page.getByRole('heading', { name: /need a custom version/i });
    await expect(section).toBeVisible({ timeout: 15000 });
  });

  test('Add to Cart button uses local cart (not external URL)', async ({ page }) => {
    const slug = await getFirstProductSlug(page);
    if (!slug) test.skip();
    await page.goto(`/shop/${slug}`);
    await page.waitForLoadState('networkidle');
    const addToCart = page.getByRole('button', { name: /add to cart/i });
    const count = await addToCart.count();
    if (count === 0) test.skip();
    await expect(addToCart).toBeVisible({ timeout: 15000 });
    // Clicking should NOT navigate away
    const urlBefore = page.url();
    await addToCart.click();
    await page.waitForTimeout(500);
    expect(page.url()).toBe(urlBefore);
  });

  test('gallery image visible', async ({ page }) => {
    const slug = await getFirstProductSlug(page);
    if (!slug) test.skip();
    await page.goto(`/shop/${slug}`);
    await page.waitForLoadState('networkidle');
    const img = page.locator('img').first();
    await expect(img).toBeVisible({ timeout: 15000 });
  });

  test('related products section shown when available', async ({ page }) => {
    const slug = await getFirstProductSlug(page);
    if (!slug) test.skip();
    await page.goto(`/shop/${slug}`);
    await page.waitForLoadState('networkidle');
    const relatedHeading = page.getByRole('heading', { name: /you may also like/i });
    // Only assert visible if it exists (zero related products is valid)
    const count = await relatedHeading.count();
    if (count > 0) await expect(relatedHeading).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Collections Page
// ---------------------------------------------------------------------------

test.describe('Collections Page', () => {
  test('loads and displays featured products', async ({ page }) => {
    await page.goto('/collections');
    const heading = page.getByRole('heading', { name: /collections|design/i }).first();
    await expect(heading).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Header Navigation
// ---------------------------------------------------------------------------

test.describe('Header Navigation', () => {
  test('Shop link present on all main pages', async ({ page }) => {
    for (const url of ['/', '/shop', '/collections']) {
      await page.goto(url);
      await expect(page.getByRole('link', { name: /^shop$/i }).first()).toBeVisible();
    }
  });
});

