/**
 * @vitest-environment node
 */
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fileStore = new Map<string, string>();
const dataRoot = 'C:/virtual-data';
const cmsFilePath = path.join(dataRoot, 'cms.json');
const syncCmsSnapshotToOdoo = vi.fn(async () => ({ success: true }));
const loadCmsSnapshotFromOdoo = vi.fn(async () => ({
  settings: {
    site_title: 'Odoo title',
    site_description: 'Odoo description',
    favicon_url: '/odoo-favicon.ico',
    logo_url: '/odoo-logo.png',
  },
  sections: [],
  featured_items: [
    {
      id: 'odoo-featured',
      title: 'Odoo featured',
      content_text: 'Should not win over local data',
      image_url: 'https://odoo.example/image.webp',
      action_text: 'Open',
      action_link: '/odoo',
      is_active: true,
      order_index: 0,
    },
  ],
}));

vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn(async () => undefined),
    readFile: vi.fn(async (filePath: string) => {
      if (!fileStore.has(filePath)) {
        const error = new Error(`ENOENT: no such file or directory, open '${filePath}'`);
        (error as NodeJS.ErrnoException).code = 'ENOENT';
        throw error;
      }
      return fileStore.get(filePath)!;
    }),
    writeFile: vi.fn(async (filePath: string, content: string) => {
      fileStore.set(filePath, content);
    }),
    stat: vi.fn(async () => ({ mtimeMs: 123456789 })),
  },
  mkdir: vi.fn(async () => undefined),
  readFile: vi.fn(async (filePath: string) => {
    if (!fileStore.has(filePath)) {
      const error = new Error(`ENOENT: no such file or directory, open '${filePath}'`);
      (error as NodeJS.ErrnoException).code = 'ENOENT';
      throw error;
    }
    return fileStore.get(filePath)!;
  }),
  writeFile: vi.fn(async (filePath: string, content: string) => {
    fileStore.set(filePath, content);
  }),
  stat: vi.fn(async () => ({ mtimeMs: 123456789 })),
}));

vi.mock('@/lib/runtime-paths', () => ({
  getDataRoot: () => dataRoot,
}));

vi.mock('@/lib/odoo-cms-sync', () => ({
  loadCmsSnapshotFromOdoo,
  syncCmsSnapshotToOdoo,
}));

vi.mock('@/lib/storage', () => ({
  deleteManagedImage: vi.fn(async () => undefined),
}));

describe('CMS persistence', () => {
  beforeEach(() => {
    fileStore.clear();
    loadCmsSnapshotFromOdoo.mockClear();
    syncCmsSnapshotToOdoo.mockClear();
    vi.resetModules();
  });

  it('prefers the local CMS file over the Odoo snapshot', async () => {
    const localCms = {
      settings: {
        site_title: 'Local title',
        site_description: 'Local description',
        favicon_url: '/local-favicon.ico',
        logo_url: '/local-logo.png',
      },
      sections: [],
      featured_items: [
        {
          id: 'local-featured',
          title: 'Local featured',
          content_text: 'Local data must win',
          image_url: '/api/image?id=local-featured.webp',
          action_text: 'Open',
          action_link: '/local',
          is_active: true,
          order_index: 0,
        },
      ],
    };

    fileStore.set(cmsFilePath, JSON.stringify(localCms));

    const { getFeaturedItems, getSettings } = await import('@/lib/db');

    await expect(getSettings()).resolves.toMatchObject({
      site_title: 'Local title',
      favicon_url: '/local-favicon.ico',
    });

    await expect(getFeaturedItems()).resolves.toEqual([
      expect.objectContaining({
        id: 'local-featured',
        image_url: '/api/image?id=local-featured.webp',
      }),
    ]);

    expect(loadCmsSnapshotFromOdoo).not.toHaveBeenCalled();
  });
});
