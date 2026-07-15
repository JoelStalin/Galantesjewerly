/**
 * Meta Catalog Sync Endpoint
 *
 * POST /api/integrations/meta/sync
 *
 * Syncs products from Odoo to Meta Catalog.
 * Requires: Authorization header with sync token
 *
 * Usage:
 *   curl -X POST http://localhost:3000/api/integrations/meta/sync \
 *     -H "Authorization: Bearer YOUR_SYNC_TOKEN" \
 *     -H "Content-Type: application/json" \
 *     -d '{ "dryRun": false }'
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOdooClient } from '@/lib/odoo/client';
import { createMetaClient } from '@/lib/integrations/meta';

/**
 * Validate sync authorization
 * Uses a simple token-based auth (can be upgraded to OAuth/API key)
 */
function validateSyncAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;

  const token = authHeader.replace('Bearer ', '');
  const syncToken = process.env.META_SYNC_TOKEN || 'default-sync-token-change-me';

  return token === syncToken;
}

/**
 * Handle sync request
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Check authentication
    if (!validateSyncAuth(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const { dryRun = false } = body;

    // 3. Fetch products from Odoo
    let products = [];
    try {
      const client = getOdooClient();
      const response = await client.getProducts(1, 500); // Fetch up to 500 products
      products = response.data;
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch products from Odoo',
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 502 },
      );
    }

    if (products.length === 0) {
      return NextResponse.json(
        {
          error: 'No products found to sync',
          message: 'Ensure Odoo products have available_on_website=True',
        },
        { status: 400 },
      );
    }

    // 4. Sync to Meta Catalog
    let metaClient;
    try {
      metaClient = createMetaClient(dryRun);
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Meta configuration incomplete',
          details: error instanceof Error ? error.message : String(error),
          message:
            'Set META_ACCESS_TOKEN, META_CATALOG_ID, META_APP_ID environment variables',
        },
        { status: 400 },
      );
    }

    // 5. Execute sync
    const syncResult = await metaClient.syncAllProducts(products);

    // 6. Log sync result
    const logEntry = {
      timestamp: syncResult.timestamp,
      dryRun,
      totalProducts: products.length,
      successCount: syncResult.success,
      failureCount: syncResult.failed,
      errors: syncResult.errors.slice(0, 10), // Return first 10 errors
    };

    console.log('[Meta Sync]', JSON.stringify(logEntry, null, 2));

    // 7. Return result
    return NextResponse.json(
      {
        success: syncResult.failed === 0,
        message: dryRun ? '[DRY RUN] No changes were made' : 'Sync completed',
        summary: {
          totalProducts: products.length,
          synced: syncResult.success,
          failed: syncResult.failed,
          timestamp: syncResult.timestamp,
        },
        errors: syncResult.errors,
      },
      { status: syncResult.failed === 0 ? 200 : 207 }, // 207 = Multi-Status (partial success)
    );
  } catch (error) {
    console.error('[Meta Sync Error]', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ?
          error instanceof Error ? error.message : String(error)
          : undefined,
      },
      { status: 500 },
    );
  }
}

/**
 * Handle GET (status check)
 */
export async function GET(request: NextRequest) {
  try {
    // Check auth for status endpoint
    if (!validateSyncAuth(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    // Get catalog stats
    const metaClient = createMetaClient();
    const stats = await metaClient.getCatalogStats();

    if (stats.error) {
      return NextResponse.json(
        { error: stats.error },
        { status: 502 },
      );
    }

    return NextResponse.json({
      catalogId: process.env.META_CATALOG_ID,
      productCount: stats.productCount,
      lastUpdated: stats.lastUpdated,
      ready: !!process.env.META_ACCESS_TOKEN,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to check Meta catalog status',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }
}
