const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// The encryption key is derived from these environment variables. 
// Since I don't have the production .env, I'll use the same fallback logic as secure-settings.ts
function getEncryptionKey() {
  const source = process.env.APPOINTMENT_ENCRYPTION_KEY || 
                process.env.INTEGRATIONS_SECRET_KEY || 
                process.env.ADMIN_SECRET_KEY || 
                'local-fallback-key'; // This might be different from the one used in production

  return crypto.createHash('sha256').update(source).digest();
}

function encryptSecret(value) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

const DATA_FILE = path.join(__dirname, '..', 'data', 'integrations.json');

function updateCredentials() {
  try {
    const content = fs.readFileSync(DATA_FILE, 'utf-8');
    const store = JSON.parse(content);

    const productionGoogle = store.google.production;
    const productionAppts = store.appointments.production;

    console.log('Updating production credentials...');

    // 1. Update Google OAuth Client ID & Secret
    const googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

    if (!googleClientId || !googleClientSecret) {
      throw new Error('Missing GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET environment variables.');
    }

    productionGoogle.googleClientId = googleClientId;
    productionGoogle.encryptedSecrets.googleClientSecret = encryptSecret(googleClientSecret);
    
    // 2. Update Service Account
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const serviceAccountPrivateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!serviceAccountEmail || !serviceAccountPrivateKey) {
      throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY environment variables.');
    }

    productionAppts.googleServiceAccountEmail = serviceAccountEmail;
    productionAppts.encryptedSecrets.googlePrivateKey = encryptSecret(serviceAccountPrivateKey.replace(/\\n/g, '\n'));
tyTIQemVAgMBAAECggEAFIiCPhF/jyUywkr2bVy6/rvdA/qX2wc7oAAxW2DgTXuR
f+pqHtkms6M/ umaC+pqHtkms6M/cxFL9ftf+RBn2mL2TZGhVVHQb7fDRLSFiwToVLMPY7EId4MKM/6S
HXPZnv9kPTgg9AWiqv+Bo9dItFeWaKgahEwQPF3TWoDlOzawK9cElL7yLP9096vE
Y4pcIF6XL2PVm9chCYIeOFvQg9zWyinGlg/2Moa/CvAiwOXUpTXXUmwlbYSEw0By
Ld9jRRK8AkMZy09pBi3EevO9RiJocy02dDLnwsjmGzVSxGx8Nvytge9KjNEFpAqJ
YmI6LlkYlVdKK64+Gf9OXTsiodkfLg7Bq5vpmAkXuQKBgQDb31H8/B9kUTORsbEz
Fv5OlO99EMkUQ3oOr1Ynz2RozeJv64se8Eof6D9Dwm/rICxXApJPQBja/TIGWgTG
lXByOD+eD/YwCRGR5WtxffQeX2HudTaIUVmf9Wpze+w+KNNwy7R8iEl1PkZOc/LG
UAnSF/BQbQ3Nu047oH44iYfwSQKBgQDbdnSgkWVbskdoVu97Ul3WdDVa3kGvlJKt
XOBJWHxeXbk6BN3AdMo4VFrwsVm8CiEQmdUamiYilwVIC1hONeAGP4fdK6Y5xug2
PGkwIZY/ApWe1En4Wa7UoxOpSWb/9bhaLdgeXwbYLx+G1AnlZ+4mc7dfIEJm6a3f
bGwO5RDG7QKBgQCOFNu4bXwjqU13wqnNZ/hh82BnIyetToVbY/Z6t0wdZZ4D0OQP
1BsyTzRCpy0HdbzxZRoC2Fq3eJKRBC693OfTB4IktA/UrqeJ7gTmTAwqbFyuaVQZ
9ufBtCdcBSJ+cIdiBmDVcIR3nQx1ufuSJzqRZyLF9hLLdVRyt52ZD1am8QKBgCh/
vZn7+tZnGeJZWKxLUOHIZCg2p6x9IGw5nXIrkBfh99KLH1jqtH6cooOUVtjqjZuA
p+DW3X64m9LltRAJxSOiCbJ44Z375NJNZ6PoLs/F7FJ5HoVkF21KAtDUqNtHPxP1
LdK8+oheedTpwEHDYiFabVZyn45aRSnb2j0NbIEpAoGBAJJShScsmlAvQ0EGdXsZ
N+bn5HBiFy336ftH1SDxsCHiJOUVku/qAMrDRtAL2UMi+UAOGmtSNZvwc2wQMIxk
KXtQ2givxypmtiM0CxEKzjAhbdX5iPzUHCCTdhh7sh/u3PAKAcH5jWPaXX6W7tH6
M8vT54fMJcpg0amOQonh8AzZ
-----END PRIVATE KEY-----`);

    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
    console.log('Successfully updated integrations.json');
  } catch (error) {
    console.error('Error updating credentials:', error);
    process.exit(1);
  }
}

updateCredentials();
