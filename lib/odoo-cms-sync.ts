import { createOdooClient, getOdooConfig } from '@/src/config/odooClient.js';
import type { FeaturedItem, PageSection, SiteSettings } from '@/lib/db';
import type { IntegrationStoreSnapshot } from '@/lib/integrations';

/**
 * Synchronizes the public CMS and admin integration snapshots to Odoo (PostgreSQL).
 * Odoo acts as the durable source of truth and the local files act as cache.
 */
type OdooCmsRecord = {
  id: number;
  cms_snapshot_json?: string | null;
  integrations_snapshot_json?: string | null;
};

type CmsSnapshot = {
  settings: SiteSettings;
  sections: PageSection[];
  featured_items: FeaturedItem[];
};

function getOdooClient() {
  const config = getOdooConfig();
  if (!config.isReady) {
    return null;
  }

  return createOdooClient(config);
}

async function readSingletonRecord() {
  const odoo = getOdooClient();
  if (!odoo) {
    return null;
  }

  const records = await odoo.searchRead('galante.cms.settings', {
    domain: [],
    fields: ['id', 'cms_snapshot_json', 'integrations_snapshot_json'],
    limit: 1,
  }) as OdooCmsRecord[];

  return records[0] || null;
}

async function upsertSingletonRecord(values: Partial<OdooCmsRecord>) {
  const odoo = getOdooClient();
  if (!odoo) {
    return;
  }

  const existing = await readSingletonRecord();

  if (existing) {
    await odoo.call('galante.cms.settings', 'write', {
      ids: [existing.id],
      values,
    });
    return;
  }

  await odoo.call('galante.cms.settings', 'create', values);
}

export async function syncCmsSnapshotToOdoo(snapshot: CmsSnapshot) {
  const cms_snapshot_json = JSON.stringify(snapshot);
  await upsertSingletonRecord({ cms_snapshot_json });
  return { success: true };
}

export async function loadCmsSnapshotFromOdoo(): Promise<CmsSnapshot | null> {
  const record = await readSingletonRecord();
  if (!record?.cms_snapshot_json) {
    return null;
  }

  const parsed = JSON.parse(record.cms_snapshot_json) as Partial<CmsSnapshot>;
  if (!parsed.settings || !Array.isArray(parsed.sections) || !Array.isArray(parsed.featured_items)) {
    return null;
  }

  return {
    settings: parsed.settings,
    sections: parsed.sections,
    featured_items: parsed.featured_items,
  };
}

export async function syncIntegrationsSnapshotToOdoo(snapshot: IntegrationStoreSnapshot) {
  const integrations_snapshot_json = JSON.stringify(snapshot);
  await upsertSingletonRecord({ integrations_snapshot_json });
  return { success: true };
}

export async function loadIntegrationsSnapshotFromOdoo(): Promise<IntegrationStoreSnapshot | null> {
  const record = await readSingletonRecord();
  if (!record?.integrations_snapshot_json) {
    return null;
  }

  const parsed = JSON.parse(record.integrations_snapshot_json) as IntegrationStoreSnapshot;
  if (!parsed?.google || !parsed?.appointments || !Array.isArray(parsed.audit)) {
    return null;
  }

  return parsed;
}

export async function syncSettingsToOdoo(settings: SiteSettings) {
  const existing = await loadCmsSnapshotFromOdoo();
  return syncCmsSnapshotToOdoo({
    settings,
    sections: existing?.sections || [],
    featured_items: existing?.featured_items || [],
  });
}
