"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  googleSecretFields,
  integrationEnvironments,
  type GoogleIntegrationAdminConfig,
  type GoogleSecretField,
  type IntegrationAuditEntry,
  type IntegrationEnvironment,
} from '@/lib/integration-types';

type NoticeState = {
  message: string;
  tone: 'error' | 'success';
};

type ConfigMap = Record<IntegrationEnvironment, GoogleIntegrationAdminConfig>;
type PendingSecrets = Partial<Record<GoogleSecretField, string>>;

const secretLabels: Record<GoogleSecretField, string> = {
  googleClientSecret: 'Google Client Secret',
  apiKey: 'Google API Key',
  accessToken: 'Access Token',
  refreshToken: 'Refresh Token',
};

function toConfigMap(configs: GoogleIntegrationAdminConfig[]) {
  return configs.reduce((accumulator, config) => {
    accumulator[config.environment] = config;
    return accumulator;
  }, {} as Partial<ConfigMap>) as ConfigMap;
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Never';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function splitScopes(value: string) {
  return value.split(/[\s,]+/).map((scope) => scope.trim()).filter(Boolean);
}

export default function IntegrationsPanel() {
  const [configs, setConfigs] = useState<ConfigMap | null>(null);
  const [audit, setAudit] = useState<IntegrationAuditEntry[]>([]);
  const [activeEnvironment, setActiveEnvironment] = useState<IntegrationEnvironment>('production');
  const [pendingSecrets, setPendingSecrets] = useState<Record<IntegrationEnvironment, PendingSecrets>>({
    development: {},
    staging: {},
    production: {},
  });
  const [clearSecrets, setClearSecrets] = useState<Record<IntegrationEnvironment, GoogleSecretField[]>>({
    development: [],
    staging: [],
    production: [],
  });
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const loadIntegrations = async () => {
      try {
        const response = await fetch('/api/admin/integrations');

        if (response.status === 401) {
          window.location.replace('/admin/login');
          return;
        }

        if (!response.ok) {
          throw new Error('load_failed');
        }

        const data = await response.json();
        setConfigs(toConfigMap(data.configs || []));
        setAudit(data.audit || []);
      } catch {
        setNotice({ message: 'Could not load integration settings.', tone: 'error' });
      } finally {
        setLoading(false);
      }
    };

    loadIntegrations();
  }, []);

  const activeConfig = configs?.[activeEnvironment] || null;
  const scopeText = useMemo(() => activeConfig?.scopes.join(' ') || '', [activeConfig]);

  const updateActiveConfig = (updates: Partial<GoogleIntegrationAdminConfig>) => {
    if (!activeConfig || !configs) {
      return;
    }

    setConfigs({
      ...configs,
      [activeEnvironment]: {
        ...activeConfig,
        ...updates,
      },
    });
  };

  const updateSecretDraft = (field: GoogleSecretField, value: string) => {
    setPendingSecrets((current) => ({
      ...current,
      [activeEnvironment]: {
        ...current[activeEnvironment],
        [field]: value,
      },
    }));
  };

  const toggleClearSecret = (field: GoogleSecretField, checked: boolean) => {
    setClearSecrets((current) => {
      const currentFields = new Set(current[activeEnvironment]);
      if (checked) {
        currentFields.add(field);
      } else {
        currentFields.delete(field);
      }

      return {
        ...current,
        [activeEnvironment]: [...currentFields],
      };
    });
  };

  const saveIntegration = async () => {
    if (!activeConfig) {
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const response = await fetch('/api/admin/integrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'google',
          environment: activeEnvironment,
          enabled: activeConfig.enabled,
          googleClientId: activeConfig.googleClientId,
          javascriptOrigin: activeConfig.javascriptOrigin,
          redirectUri: activeConfig.redirectUri,
          scopes: activeConfig.scopes,
          secrets: pendingSecrets[activeEnvironment],
          clearSecrets: clearSecrets[activeEnvironment],
        }),
      });

      if (response.status === 401) {
        window.location.replace('/admin/login');
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'save_failed');
      }

      setConfigs((current) => current ? {
        ...current,
        [activeEnvironment]: data.config,
      } : current);
      setAudit(data.audit || []);
      setPendingSecrets((current) => ({ ...current, [activeEnvironment]: {} }));
      setClearSecrets((current) => ({ ...current, [activeEnvironment]: [] }));
      setNotice({
        message: data.changedFields?.length
          ? `Google integration saved: ${data.changedFields.join(', ')}.`
          : 'No changes detected.',
        tone: 'success',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save integration settings.';
      setNotice({ message, tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const testIntegration = async () => {
    setTesting(true);
    setNotice(null);

    try {
      const response = await fetch('/api/admin/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environment: activeEnvironment }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'connection_test_failed');
      }

      const auditEntry: IntegrationAuditEntry = {
        id: `local-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor: 'admin',
        provider: 'google',
        environment: activeEnvironment,
        action: 'test',
        changedFields: ['connectionTest'],
        ipAddress: 'local',
        userAgent: 'browser',
      };

      setAudit((current) => [auditEntry, ...current].slice(0, 100));
      setNotice({ message: `Google discovery OK. Redirect URI: ${data.redirectUri}`, tone: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not test Google integration.';
      setNotice({ message, tone: 'error' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-8 text-sm text-zinc-500">
        Loading integration settings...
      </div>
    );
  }

  if (!activeConfig) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-sm text-red-700">
        Google integration settings are not available.
      </div>
    );
  }

  return (
    <div data-testid="integrations-panel" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {notice && (
        <div
          data-testid="integration-notice"
          className={`rounded-lg border px-4 py-3 text-sm ${notice.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}
        >
          {notice.message}
        </div>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-zinc-100 pb-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-600">Google OAuth 2.0</p>
            <h2 className="mt-2 text-xl font-serif text-zinc-900">Sign in with Google</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              Client secrets, tokens, and API keys are stored encrypted on the server. The browser only receives masked values.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {integrationEnvironments.map((environment) => (
              <button
                key={environment}
                data-testid={`integration-env-${environment}`}
                onClick={() => setActiveEnvironment(environment)}
                className={`rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${activeEnvironment === environment ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'}`}
              >
                {environment}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <label className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-700 lg:col-span-2">
            <input
              data-testid="integration-enabled"
              type="checkbox"
              checked={activeConfig.enabled}
              onChange={(event) => updateActiveConfig({ enabled: event.target.checked })}
              className="h-4 w-4 accent-amber-500"
            />
            Enable Google login for {activeEnvironment}
          </label>

          <div>
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Google Client ID</label>
            <input
              data-testid="google-client-id"
              type="text"
              value={activeConfig.googleClientId}
              onChange={(event) => updateActiveConfig({ googleClientId: event.target.value })}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm outline-none transition-all focus:bg-white focus:ring-2 focus:ring-amber-300"
              placeholder="Generated in Google Cloud"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Authorized JavaScript Origin</label>
            <input
              data-testid="google-javascript-origin"
              type="url"
              value={activeConfig.javascriptOrigin}
              onChange={(event) => updateActiveConfig({ javascriptOrigin: event.target.value })}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm outline-none transition-all focus:bg-white focus:ring-2 focus:ring-amber-300"
              autoComplete="off"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Authorized Redirect URI</label>
            <input
              data-testid="google-redirect-uri"
              type="url"
              value={activeConfig.redirectUri}
              onChange={(event) => updateActiveConfig({ redirectUri: event.target.value })}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm outline-none transition-all focus:bg-white focus:ring-2 focus:ring-amber-300"
              autoComplete="off"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">OAuth Scopes</label>
            <input
              data-testid="google-scopes"
              type="text"
              value={scopeText}
              onChange={(event) => updateActiveConfig({ scopes: splitScopes(event.target.value) })}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm outline-none transition-all focus:bg-white focus:ring-2 focus:ring-amber-300"
              autoComplete="off"
            />
            <p className="mt-2 text-xs text-zinc-400">Recommended minimum for ecommerce login: openid email profile.</p>
          </div>
        </div>

        <div className="mt-8 border-t border-zinc-100 pt-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-700">Encrypted Values</h3>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {googleSecretFields.map((field) => {
              const secretState = activeConfig.secrets[field];
              const clearChecked = clearSecrets[activeEnvironment].includes(field);

              return (
                <div key={field} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    {secretLabels[field]}
                  </label>
                  <input
                    data-testid={`google-secret-${field}`}
                    type="password"
                    value={pendingSecrets[activeEnvironment][field] || ''}
                    onChange={(event) => updateSecretDraft(field, event.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm outline-none transition-all focus:ring-2 focus:ring-amber-300"
                    placeholder={secretState.isSet ? secretState.maskedValue : 'Not stored'}
                    autoComplete="new-password"
                  />
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-zinc-500">
                    <span>{secretState.isSet ? `Stored as ${secretState.maskedValue}` : 'No stored value'}</span>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={clearChecked}
                        onChange={(event) => toggleClearSecret(field, event.target.checked)}
                        className="h-3.5 w-3.5 accent-red-500"
                      />
                      Clear on save
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-zinc-100 pt-6 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-zinc-500">
            Last update: {formatDate(activeConfig.updatedAt)} by {activeConfig.updatedBy || 'system'}.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              data-testid="test-google-integration"
              onClick={testIntegration}
              disabled={testing}
              className="rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
            >
              {testing ? 'Testing...' : 'Test Google Discovery'}
            </button>
            <button
              data-testid="save-google-integration"
              onClick={saveIntegration}
              disabled={saving}
              className="rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-600 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Integration'}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-700">Audit Log</h3>
        {audit.length === 0 ? (
          <p className="text-sm text-zinc-500">No integration changes recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {audit.slice(0, 8).map((entry) => (
              <div key={entry.id} className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3 text-xs text-zinc-600">
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <span className="font-semibold text-zinc-800">{entry.action.toUpperCase()} / {entry.environment}</span>
                  <span>{formatDate(entry.timestamp)}</span>
                </div>
                <p className="mt-1">
                  {entry.actor} changed {entry.changedFields.join(', ')} from {entry.ipAddress}.
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
