"use client";

// Re-compile trigger: 2026-04-27 11:00 AM
import { useState, useEffect } from 'react';
import type { PageSection, SiteSettings, FeaturedItem } from '@/lib/db';
import ImageUploader from '@/components/admin/ImageUploader';
import IntegrationsPanel from '@/components/admin/IntegrationsPanel';
import AppointmentsPanel from '@/components/admin/AppointmentsPanel';

type NoticeState = {
  message: string;
  tone: 'error' | 'success';
};

const adminTabs = ['settings', 'sections', 'featured', 'appointments', 'integrations'] as const;
type AdminTab = (typeof adminTabs)[number];

export default function Dashboard() {
  const [sections, setSections] = useState<PageSection[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [featured, setFeatured] = useState<FeaturedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [uploadingTargets, setUploadingTargets] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [savedKeys, setSavedKeys] = useState<Record<string, boolean>>({});
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(null);
  const [sessionUser, setSessionUser] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>('settings');

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get('tab');
    if (adminTabs.includes(requestedTab as AdminTab)) {
      setActiveTab(requestedTab as AdminTab);
    }

    const loadDashboard = async () => {
      try {
        const [contentRes, sessionRes] = await Promise.all([
          fetch('/api/admin/content'),
          fetch('/api/admin/session'),
        ]);

        if (contentRes.status === 401 || sessionRes.status === 401) {
          window.location.replace('/admin/login');
          return;
        }

        if (!contentRes.ok || !sessionRes.ok) {
          throw new Error('load_failed');
        }

        const [data, sessionData] = await Promise.all([
          contentRes.json(),
          sessionRes.json(),
        ]);

        setSections(data.sections || []);
        setSettings(data.settings || null);
        setFeatured(data.featured || []);
        setSessionExpiresAt(sessionData.expiresAt || null);
        setSessionUser(sessionData.user || 'admin');
      } catch {
        setNotice({ message: 'Failed to load panel session.', tone: 'error' });
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const handleUnauthorized = (status: number) => {
    if (status === 401) {
      window.location.replace('/admin/login');
      return true;
    }

    return false;
  };

  const setUploadState = (key: string, isUploading: boolean) => {
    setUploadingTargets((current) => {
      if (isUploading) {
        return { ...current, [key]: true };
      }

      if (!current[key]) {
        return current;
      }

      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const isUploadingTarget = (key: string) => Boolean(uploadingTargets[key]);

  const flashSaved = (key: string) => {
    setSavedKeys((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => setSavedKeys((prev) => { const next = { ...prev }; delete next[key]; return next; }), 2500);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
    } finally {
      window.location.replace('/admin/login');
    }
  };

  const handleSaveSection = async (sectionId: string) => {
    const section = sections.find((current) => current.id === sectionId);
    if (!section) {
      setNotice({ message: 'Section not found for saving.', tone: 'error' });
      return;
    }

    setSaving(sectionId);

    try {
      const response = await fetch('/api/admin/content', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sectionId, updates: section, type: 'section' })
      });

      if (handleUnauthorized(response.status)) return;
      if (!response.ok) throw new Error('save_section_failed');

      setNotice({ message: 'Section updated successfully.', tone: 'success' });
      flashSaved(sectionId);
    } catch {
      setNotice({ message: 'Could not save the section.', tone: 'error' });
    } finally {
      setSaving(null);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSaving('settings');

    try {
      const response = await fetch('/api/admin/content', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: settings, type: 'settings' })
      });

      if (handleUnauthorized(response.status)) return;
      if (!response.ok) throw new Error('save_settings_failed');

      setNotice({ message: 'Global settings published.', tone: 'success' });
      flashSaved('settings');
    } catch {
      setNotice({ message: 'Could not save global settings.', tone: 'error' });
    } finally {
      setSaving(null);
    }
  };

  const handleAddFeatured = async () => {
    setSaving('add_featured');

    try {
      const res = await fetch('/api/admin/content', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'featured_add',
          updates: { title: "New Collection", content_text: "Description", image_url: "", action_text: "View More", action_link: "/", is_active: true, order_index: featured.length }
        })
      });

      if (handleUnauthorized(res.status)) return;
      if (!res.ok) throw new Error('add_featured_failed');

      const data = await res.json();
      if (data.success) {
        setFeatured((current) => [...current, data.featured]);
        setNotice({ message: 'New featured collection created.', tone: 'success' });
        return;
      }

      throw new Error('add_featured_failed');
    } catch {
      setNotice({ message: 'Could not create the featured collection.', tone: 'error' });
    } finally {
      setSaving(null);
    }
  };

  const handleUpdateFeatured = async (itemId: string) => {
    const item = featured.find((current) => current.id === itemId);
    if (!item) {
      setNotice({ message: 'Featured item not found for saving.', tone: 'error' });
      return;
    }

    setSaving(itemId);

    try {
      const response = await fetch('/api/admin/content', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, updates: item, type: 'featured_update' })
      });

      if (handleUnauthorized(response.status)) return;
      if (!response.ok) throw new Error('update_featured_failed');

      setNotice({ message: 'Featured item updated.', tone: 'success' });
      flashSaved(itemId);
    } catch {
      setNotice({ message: 'Could not update featured item.', tone: 'error' });
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteFeatured = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item from the featured panel?')) return;
    setSaving('delete_' + id);

    try {
      const response = await fetch('/api/admin/content', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type: 'featured_delete' })
      });

      if (handleUnauthorized(response.status)) return;
      if (!response.ok) throw new Error('delete_featured_failed');

      setFeatured((current) => current.filter(f => f.id !== id));
      setNotice({ message: 'Featured collection deleted.', tone: 'success' });
    } catch {
      setNotice({ message: 'Could not delete the featured collection.', tone: 'error' });
    } finally {
      setSaving(null);
    }
  };

  const sessionSummary = sessionExpiresAt
    ? `Session of ${sessionUser} until ${new Intl.DateTimeFormat('en-US', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(sessionExpiresAt))}`
    : `Session of ${sessionUser || 'admin'} active`;
  const isSettingsUploading = isUploadingTarget('settings-logo') || isUploadingTarget('settings-favicon');

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh] text-zinc-500 animate-pulse">
        <span className="text-xl tracking-widest uppercase">Loading Advanced Vault...</span>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex justify-center items-center min-h-[50vh] text-zinc-500">
        <span className="text-lg text-center">{notice?.message || 'Could not load administrative panel.'}</span>
      </div>
    );
  }

  return (
    <div className="bg-zinc-50 min-h-screen pb-20">
      <div className="bg-white border-b border-zinc-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center">
          <h1 className="text-2xl font-serif text-zinc-900 tracking-wide">Advanced Control Center</h1>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-600">Active Session</p>
              <p className="text-xs text-zinc-500">{sessionSummary}</p>
            </div>
            <button data-testid="logout-button" onClick={handleLogout} className="text-xs font-semibold uppercase tracking-widest text-red-500 hover:text-red-700 transition-colors bg-red-50 px-4 py-2 rounded-full">
              Lock Panel
            </button>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 flex gap-8 overflow-x-auto">
          {adminTabs.map((tab) => (
            <button key={tab}
              data-testid={`tab-${tab}`}
              className={`pb-4 text-sm font-semibold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeTab === tab ? 'border-amber-500 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'settings'
                ? 'Global Settings'
                : tab === 'sections'
                  ? 'Single Sections'
                  : tab === 'featured'
                    ? 'Featured Collections (Carousel)'
                    : tab === 'appointments'
                      ? 'Appointments'
                      : 'Integrations & OAuth'}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 mt-10">
        {notice && (
          <div data-testid="admin-notice" className={`mb-6 rounded-xl border px-4 py-3 text-sm ${notice.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
            {notice.message}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white border border-zinc-100 rounded-2xl p-8 shadow-sm max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="font-semibold text-lg uppercase tracking-wider text-zinc-800 mb-6">Brand Identity</h2>
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Navbar Brand Name</label>
                <input data-testid="admin-brand-name" type="text" value={settings.brand_name} onChange={e => setSettings({ ...settings, brand_name: e.target.value })} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-3 text-sm focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Navbar Tagline</label>
                <input data-testid="admin-brand-tagline" type="text" value={settings.brand_tagline} onChange={e => setSettings({ ...settings, brand_tagline: e.target.value })} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-3 text-sm focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Tab Title (SEO)</label>
                <input type="text" value={settings.site_title} onChange={e => setSettings({ ...settings, site_title: e.target.value })} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-3 text-sm focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Description (SEO Meta)</label>
                <textarea rows={3} value={settings.site_description} onChange={e => setSettings({ ...settings, site_description: e.target.value })} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-3 text-sm focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none transition-all resize-none" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ImageUploader
                  label="Header Logo"
                  currentUrl={settings.logo_url}
                  onUploadSuccess={(url) => setSettings((current) => current ? { ...current, logo_url: url } : current)}
                  onRemove={() => setSettings((current) => current ? { ...current, logo_url: '' } : current)}
                  onUploadStateChange={(isUploading: boolean) => setUploadState('settings-logo', isUploading)}
                />
                <ImageUploader
                  label="Tab Favicon"
                  currentUrl={settings.favicon_url}
                  onUploadSuccess={(url) => setSettings((current) => current ? { ...current, favicon_url: url } : current)}
                  isFavicon={true}
                  onRemove={() => setSettings((current) => current ? { ...current, favicon_url: '' } : current)}
                  onUploadStateChange={(isUploading: boolean) => setUploadState('settings-favicon', isUploading)}
                />
              </div>

              <div className="pt-6 border-t border-zinc-100">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-700 mb-4">Hero & Navigation</h3>
                <div className="space-y-6">
                  <ImageUploader
                    label="Main Hero Background (Homepage)"
                    currentUrl={settings.hero_image_url}
                    onUploadSuccess={(url) => setSettings((current) => current ? { ...current, hero_image_url: url } : current)}
                    onRemove={() => setSettings((current) => current ? { ...current, hero_image_url: '' } : current)}
                    onUploadStateChange={(isUploading: boolean) => setUploadState('settings-hero', isUploading)}
                  />

                  <ImageUploader
                    label="Shop Page Hero Background"
                    currentUrl={settings.shop_hero_image_url}
                    onUploadSuccess={(url) => setSettings((current) => current ? { ...current, shop_hero_image_url: url } : current)}
                    onRemove={() => setSettings((current) => current ? { ...current, shop_hero_image_url: '' } : current)}
                    onUploadStateChange={(isUploading: boolean) => setUploadState('settings-shop-hero', isUploading)}
                  />

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Navigation Links</label>
                    <div className="space-y-3">
                      {(settings.navigation_links || []).map((link, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input 
                            type="text" 
                            placeholder="Label" 
                            value={link.label} 
                            onChange={e => {
                              const newLinks = [...(settings.navigation_links || [])];
                              newLinks[idx].label = e.target.value;
                              setSettings({ ...settings, navigation_links: newLinks });
                            }}
                            className="flex-1 border border-zinc-200 bg-zinc-50 rounded-lg p-2 text-xs focus:bg-white outline-none" 
                          />
                          <input 
                            type="text" 
                            placeholder="Href (e.g. /contact)" 
                            value={link.href} 
                            onChange={e => {
                              const newLinks = [...(settings.navigation_links || [])];
                              newLinks[idx].href = e.target.value;
                              setSettings({ ...settings, navigation_links: newLinks });
                            }}
                            className="flex-[2] border border-zinc-200 bg-zinc-50 rounded-lg p-2 text-xs focus:bg-white outline-none" 
                          />
                          <button 
                            onClick={() => {
                              const newLinks = (settings.navigation_links || []).filter((_, i) => i !== idx);
                              setSettings({ ...settings, navigation_links: newLinks });
                            }}
                            className="p-2 text-red-400 hover:text-red-600"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button 
                        onClick={() => {
                          const newLinks = [...(settings.navigation_links || []), { label: 'New Link', href: '/' }];
                          setSettings({ ...settings, navigation_links: newLinks });
                        }}
                        className="text-[10px] font-bold uppercase tracking-widest text-amber-600 hover:text-amber-700"
                      >
                        + Add Link
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-100">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-700 mb-4">Contact Information & Appointments</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Contact Email (Displayed on Site)</label>
                    <input type="email" value={settings.contact_email || ''} onChange={e => setSettings({ ...settings, contact_email: e.target.value })} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-2.5 text-xs focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none" placeholder="concierge@galantesjewelry.com" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Appointment recipient Email (Admin)</label>
                    <input type="email" value={settings.appointment_email || ''} onChange={e => setSettings({ ...settings, appointment_email: e.target.value })} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-2.5 text-xs focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none" placeholder="appointments@galantesjewelry.com" />
                    <p className="text-[9px] text-zinc-400 mt-1 italic">This email will receive notifications from the contact form.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Contact Phone</label>
                      <input type="text" value={settings.contact_phone || ''} onChange={e => setSettings({ ...settings, contact_phone: e.target.value })} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-2.5 text-xs focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none" placeholder="(305) 555-0199" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Contact Address</label>
                      <input type="text" value={settings.contact_address || ''} onChange={e => setSettings({ ...settings, contact_address: e.target.value })} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-2.5 text-xs focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none" placeholder="123 Overseas Highway..." />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-100">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-700 mb-4">Social Media Presence</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Instagram (Full URL)</label>
                    <input type="text" value={settings.instagram_url || ''} onChange={e => setSettings({ ...settings, instagram_url: e.target.value })} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-2.5 text-xs focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none" placeholder="https://instagram.com/your_profile" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Facebook (Full URL)</label>
                    <input type="text" value={settings.facebook_url || ''} onChange={e => setSettings({ ...settings, facebook_url: e.target.value })} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-2.5 text-xs focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none" placeholder="https://facebook.com/your_profile" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">WhatsApp (Number with Country Code)</label>
                    <input type="text" value={settings.whatsapp_number || ''} onChange={e => setSettings({ ...settings, whatsapp_number: e.target.value })} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-2.5 text-xs focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none" placeholder="e.g.: 16464965879" />
                    <p className="text-[9px] text-zinc-400 mt-1 italic">This number will be used for the direct chat button.</p>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-100 flex justify-end">
                <button data-testid="admin-save-settings" onClick={handleSaveSettings} disabled={saving === 'settings' || isSettingsUploading} className={`text-white text-sm font-medium px-6 py-2.5 rounded-lg disabled:opacity-50 transition-all duration-300 shadow-sm ${savedKeys['settings'] ? 'bg-emerald-600 scale-105' : 'bg-zinc-900 hover:bg-amber-600'}`}>
                  {saving === 'settings' ? 'Syncing...' : isSettingsUploading ? 'Uploading image...' : savedKeys['settings'] ? '✓ Saved!' : 'Save Global Settings'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sections' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {sections.map(section => (
              <div key={section.id} className="bg-white border border-zinc-100 rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold font-serif text-sm">
                    {section.section_identifier.substring(0, 2).toUpperCase()}
                  </div>
                  <h2 className="font-semibold text-lg uppercase tracking-wider text-zinc-800">Section: {section.section_identifier.replace('_', ' ')}</h2>
                </div>
                <div className="space-y-5 flex-grow">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Main Title</label>
                    <input type="text" value={section.title} onChange={e => setSections(sections.map(s => s.id === section.id ? { ...s, title: e.target.value } : s))} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-3 text-sm focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none transition-all" />
                  </div>
                  {section.subtitle !== undefined && (
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Sub-title / Attribution</label>
                      <input type="text" value={section.subtitle} onChange={e => setSections(sections.map(s => s.id === section.id ? { ...s, subtitle: e.target.value } : s))} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-3 text-sm focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none transition-all" />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Content Text</label>
                    <textarea rows={5} value={section.content_text} onChange={e => setSections(sections.map(s => s.id === section.id ? { ...s, content_text: e.target.value } : s))} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-3 text-sm focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none transition-all resize-none" />
                  </div>
                  <ImageUploader
                    label="Section Image"
                    currentUrl={section.image_url || ''}
                    onUploadSuccess={(url) => setSections((current) => current.map(s => s.id === section.id ? { ...s, image_url: url } : s))}
                    onRemove={() => setSections((current) => current.map(s => s.id === section.id ? { ...s, image_url: '' } : s))}
                    onUploadStateChange={(isUploading: boolean) => setUploadState(`section-${section.id}`, isUploading)}
                  />
                  {section.action_text !== undefined && (
                     <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Bottom Button (Text)</label>
                      <input type="text" value={section.action_text} onChange={e => setSections(sections.map(s => s.id === section.id ? { ...s, action_text: e.target.value } : s))} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-3 text-sm focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none transition-all" />
                    </div>
                  )}
                </div>
                <div className="pt-6 mt-6 border-t border-zinc-100 flex justify-end">
                  <button onClick={() => handleSaveSection(section.id)} disabled={saving === section.id || isUploadingTarget(`section-${section.id}`)} className={`text-white text-sm font-medium px-6 py-2.5 rounded-lg disabled:opacity-50 transition-all duration-300 shadow-sm ${savedKeys[section.id] ? 'bg-emerald-600 scale-105' : 'bg-zinc-900 hover:bg-amber-600'}`}>
                    {saving === section.id ? 'Syncing...' : isUploadingTarget(`section-${section.id}`) ? 'Uploading...' : savedKeys[section.id] ? '✓ Saved!' : 'Update Section'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'featured' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="flex items-center justify-between mb-8">
               <p className="text-zinc-500 text-sm">These cards will dynamically rotate on the main website every few seconds. Add as many as you wish.</p>
               <button data-testid="add-featured-button" onClick={handleAddFeatured} disabled={saving === 'add_featured'} className="bg-amber-500 text-white font-semibold uppercase tracking-wider text-xs px-5 py-3 rounded-lg hover:bg-amber-600 transition-colors shadow-sm">
                 + Add New Collection
               </button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {featured.map((item) => (
                   <div key={item.id} data-testid={`featured-card-${item.id}`} className="bg-white border-2 border-amber-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col h-full relative">
                    <button data-testid={`delete-featured-${item.id}`} onClick={() => handleDeleteFeatured(item.id)} className="absolute top-4 right-4 text-zinc-400 hover:text-red-500 bg-white rounded-full p-1" title="Delete Panel">
                      ✕
                    </button>
                    <div className="space-y-4 flex-grow mt-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Collection Title</label>
                        <input data-testid={`featured-title-${item.id}`} type="text" value={item.title} onChange={e => setFeatured(featured.map(s => s.id === item.id ? { ...s, title: e.target.value } : s))} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-2 text-sm focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none transition-all" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Short Description</label>
                        <textarea data-testid={`featured-content-${item.id}`} rows={3} value={item.content_text} onChange={e => setFeatured(featured.map(s => s.id === item.id ? { ...s, content_text: e.target.value } : s))} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-2 text-sm focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none transition-all resize-none" />
                      </div>
                      <ImageUploader
                        label="Main Photo"
                        currentUrl={item.image_url}
                        onUploadSuccess={(url) => setFeatured((current) => current.map(s => s.id === item.id ? { ...s, image_url: url } : s))}
                        onRemove={() => setFeatured((current) => current.map(s => s.id === item.id ? { ...s, image_url: '' } : s))}
                        onUploadStateChange={(isUploading: boolean) => setUploadState(`featured-${item.id}`, isUploading)}
                        inputTestId={`featured-image-input-${item.id}`}
                        previewTestId={`featured-image-preview-${item.id}`}
                        removeButtonTestId={`featured-image-remove-${item.id}`}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Button Text</label>
                          <input data-testid={`featured-action-text-${item.id}`} type="text" value={item.action_text} onChange={e => setFeatured(featured.map(s => s.id === item.id ? { ...s, action_text: e.target.value } : s))} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-2 text-xs focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none transition-all" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Target Link</label>
                          <input data-testid={`featured-action-link-${item.id}`} type="text" value={item.action_link} onChange={e => setFeatured(featured.map(s => s.id === item.id ? { ...s, action_link: e.target.value } : s))} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-2 text-xs focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none transition-all" />
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-zinc-100 flex justify-center">
                      <button data-testid={`save-featured-${item.id}`} onClick={() => handleUpdateFeatured(item.id)} disabled={saving === item.id || isUploadingTarget(`featured-${item.id}`)} className={`w-full text-white text-sm font-medium px-4 py-2.5 rounded-lg disabled:opacity-50 transition-all duration-300 ${savedKeys[item.id] ? 'bg-emerald-600 scale-105' : 'bg-zinc-900 hover:bg-amber-600'}`}>
                        {saving === item.id ? '...' : isUploadingTarget(`featured-${item.id}`) ? 'Uploading...' : savedKeys[item.id] ? '✓ Saved!' : 'Save and Rotate'}
                      </button>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'integrations' && (
          <IntegrationsPanel />
        )}

        {activeTab === 'appointments' && (
          <AppointmentsPanel />
        )}
      </div>
    </div>
  );
}
