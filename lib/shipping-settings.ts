export type ShippingSettingsShape = {
  shipping_cities?: string[] | null;
  restricted_shipping_cities?: string[] | null;
};

export const DEFAULT_SHIPPING_CITIES = [
  'Islamorada',
  'Key Largo',
  'Tavernier',
  'Marathon',
  'Key West',
  'Miami',
  'Miami Beach',
  'Fort Lauderdale',
];

function normalizeCityValue(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function cityKey(value: string) {
  return normalizeCityValue(value).toLocaleLowerCase();
}

export function normalizeCityList(values?: Array<string | null | undefined> | null) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values || []) {
    if (typeof value !== 'string') {
      continue;
    }

    const city = normalizeCityValue(value);
    if (!city) {
      continue;
    }

    const key = cityKey(city);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(city);
  }

  return normalized;
}

export function sanitizeShippingSettings<T extends ShippingSettingsShape>(settings: T): T {
  const shippingCities = normalizeCityList(settings.shipping_cities || DEFAULT_SHIPPING_CITIES);
  const allowedKeys = new Set(shippingCities.map((city) => cityKey(city)));
  const restricted = normalizeCityList(settings.restricted_shipping_cities).filter((city) => allowedKeys.has(cityKey(city)));

  return {
    ...settings,
    shipping_cities: shippingCities,
    restricted_shipping_cities: restricted,
  };
}

export function getShippingCityCatalog(settings: ShippingSettingsShape) {
  return normalizeCityList(settings.shipping_cities);
}

export function getAllowedShippingCities(settings: ShippingSettingsShape) {
  const catalog = getShippingCityCatalog(settings);
  const restricted = normalizeCityList(settings.restricted_shipping_cities);

  if (catalog.length === 0) {
    return [];
  }

  if (restricted.length === 0) {
    return catalog;
  }

  const restrictedKeys = new Set(restricted.map((city) => cityKey(city)));
  return catalog.filter((city) => restrictedKeys.has(cityKey(city)));
}

export function isShippingCityAllowed(settings: ShippingSettingsShape, city?: string | null) {
  const normalizedCity = typeof city === 'string' ? normalizeCityValue(city) : '';
  if (!normalizedCity) {
    return false;
  }

  const allowed = getAllowedShippingCities(settings);
  if (allowed.length === 0) {
    return true;
  }

  const allowedKeys = new Set(allowed.map((item) => cityKey(item)));
  return allowedKeys.has(cityKey(normalizedCity));
}

export function validateShippingCity(settings: ShippingSettingsShape, city?: string | null) {
  const normalizedCity = typeof city === 'string' ? normalizeCityValue(city) : '';
  const configuredCities = getAllowedShippingCities(settings);

  if (!normalizedCity) {
    if (configuredCities.length > 0) {
      return { valid: false, message: 'Select a shipping city from the list.' };
    }

    return { valid: false, message: 'City is required.' };
  }

  if (configuredCities.length === 0) {
    return { valid: true, city: normalizedCity };
  }

  if (!isShippingCityAllowed(settings, normalizedCity)) {
    return {
      valid: false,
      message: 'Shipping is not available for the selected city.',
    };
  }

  return { valid: true, city: normalizedCity };
}
