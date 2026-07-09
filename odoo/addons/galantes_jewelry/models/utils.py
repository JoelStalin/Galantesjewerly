from datetime import datetime, timezone
from odoo.exceptions import ValidationError


def _parse_api_datetime(value):
    """Convert ISO-8601 or Odoo datetime strings to naive UTC datetime for fields.Datetime."""
    if not value:
        return False

    if isinstance(value, datetime):
        if value.tzinfo is not None:
            return value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    value = str(value).strip()
    for fmt in (
        '%Y-%m-%dT%H:%M:%S.%fZ',
        '%Y-%m-%dT%H:%M:%SZ',
        '%Y-%m-%dT%H:%M:%S',
        '%Y-%m-%d %H:%M:%S',
    ):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue

    raise ValidationError('Invalid datetime format: %r' % value)
