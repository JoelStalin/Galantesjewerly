import crypto from 'crypto';

export type MaskedSecretState = {
  isSet: boolean;
  maskedValue: string;
};

function getEncryptionKey() {
  const source =
    process.env.APPOINTMENT_ENCRYPTION_KEY ||
    process.env.INTEGRATIONS_SECRET_KEY ||
    process.env.ADMIN_SECRET_KEY ||
    'local_only_integration_secret_for_development';

  return crypto.createHash('sha256').update(source).digest();
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

export function decryptSecret(payload: string) {
  const [version, ivValue, tagValue, encryptedValue] = payload.split(':');

  if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) {
    throw new Error('Unsupported encrypted secret payload.');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivValue, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function maskEncryptedSecret(encryptedValue?: string): MaskedSecretState {
  if (!encryptedValue) {
    return { isSet: false, maskedValue: '' };
  }

  try {
    const decrypted = decryptSecret(encryptedValue);
    const tail = decrypted.slice(-4);
    return {
      isSet: true,
      maskedValue: tail ? `********${tail}` : '********',
    };
  } catch {
    return {
      isSet: true,
      maskedValue: '********',
    };
  }
}
