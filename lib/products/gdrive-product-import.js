const TIMESTAMP_NAME_RE = /^(?<date>\d{8})_(?<hour>\d{2})(?<minute>\d{2})(?<second>\d{2})/;
const IMAGE_MIME_PREFIX = 'image/';
const TIMESTAMP_BUCKET_MINUTES = 30;

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[^\x00-\x7F]/g, '')
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleCase(value) {
  return String(value || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function inferCategory(text) {
  const value = String(text || '').toLowerCase();
  if (/(earring|stud|drop)/.test(value)) return 'Earrings';
  if (/(necklace|pendant|chain)/.test(value)) return 'Necklaces';
  if (/(bracelet|bangle|cuff|link)/.test(value)) return 'Bracelets';
  if (/(ring|solitaire|band|halo)/.test(value)) return 'Rings';
  if (/(tie bar|cufflink|brooch|pin)/.test(value)) return 'Accessories';
  return 'Other';
}

function inferMaterial(text) {
  const value = String(text || '').toLowerCase();
  if (/(platinum|pt950)/.test(value)) return 'platinum';
  if (/(white gold|white-gold|wg)/.test(value)) return 'white_gold';
  if (/(rose gold|rose-gold|rg)/.test(value)) return 'rose_gold_14k';
  if (/(18k|18 kt|750)/.test(value)) return 'gold_18k';
  if (/(14k|14 kt|585)/.test(value)) return 'gold_14k';
  if (/(silver|925)/.test(value)) return 'silver_925';
  return 'gold_18k';
}

function describeImageCount(count) {
  if (count <= 1) return '1 image';
  return `${count} images`;
}

function parseTimestampBucket(fileName) {
  const match = String(fileName || '').match(TIMESTAMP_NAME_RE);
  if (!match?.groups) return null;

  const minute = Number(match.groups.minute);
  const bucketStart = Math.floor(minute / TIMESTAMP_BUCKET_MINUTES) * TIMESTAMP_BUCKET_MINUTES;
  const bucketEnd = bucketStart + TIMESTAMP_BUCKET_MINUTES - 1;
  const bucketLabel = `${match.groups.date}_${match.groups.hour}${String(bucketStart).padStart(2, '0')}-${String(bucketEnd).padStart(2, '0')}`;

  return {
    key: bucketLabel,
    label: `${match.groups.date} ${match.groups.hour}:${String(bucketStart).padStart(2, '0')}–${match.groups.hour}:${String(bucketEnd).padStart(2, '0')}`,
  };
}

function normalizeFolderPath(pathParts = []) {
  return pathParts.filter(Boolean).map((part) => titleCase(part));
}

function buildClusterLabel(pathParts, files) {
  if (pathParts.length > 0) {
    return pathParts[pathParts.length - 1];
  }

  const firstTimestamp = files.map((file) => parseTimestampBucket(file.name)).find(Boolean);
  if (firstTimestamp) {
    return firstTimestamp.label;
  }

  const firstStem = String(files[0]?.name || 'Drive Product').replace(/\.[^.]+$/, '');
  return titleCase(firstStem);
}

function isImageFile(file) {
  return typeof file?.mimeType === 'string' && file.mimeType.startsWith(IMAGE_MIME_PREFIX);
}

function groupDriveFiles(files) {
  const groups = new Map();

  for (const file of files) {
    if (!isImageFile(file)) continue;

    const pathParts = normalizeFolderPath(file.pathParts || []);
    const folderKey = pathParts.join('/');
    const timestampBucket = parseTimestampBucket(file.name);
    const clusterKey = folderKey || timestampBucket?.key || slugify(file.name);

    if (!groups.has(clusterKey)) {
      groups.set(clusterKey, {
        key: clusterKey,
        pathParts,
        sourceType: folderKey ? 'folder' : timestampBucket ? 'timestamp-bucket' : 'single-file',
        files: [],
      });
    }

    groups.get(clusterKey).files.push(file);
  }

  return Array.from(groups.values()).map((group) => {
    const sortedFiles = [...group.files].sort((left, right) => {
      const leftDate = left.modifiedTime || left.name;
      const rightDate = right.modifiedTime || right.name;
      return String(leftDate).localeCompare(String(rightDate));
    });

    return {
      ...group,
      files: sortedFiles,
      label: buildClusterLabel(group.pathParts, sortedFiles),
    };
  }).sort((left, right) => left.label.localeCompare(right.label));
}

function buildProductDraftFromCluster(cluster, index) {
  const clusterName = cluster.label || `Drive Product ${index + 1}`;
  const requiresReview = cluster.sourceType === 'timestamp-bucket';
  const productName = requiresReview ? '' : titleCase(clusterName);
  const slug = slugify(requiresReview ? cluster.key : productName);
  const category = inferCategory(requiresReview ? cluster.label : productName);
  const material = inferMaterial(`${requiresReview ? cluster.label : productName} ${cluster.pathParts?.join(' ') || ''}`);
  const countLabel = describeImageCount(cluster.files.length);
  const imageContext = requiresReview
    ? 'detected in a flat Drive folder and waiting for a real product name'
    : cluster.pathParts?.length
      ? `grouped from ${cluster.pathParts.join(' / ')}`
      : 'grouped from a single Drive file';

  return {
    sourceKey: cluster.key,
    sourceType: cluster.sourceType,
    folderPath: cluster.pathParts || [],
    name: productName,
    slug,
    category,
    material,
    sequence: index + 1,
    isFeatured: index === 0,
    requiresReview,
    tagline: requiresReview
      ? `${countLabel} require manual naming before publish`
      : `${productName} with ${countLabel} from Google Drive`,
    shortDescription: requiresReview
      ? `This cluster was ${imageContext}. Add a real product name or move it into a named Drive folder before publishing.`
      : `${productName} is ready for publication from ${imageContext}.`,
    longDescription: requiresReview
      ? 'Imported from Google Drive but marked for review because the folder structure did not provide a real product name. The product will not publish until it is renamed or organized into a named folder.'
      : `Imported from Google Drive and prepared for Odoo publication. The image set contains ${countLabel}, with the first file treated as the primary storefront image.`,
    productDetails: requiresReview
      ? `Source: Google Drive cluster ${cluster.key} · Images: ${cluster.files.length} · Review required before publish`
      : `Source: Google Drive cluster ${cluster.key} · Images: ${cluster.files.length} · Suggested category: ${category} · Suggested material: ${material}`,
    careAndShipping: 'Ships in Galante\'s gift-ready packaging. Professional cleaning recommended for regular wear. Verify final copy before publishing.',
    files: cluster.files,
  };
}

function buildDraftsFromClusters(clusters) {
  return clusters.map((cluster, index) => buildProductDraftFromCluster(cluster, index));
}

function buildScanReport(scannedAt, folderId, files) {
  const clusters = groupDriveFiles(files);

  return {
    scannedAt,
    folderId,
    totalFiles: files.length,
    totalImages: files.filter(isImageFile).length,
    totalClusters: clusters.length,
    clusters: buildDraftsFromClusters(clusters),
  };
}

function buildManifestFromScanReport(scanReport) {
  const clusters = Array.isArray(scanReport?.clusters) ? scanReport.clusters : [];

  return {
    scannedAt: scanReport?.scannedAt || new Date().toISOString(),
    folderId: scanReport?.folderId || '',
    products: clusters.map((cluster, index) => ({
      ...cluster,
      sequence: Number.isFinite(cluster.sequence) ? cluster.sequence : index + 1,
    })),
  };
}

function parseDriveFolderId(input) {
  if (!input) return '';
  const trimmed = String(input).trim();
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : trimmed;
}

function normalizeManifest(manifest) {
  const products = Array.isArray(manifest?.products) ? manifest.products : [];

  return {
    ...manifest,
    products: products.map((product, index) => {
      const requiresReview = Boolean(product.requiresReview);
      const name = product.name || (requiresReview ? '' : titleCase(product.slug || `Drive Product ${index + 1}`));
      const slug = product.slug || slugify(name || `Drive Product ${index + 1}`);

      return {
        ...product,
        requiresReview,
        name,
        slug,
        category: product.category || inferCategory(name),
        material: product.material || inferMaterial(name),
        sequence: Number.isFinite(product.sequence) ? product.sequence : index + 1,
      };
    }),
  };
}

function buildProductPayload(product, imageBase64) {
  const payload = {
    name: product.name,
    slug: product.slug,
    default_code: product.default_code || `GJ-DRIVE-${String(product.sequence || 1).padStart(3, '0')}`,
    list_price: Number(product.list_price || 0),
    type: product.type || 'consu',
    available_on_website: product.available_on_website ?? true,
    is_featured: product.is_featured ?? product.isFeatured ?? false,
    sequence: product.sequence ?? 10,
    material: product.material || null,
    tagline: product.tagline || '',
    storefront_short_description: product.shortDescription || '',
    storefront_long_description: product.longDescription || '',
    product_details: product.productDetails || '',
    care_and_shipping: product.careAndShipping || '',
    description_sale: product.shortDescription || product.tagline || product.name,
    detailed_type: 'consu',
  };

  if (imageBase64) {
    payload.image_1920 = imageBase64;
  }

  return payload;
}

export {
  buildDraftsFromClusters,
  buildManifestFromScanReport,
  buildProductPayload,
  buildScanReport,
  groupDriveFiles,
  inferCategory,
  inferMaterial,
  normalizeManifest,
  parseDriveFolderId,
  parseTimestampBucket,
  slugify,
  titleCase,
};
