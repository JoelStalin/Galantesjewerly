function isAuthPath(value: string) {
  return value === '/auth' || value.startsWith('/auth/') || value.startsWith('/auth?') || value.startsWith('/auth#');
}

export function sanitizeCustomerReturnTo(value?: string | null, fallback = '/account/settings') {
  const currentPath = (value || '').trim();

  if (!currentPath || !currentPath.startsWith('/') || currentPath.startsWith('//') || isAuthPath(currentPath)) {
    return fallback;
  }

  return currentPath;
}

export function buildCustomerLoginHref(currentUrl?: string | null) {
  const returnTo = sanitizeCustomerReturnTo(currentUrl, '');

  if (!returnTo) {
    return '/auth/login';
  }

  return `/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
}
