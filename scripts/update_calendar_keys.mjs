import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

// Import the encryption logic from the actual app to ensure compatibility
import { encryptSecret } from '../lib/secure-settings.js';

const DATA_FILE = path.join(process.cwd(), 'data', 'integrations.json');

async function updateCredentials() {
  try {
    const content = await fs.readFile(DATA_FILE, 'utf-8');
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

    await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
    console.log('Successfully updated integrations.json');
  } catch (error) {
    console.error('Error updating credentials:', error);
    process.exit(1);
  }
}

updateCredentials();
