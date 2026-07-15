"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  appointmentSecretFields,
  integrationEnvironments,
  type AppointmentIntegrationAdminConfig,
  type AppointmentSecretField,
  type GoogleIntegrationAdminConfig,
  type IntegrationAuditEntry,
  type IntegrationEnvironment,
} from '@/lib/integration-types';

type NoticeState = {
  message: string;
  tone: 'error' | 'success';
};

type ConfigMap = Record<IntegrationEnvironment, GoogleIntegrationAdminConfig>;
type AppointmentConfigMap = Record<IntegrationEnvironment, AppointmentIntegrationAdminConfig>;
type PendingAppointmentSecrets = Partial<Record<AppointmentSecretField, string>>;

const adminGoogleScopes = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/gmail.send',
] as const;

const appointmentSecretLabels: Record<AppointmentSecretField, string> = {
  googlePrivateKey: 'Google Private Key',
  gmailSmtpPassword: 'Gmail SMTP App Password',
  sendGridApiKey: 'SendGrid API Key',
};

const weekdayOptions = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

function toConfigMap<T extends { environment: IntegrationEnvironment }>(configs: T[]) {
  return configs.reduce((accumulator, config) => {
    accumulator[config.environment] = config;
    return accumulator;
  }, {} as Partial<Record<IntegrationEnvironment, T>>) as Record<IntegrationEnvironment, T>;
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

export default function IntegrationsPanel() {
  const [configs, setConfigs] = useState<ConfigMap | null>(null);
  const [appointmentConfigs, setAppointmentConfigs] = useState<AppointmentConfigMap | null>(null);
  const [audit, setAudit] = useState<IntegrationAuditEntry[]>([]);
  const [activeEnvironment, setActiveEnvironment] = useState<IntegrationEnvironment>('production');
  
  const [pendingAppointmentSecrets, setPendingAppointmentSecrets] = useState<Record<IntegrationEnvironment, PendingAppointmentSecrets>>({
    development: {},
    staging: {},
    production: {},
  });
  const [clearAppointmentSecrets, setClearAppointmentSecrets] = useState<Record<IntegrationEnvironment, AppointmentSecretField[]>>({
    development: [],
    staging: [],
    production: [],
  });

  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [origin, setOrigin] = useState('');
  const [jsonContent, setJsonContent] = useState('');
  const [importingJson, setImportingJson] = useState(false);
  const [serviceAccountJson, setServiceAccountJson] = useState('');
  const [importingServiceAccount, setImportingServiceAccount] = useState(false);
  const [uploadingOAuthFile, setUploadingOAuthFile] = useState(false);
  const [uploadingServiceFile, setUploadingServiceFile] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);

    const params = new URLSearchParams(window.location.search);
    const oauthResult = params.get('google_owner_oauth');
    const oauthDetail = params.get('oauth_detail');
    if (oauthResult === 'connected') {
      setNotice({ message: '✓ Google account connected successfully. Token saved and ready.', tone: 'success' });
    } else if (oauthResult === 'missing_client') {
      setNotice({ message: 'OAuth failed: Client ID or Client Secret not found. Please import the Google OAuth JSON first (Step 1).', tone: 'error' });
    } else if (oauthResult === 'error') {
      const detail = oauthDetail ? decodeURIComponent(oauthDetail) : '';
      const baseMsg = 'Google OAuth failed.';
      const detailMsg = detail
        ? `${baseMsg} ${detail}`
        : `${baseMsg} Check the server logs for details. Common causes: state cookie lost through Cloudflare, redirect URI mismatch, or consent screen timeout.`;
      setNotice({ message: detailMsg, tone: 'error' });
    }
    
    if (oauthResult) {
      params.delete('google_owner_oauth');
      const clean = [window.location.pathname, params.toString() ? `?${params.toString()}` : ''].join('');
      window.history.replaceState({}, '', clean);
    }

    const loadIntegrations = async () => {
      try {
        const response = await fetch('/api/admin/integrations');
        if (response.status === 401) {
          window.location.replace('/admin/login');
          return;
        }
        if (!response.ok) throw new Error('load_failed');

        const data = await response.json();
        setConfigs(toConfigMap<GoogleIntegrationAdminConfig>(data.configs || []) as ConfigMap);
        setAppointmentConfigs(toConfigMap<AppointmentIntegrationAdminConfig>(data.appointmentConfigs || []) as AppointmentConfigMap);
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
  const activeAppointmentConfig = appointmentConfigs?.[activeEnvironment] || null;
  const isGoogleConnected = !!(
    activeConfig?.connectedGoogleEmail || activeConfig?.secrets?.refreshToken?.isSet
  );
  
  const ownerCallbackUrl = origin
    ? `${origin}/api/admin/google/oauth/callback`
    : '/api/admin/google/oauth/callback';

  const updateActiveConfig = (updates: Partial<GoogleIntegrationAdminConfig>) => {
    if (!activeConfig || !configs) return;
    setConfigs({ ...configs, [activeEnvironment]: { ...activeConfig, ...updates } });
  };

  const updateActiveAppointmentConfig = (updates: Partial<AppointmentIntegrationAdminConfig>) => {
    if (!activeAppointmentConfig || !appointmentConfigs) return;
    setAppointmentConfigs({ ...appointmentConfigs, [activeEnvironment]: { ...activeAppointmentConfig, ...updates } });
  };

  const updateAppointmentSecretDraft = (field: AppointmentSecretField, value: string) => {
    setPendingAppointmentSecrets((current) => ({
      ...current,
      [activeEnvironment]: { ...current[activeEnvironment], [field]: value },
    }));
  };

  const toggleClearAppointmentSecret = (field: AppointmentSecretField, checked: boolean) => {
    setClearAppointmentSecrets((current) => {
      const currentFields = new Set(current[activeEnvironment]);
      if (checked) currentFields.add(field); else currentFields.delete(field);
      return { ...current, [activeEnvironment]: [...currentFields] };
    });
  };

  const importServiceAccountJson = async () => {
    if (!serviceAccountJson.trim()) return;

    setImportingServiceAccount(true);
    setNotice(null);

    try {
      const response = await fetch('/api/admin/integrations/service-account-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          environment: activeEnvironment,
          jsonContent: serviceAccountJson.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Import failed');

      setNotice({ message: `✓ Service account imported: ${data.serviceAccountEmail}. Google Calendar is now configured.`, tone: 'success' });
      setServiceAccountJson('');
      setAppointmentConfigs((current) => current ? { ...current, [activeEnvironment]: data.config } : current);
      setAudit(data.audit || []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Import failed';
      setNotice({ message, tone: 'error' });
    } finally {
      setImportingServiceAccount(false);
    }
  };

  const importGoogleJson = async () => {
    if (!jsonContent.trim()) return;
    
    setImportingJson(true);
    setNotice(null);

    try {
      const response = await fetch('/api/admin/integrations/google-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          environment: activeEnvironment,
          jsonContent: jsonContent.trim()
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Import failed');

      setNotice({ message: '✓ Google Cloud configuration imported and saved.', tone: 'success' });
      setJsonContent('');
      
      const refreshRes = await fetch('/api/admin/integrations');
      const refreshData = await refreshRes.json();
      setConfigs(toConfigMap<GoogleIntegrationAdminConfig>(refreshData.configs || []) as ConfigMap);

    } catch (error: any) {
      setNotice({ message: error.message, tone: 'error' });
    } finally {
      setImportingJson(false);
    }
  };

  const handleOAuthFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingOAuthFile(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setJsonContent(content);
      setUploadingOAuthFile(false);
    };
    reader.onerror = () => {
      setNotice({ message: 'Error reading the JSON file. Please try again.', tone: 'error' });
      setUploadingOAuthFile(false);
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleServiceAccountFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingServiceFile(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setServiceAccountJson(content);
      setUploadingServiceFile(false);
    };
    reader.onerror = () => {
      setNotice({ message: 'Error reading the Service Account JSON file. Please try again.', tone: 'error' });
      setUploadingServiceFile(false);
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const saveIntegrationState = async () => {
    if (!activeConfig) return;
    setSaving(true);
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
        }),
      });
      if (!response.ok) throw new Error('Save failed');
      setNotice({ message: '✓ Status updated.', tone: 'success' });
    } catch (error: any) {
      setNotice({ message: error.message, tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const saveAppointmentIntegration = async () => {
    if (!activeAppointmentConfig) return;
    setSaving(true);
    setNotice(null);

    try {
      const response = await fetch('/api/admin/integrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'appointments',
          environment: activeEnvironment,
          googleCalendarEnabled: activeAppointmentConfig.googleCalendarEnabled,
          googleCalendarId: activeAppointmentConfig.googleCalendarId,
          googleServiceAccountEmail: activeAppointmentConfig.googleServiceAccountEmail,
          gmailNotificationsEnabled: activeAppointmentConfig.gmailNotificationsEnabled,
          gmailRecipientInbox: activeAppointmentConfig.gmailRecipientInbox,
          gmailSender: activeAppointmentConfig.gmailSender,
          appointmentDurationMinutes: activeAppointmentConfig.appointmentDurationMinutes,
          appointmentTimezone: activeAppointmentConfig.appointmentTimezone,
          appointmentStartTime: activeAppointmentConfig.appointmentStartTime,
          appointmentEndTime: activeAppointmentConfig.appointmentEndTime,
          appointmentSlotIntervalMinutes: activeAppointmentConfig.appointmentSlotIntervalMinutes,
          appointmentAvailableWeekdays: activeAppointmentConfig.appointmentAvailableWeekdays,
          secrets: pendingAppointmentSecrets[activeEnvironment],
          clearSecrets: clearAppointmentSecrets[activeEnvironment],
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'save_failed');

      setAppointmentConfigs((current) => current ? { ...current, [activeEnvironment]: data.config } : current);
      setAudit(data.audit || []);
      setPendingAppointmentSecrets((current) => ({ ...current, [activeEnvironment]: {} }));
      setClearAppointmentSecrets((current) => ({ ...current, [activeEnvironment]: [] }));
      setNotice({ message: '✓ Appointment settings saved.', tone: 'success' });
    } catch (error: any) {
      setNotice({ message: error.message, tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const connectGoogleOwnerAccount = () => {
    window.location.href = `/api/admin/google/oauth/start?environment=${activeEnvironment}`;
  };

  if (loading) return <div className="p-8 text-sm text-zinc-500">Loading integration settings...</div>;
  if (!activeConfig || !activeAppointmentConfig) return <div className="p-8 text-sm text-red-700">Settings not available.</div>;

  return (
    <div className="space-y-6">
      {notice && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${notice.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {notice.message}
        </div>
      )}

      {/* --- UNIFIED GOOGLE INTEGRATION SECTION --- */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-zinc-100 pb-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-600">Unified Integration</p>
            <h2 className="mt-2 text-xl font-serif text-zinc-900">Google Services & Appointments</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {integrationEnvironments.map((env) => (
              <button
                key={env}
                onClick={() => setActiveEnvironment(env)}
                className={`rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${activeEnvironment === env ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'}`}
              >
                {env}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-8">
          {/* Main Connection Status */}
          <div className={`rounded-lg border p-6 transition-all ${isGoogleConnected ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-800">Connection Status</h3>
                  {isGoogleConnected ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">Online</span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">Setup Required</span>
                  )}
                </div>
                <p className="mt-2 text-xs leading-5 text-zinc-600 max-w-xl">
                  {isGoogleConnected 
                    ? `Currently synchronized with ${activeConfig.connectedGoogleEmail || 'your Google account'}. This account is used for manage your appointments calendar and send notification emails.`
                    : 'Connect your Google account to enable appointment booking, automated calendar syncing, and professional email notifications.'}
                </p>
                {isGoogleConnected && (
                   <div className="mt-4 flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${activeAppointmentConfig.googleCalendarEnabled ? 'bg-emerald-500' : 'bg-zinc-300'}`} title="Calendar" />
                        <span className="text-[10px] uppercase font-bold text-zinc-500">Calendar</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${activeAppointmentConfig.gmailNotificationsEnabled ? 'bg-emerald-500' : 'bg-zinc-300'}`} title="Gmail" />
                        <span className="text-[10px] uppercase font-bold text-zinc-500">Email Notifications</span>
                      </div>
                   </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={connectGoogleOwnerAccount}
                  disabled={!activeConfig.googleClientId}
                  className={`shrink-0 rounded-lg px-6 py-3 text-sm font-bold shadow-sm transition-all active:scale-95 ${!activeConfig.googleClientId ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed' : (isGoogleConnected ? 'bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-100' : 'bg-zinc-900 text-white hover:bg-amber-600')}`}
                >
                  {isGoogleConnected ? 'Reconnect Google Account' : 'Connect Google Account'}
                </button>
                {!activeConfig.googleClientId && (
                  <p className="text-[10px] text-center text-red-500 font-medium italic">Client ID missing (See Step 1 below)</p>
                )}
              </div>
            </div>
          </div>

          {/* Quick Settings Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
             <div className="space-y-4">
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Core Configuration</h4>
                
                <div className="space-y-3">
                  <label className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-white transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeAppointmentConfig.googleCalendarEnabled}
                      onChange={(event) => updateActiveAppointmentConfig({ googleCalendarEnabled: event.target.checked })}
                      className="h-4 w-4 accent-amber-500"
                    />
                    Enable Appointments Module
                  </label>

                  <label className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-white transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeAppointmentConfig.gmailNotificationsEnabled}
                      onChange={(event) => updateActiveAppointmentConfig({ gmailNotificationsEnabled: event.target.checked })}
                      className="h-4 w-4 accent-amber-500"
                    />
                    Enable Email Notifications
                  </label>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Calendar ID</label>
                  <input
                    type="text"
                    value={activeAppointmentConfig.googleCalendarId}
                    onChange={(event) => updateActiveAppointmentConfig({ googleCalendarId: event.target.value })}
                    className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-amber-200 transition-all font-mono"
                    placeholder="primary"
                  />
                </div>
             </div>

             <div className="space-y-4">
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Email Routing</h4>
                
                <div className="space-y-3">
                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Notifications Recipient</label>
                    <input
                      type="email"
                      value={activeAppointmentConfig.gmailRecipientInbox}
                      onChange={(event) => updateActiveAppointmentConfig({ gmailRecipientInbox: event.target.value })}
                      className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-amber-200 transition-all"
                      placeholder="ceo@galantesjewelry.com"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Sender Display Name (Optional)</label>
                    <input
                      type="email"
                      value={activeAppointmentConfig.gmailSender}
                      onChange={(event) => updateActiveAppointmentConfig({ gmailSender: event.target.value })}
                      className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-amber-200 transition-all"
                      placeholder="notifications@galantesjewelry.com"
                    />
                  </div>
                </div>
             </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-zinc-100">
             <button
              onClick={saveAppointmentIntegration}
              disabled={saving}
              className="rounded-lg bg-zinc-900 px-8 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-zinc-200 transition-all hover:bg-amber-600 active:scale-95 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Apply All Settings'}
            </button>
          </div>
        </div>
      </div>

      {/* --- ADVANCED / DEVELOPER SETTINGS --- */}
      <details className="group rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between p-6 text-sm font-semibold uppercase tracking-widest text-zinc-500 hover:bg-zinc-50 transition-colors">
          <span>Advanced Developer Settings (Client ID / API Keys)</span>
          <span className="text-zinc-300 group-open:rotate-180 transition-transform">▼</span>
        </summary>
        
        <div className="p-6 border-t border-zinc-100 space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* Client ID Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-zinc-800">1. OAuth 2.0 Credentials</h3>
            <p className="text-xs text-zinc-500 leading- relaxed">
              Update the <strong>OAuth 2.0 Client ID</strong> and <strong>Secret</strong> from Google Cloud Console. 
              Upload JSON for automatic setup or manually update below.
            </p>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-[10px] font-bold uppercase tracking-tighter text-amber-700 transition-colors hover:bg-amber-100">
                {uploadingOAuthFile ? 'Reading...' : '📁 Upload OAuth JSON'}
                <input type="file" accept=".json,application/json" onChange={handleOAuthFileUpload} className="hidden" disabled={uploadingOAuthFile} />
              </label>
              <textarea
                rows={3}
                value={jsonContent}
                onChange={(e) => setJsonContent(e.target.value)}
                className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-[10px] font-mono outline-none focus:ring-2 focus:ring-amber-200"
                placeholder='{ "web": { "client_id": "...", "client_secret": "..." } }'
              />
              <button
                onClick={importGoogleJson}
                disabled={importingJson || !jsonContent.trim()}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-[10px] font-bold uppercase tracking-tighter text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {importingJson ? 'Updating...' : 'Import'}
              </button>
            </div>
          </div>

          {/* Service Account Fallback */}
          <div className="space-y-4 pt-6 border-t border-zinc-100">
            <h3 className="text-sm font-bold text-zinc-800">2. Service Account Fallback (Legacy)</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              If not using administrative OAuth, you can use a Service Account JSON. This is not recommended for new setups.
            </p>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-[10px] font-bold uppercase tracking-tighter text-zinc-700 transition-colors hover:bg-zinc-100">
                {uploadingServiceFile ? 'Reading...' : '📁 Service Account JSON'}
                <input type="file" accept=".json,application/json" onChange={handleServiceAccountFileUpload} className="hidden" disabled={uploadingServiceFile} />
              </label>
              <textarea
                rows={3}
                value={serviceAccountJson}
                onChange={(e) => setServiceAccountJson(e.target.value)}
                className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-[10px] font-mono outline-none focus:ring-2 focus:ring-amber-200"
                placeholder='{ "type": "service_account", ... }'
              />
              <button
                onClick={importServiceAccountJson}
                disabled={importingServiceAccount || !serviceAccountJson.trim()}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-[10px] font-bold uppercase tracking-tighter text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {importingServiceAccount ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>

          {/* Manual Secret Override */}
          <div className="space-y-4 pt-6 border-t border-zinc-100">
            <h3 className="text-sm font-bold text-zinc-800">3. Manual Secret Override</h3>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {['googlePrivateKey', 'gmailSmtpPassword'].map((field) => {
                const f = field as AppointmentSecretField;
                const secretState = activeAppointmentConfig.secrets[f];
                return (
                  <div key={f} className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">{appointmentSecretLabels[f]}</label>
                    <input
                      type="password"
                      value={pendingAppointmentSecrets[activeEnvironment][f] || ''}
                      onChange={(event) => updateAppointmentSecretDraft(f, event.target.value)}
                      className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-xs outline-none focus:ring-2 focus:ring-amber-200 transition-all"
                      placeholder={secretState.isSet ? '••••••••' : 'Not set'}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </details>

      {/* Audit Log */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Activity & Audit</h3>
        {audit.length === 0 ? (
          <p className="text-sm text-zinc-500 italic">No activity recorded for this environment.</p>
        ) : (
          <div className="space-y-3">
            {audit.slice(0, 5).map((entry) => (
              <div key={entry.id} className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3 text-[11px] text-zinc-500 flex justify-between items-center">
                <p>
                  <span className="font-bold text-zinc-700 uppercase tracking-tighter mr-2">{entry.action}</span>
                  by {entry.actor} — modified {entry.changedFields.join(', ')}
                </p>
                <span className="font-mono text-[10px] bg-white px-2 py-1 rounded border border-zinc-100">{formatDate(entry.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

