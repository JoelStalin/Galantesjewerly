import { createOdooClient, getOdooConfig } from '@/src/config/odooClient.js';

const IMAGE_ATTACHMENT_MODEL = 'ir.attachment';
const IMAGE_ATTACHMENT_OWNER_MODEL = 'galante.cms.settings';

type OdooAttachmentRecord = {
  id: number;
  datas?: string | null;
  mimetype?: string | null;
  name?: string | null;
};

type StoredOdooImage = {
  contentType: string;
  data: Buffer;
  fileName: string;
};

function getOdooClient() {
  const config = getOdooConfig();
  if (!config.isReady) {
    return null;
  }

  return createOdooClient(config);
}

function toBase64(buffer: Buffer) {
  return buffer.toString('base64');
}

async function findAttachmentByName(storageId: string) {
  const odoo = getOdooClient();
  if (!odoo) {
    return null;
  }

  const records = await odoo.searchRead(IMAGE_ATTACHMENT_MODEL, {
    domain: [
      ['name', '=', storageId],
      ['res_model', '=', IMAGE_ATTACHMENT_OWNER_MODEL],
    ],
    fields: ['id', 'name', 'mimetype'],
    limit: 1,
  }) as OdooAttachmentRecord[];

  return records[0] || null;
}

export async function saveImageToOdoo(storageId: string, buffer: Buffer, contentType: string) {
  const odoo = getOdooClient();
  if (!odoo) {
    return { success: false as const, reason: 'odoo_not_ready' as const };
  }

  const existing = await findAttachmentByName(storageId);
  const vals = {
    name: storageId,
    datas: toBase64(buffer),
    mimetype: contentType,
    type: 'binary',
    public: true,
    res_model: IMAGE_ATTACHMENT_OWNER_MODEL,
  };

  if (existing) {
    await odoo.call(IMAGE_ATTACHMENT_MODEL, 'write', {
      ids: [existing.id],
      vals,
    });
    return { success: true as const, attachmentId: existing.id };
  }

  const createdId = await odoo.create(IMAGE_ATTACHMENT_MODEL, vals);
  return { success: true as const, attachmentId: createdId };
}

export async function loadImageFromOdoo(storageId: string): Promise<StoredOdooImage | null> {
  const odoo = getOdooClient();
  if (!odoo) {
    return null;
  }

  const records = await odoo.searchRead(IMAGE_ATTACHMENT_MODEL, {
    domain: [
      ['name', '=', storageId],
      ['res_model', '=', IMAGE_ATTACHMENT_OWNER_MODEL],
    ],
    fields: ['id', 'name', 'mimetype', 'datas'],
    limit: 1,
  }) as OdooAttachmentRecord[];

  const record = records[0];
  if (!record?.datas) {
    return null;
  }

  return {
    contentType: record.mimetype || 'application/octet-stream',
    data: Buffer.from(record.datas, 'base64'),
    fileName: record.name || storageId,
  };
}

export async function deleteImageFromOdoo(storageId: string) {
  const odoo = getOdooClient();
  if (!odoo) {
    return false;
  }

  const existing = await findAttachmentByName(storageId);
  if (!existing) {
    return false;
  }

  await odoo.call(IMAGE_ATTACHMENT_MODEL, 'unlink', {
    ids: [existing.id],
  });
  return true;
}
