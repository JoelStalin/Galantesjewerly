import { describe, expect, it } from 'vitest';
import {
  buildScanReport,
  buildManifestFromScanReport,
  groupDriveFiles,
  normalizeManifest,
  parseDriveFolderId,
  parseTimestampBucket,
  slugify,
} from '@/lib/products/gdrive-product-import.js';

describe('gdrive-product-import', () => {
  it('normalizes folder URLs to folder ids', () => {
    expect(parseDriveFolderId('https://drive.google.com/drive/folders/abc123?usp=sharing')).toBe('abc123');
    expect(parseDriveFolderId('abc123')).toBe('abc123');
  });

  it('buckets timestamp-named files into 20-minute windows', () => {
    expect(parseTimestampBucket('20260610_103650.jpg')?.key).toBe('20260610_1030-59');
    expect(parseTimestampBucket('20260610_104023.jpg')?.key).toBe('20260610_1030-59');
    expect(parseTimestampBucket('20260610_111148.jpg')?.key).toBe('20260610_1100-29');
  });

  it('groups flat files into stable clusters', () => {
    const clusters = groupDriveFiles([
      { id: '1', name: '20260610_103650.jpg', mimeType: 'image/jpeg', pathParts: [] },
      { id: '2', name: '20260610_104023.jpg', mimeType: 'image/jpeg', pathParts: [] },
      { id: '3', name: '20260610_111148.jpg', mimeType: 'image/jpeg', pathParts: [] },
    ]);

    expect(clusters).toHaveLength(2);
    expect(clusters[0].files).toHaveLength(2);
    expect(clusters[1].files).toHaveLength(1);
  });

  it('builds review-friendly scan reports', () => {
    const report = buildScanReport('2026-07-01T00:00:00.000Z', 'folder-1', [
      { id: '1', name: '20260610_103650.jpg', mimeType: 'image/jpeg', pathParts: [] },
    ]);

    expect(report.totalImages).toBe(1);
    expect(report.totalClusters).toBe(1);
    expect(report.clusters[0]).toMatchObject({
      slug: '20260610-1030-59',
      requiresReview: true,
    });
  });

  it('builds a publish manifest from a scan report', () => {
    const manifest = buildManifestFromScanReport({
      scannedAt: '2026-07-01T00:00:00.000Z',
      folderId: 'folder-1',
      clusters: [
        {
          name: 'Mariner Bond Ring',
          slug: 'mariner-bond-ring',
          sequence: 7,
          files: [{ id: '1', name: '1.jpg', mimeType: 'image/jpeg', pathParts: [] }],
        },
      ],
    });

    expect(manifest.folderId).toBe('folder-1');
    expect(manifest.products).toHaveLength(1);
    expect(manifest.products[0]).toMatchObject({
      name: 'Mariner Bond Ring',
      slug: 'mariner-bond-ring',
      sequence: 7,
    });
  });

  it('normalizes manifest product slugs and categories', () => {
    const manifest = normalizeManifest({
      products: [
        { name: 'Mariner Bond Ring' },
        { slug: 'custom-piece', category: 'Bracelets' },
      ],
    });

    expect(manifest.products[0]).toMatchObject({
      slug: 'mariner-bond-ring',
      category: 'Rings',
      material: 'gold_18k',
    });
    expect(manifest.products[1]).toMatchObject({
      slug: 'custom-piece',
      category: 'Bracelets',
    });
  });

  it('slugifies accented and punctuation-heavy names', () => {
    expect(slugify("Siren's Pearl Necklace")).toBe('sirens-pearl-necklace');
  });
});
