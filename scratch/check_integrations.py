import json

with open('/home/yoeli/galantesjewelry/data/integrations.json') as f:
    d = json.load(f)

g = d['google']['production']
a = d['appointments']['production']

print('=== GOOGLE OAuth Config (production) ===')
print('clientId:', g.get('googleClientId', 'EMPTY')[:60] if g.get('googleClientId') else 'EMPTY')
print('redirectUri:', g.get('redirectUri', 'EMPTY'))
print('javascriptOrigin:', g.get('javascriptOrigin', 'EMPTY'))
print('connectedEmail:', g.get('connectedGoogleEmail', 'NOT CONNECTED'))
secrets_g = g.get('encryptedSecrets', {})
print('clientSecret set:', bool(secrets_g.get('googleClientSecret')))
print('refreshToken set:', bool(secrets_g.get('refreshToken')))
print('accessToken set:', bool(secrets_g.get('accessToken')))

print('')
print('=== APPOINTMENTS Config (production) ===')
print('calendarEnabled:', a.get('googleCalendarEnabled'))
print('calendarId:', a.get('googleCalendarId', 'EMPTY'))
print('serviceAccountEmail:', a.get('googleServiceAccountEmail', 'EMPTY'))
print('recipient:', a.get('gmailRecipientInbox', 'EMPTY'))
print('sender:', a.get('gmailSender', 'EMPTY'))
print('timezone:', a.get('appointmentTimezone', 'EMPTY'))
print('startTime:', a.get('appointmentStartTime', 'EMPTY'))
print('endTime:', a.get('appointmentEndTime', 'EMPTY'))
secrets_a = a.get('encryptedSecrets', {})
print('privateKey set:', bool(secrets_a.get('googlePrivateKey')))
print('gmailSmtpPassword set:', bool(secrets_a.get('gmailSmtpPassword')))
print('sendGridApiKey set:', bool(secrets_a.get('sendGridApiKey')))
