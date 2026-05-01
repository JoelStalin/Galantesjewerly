export function buildCustomerLoginHref(currentUrl?: string | null) {
  const currentPath = (currentUrl || '').trim();

  if (!currentPath || !currentPath.startsWith('/') || currentPath.startsWith('/auth/')) {
    return '/auth/login';
  }

  return `/auth/login?returnTo=${encodeURIComponent(currentPath)}`;
}
