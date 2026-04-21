const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const integrations_path = "/app/data/integrations.json";

function getEncryptionKey(source) {
    return crypto.createHash('sha256').update(source).digest();
}

function encryptSecret(value, keySource) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(keySource), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return [
        'v1',
        iv.toString('base64url'),
        tag.toString('base64url'),
        encrypted.toString('base64url'),
    ].join(':');
}

const client_id = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.CLIENT_ID;
const client_secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.CLIENT_SECRET;
const admin_secret = process.env.ADMIN_SECRET_KEY;

console.log("Environment check:");
console.log("- Client ID present:", !!client_id);
console.log("- Client Secret present:", !!client_secret);
console.log("- Admin Secret present:", !!admin_secret);

if (!client_id || !client_secret || !admin_secret) {
    console.error("Missing credentials in process.env (need GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, AND ADMIN_SECRET_KEY)");
    process.exit(1);
}

try {
    const data = JSON.parse(fs.readFileSync(integrations_path, 'utf8'));

    if (data.google && data.google.production) {
        const prod = data.google.production;
        prod.googleClientId = client_id;
        
        if (!prod.encryptedSecrets) prod.encryptedSecrets = {};
        
        prod.encryptedSecrets.googleClientSecret = encryptSecret(client_secret, admin_secret);
        
        fs.writeFileSync(integrations_path, JSON.stringify(data, null, 2));
        console.log("Successfully encrypted and updated integrations.json in production container.");
    } else {
        console.error("Could not find google.production config in JSON");
    }
} catch (e) {
    console.error("Error updating integrations.json", e);
}
