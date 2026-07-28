/**
 * Centralized Orca Core Engine Client for Galantes Jewelry Tenant
 * Connects Galantes Jewelry Storefront & Backend directly to GetUpSoft Main Orca Module
 */

export const ORCA_CONFIG = {
  baseUrl: process.env.ORCA_BASE_URL || process.env.NEXT_PUBLIC_ORCA_BASE_URL || 'http://127.0.0.1:4173',
  tenantId: 'galantesjewelry',
  projectId: 'galantesjewelry',
};

export function getOrcaHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-orca-tenant': ORCA_CONFIG.tenantId,
    'x-orca-project': ORCA_CONFIG.projectId,
  };
}

export async function fetchFromOrcaCore(endpoint: string, options: RequestInit = {}) {
  const url = `${ORCA_CONFIG.baseUrl.replace(/\/$/, '')}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getOrcaHeaders(),
      ...(options.headers || {}),
    },
  });
  return response;
}
