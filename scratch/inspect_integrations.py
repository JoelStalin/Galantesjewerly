import json

with open('/home/yoeli/galantesjewelry/data/integrations.json') as f:
    d = json.load(f)

print('Top-level keys:', list(d.keys()))

# Try to find google config key
for k in d.keys():
    if 'google' in k.lower() or 'config' in k.lower() or 'appointment' in k.lower():
        print(f'Key {k}: sub-keys = {list(d[k].keys()) if isinstance(d[k], dict) else type(d[k])}')
