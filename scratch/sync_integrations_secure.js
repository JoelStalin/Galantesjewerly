const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const integrations_path = "/home/yoeli/galantesjewelry/data/integrations.json";
const env_path = "/home/yoeli/galantesjewelry/.env";

function get_env_var(name) {
    try {
        const env = fs.readFileSync(env_path, 'utf8');
        const lines = env.split('\n');
        for (const line of lines) {
            if (line.startsWith(name + "=")) {
                let val = line.split("=")[1].trim();
                if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                    val = val.slice(1, -1);
                }
                return val;
            }
        }
    } catch (e) {
        console.error('Error reading .env', e);
    }
    return null;
}

const client_id = get_env_var("GOOGLE_OAUTH_CLIENT_ID");
const client_secret = get_env_var("GOOGLE_OAUTH_CLIENT_SECRET");
const admin_secret = get_env_var("ADMIN_SECRET_KEY");

if (!client_id || !client_secret || !admin_secret) {
    console.error("Missing credentials in .env (need client_id, client_secret, AND admin_secret_key)");
    process.exit(1);
}

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

try {
    const data = JSON.parse(fs.readFileSync(integrations_path, 'utf8'));

    if (data.google && data.google.production) {
        const prod = data.google.production;
        prod.googleClientId = client_id;
        
        if (!prod.encryptedSecrets) prod.encryptedSecrets = {};
        
        prod.encryptedSecrets.googleClientSecret = encryptSecret(client_secret, admin_secret);
        
        // Also ensure enabled is true if we have creds, but we still need the owner connected
        // prod.enabled = true; 

        fs.writeFileSync(integrations_path, JSON.stringify(data, null, 2));
        console.log("Successfully encrypted and updated integrations.json production config.");
    } else {
        console.error("Could not find google.production config in JSON");
    }
} catch (e) {
    console.error("Error updating integrations.json", e);
}
