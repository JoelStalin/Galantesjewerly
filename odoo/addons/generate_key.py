import odoo
from odoo import api, registry, SUPERUSER_ID
reg = registry.get('galantes_db')
with reg.cursor() as cr:
    env = api.Environment(cr, SUPERUSER_ID, {})
    user = env.ref('base.user_admin')
    # Check if a key named NextJS_Production_Key exists or just generate a new one
    # Note: _generate_api_key might not be in all Odoo 19 distributions yet if not enterprise or specific version
    # fallback to manual key generation if necessary.
    try:
        key = user._generate_api_key('NextJS_Production_Key')
        print(key)
    except Exception as e:
        print(f'ERROR: {e}')
