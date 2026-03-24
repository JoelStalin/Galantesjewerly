"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { PageSection, SiteSettings, FeaturedItem } from '@/lib/db';
import ImageUploader from '@/components/admin/ImageUploader';

export default function Dashboard() {
  const [sections, setSections] = useState<PageSection[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [featured, setFeatured] = useState<FeaturedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'settings' | 'sections' | 'featured'>('settings');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/admin/content')
      .then(res => res.json())
      .then(data => { 
        setSections(data.sections || []); 
        setSettings(data.settings || null);
        setFeatured(data.featured || []);
        setLoading(false); 
      });
  }, []);

  const handleLogout = async () => {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  const handleSaveSection = async (section: PageSection) => {
    setSaving(section.id);
    await fetch('/api/admin/content', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: section.id, updates: section, type: 'section' })
    });
    setSaving(null);
    alert('Sección actualizada con éxito.');
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSaving('settings');
    await fetch('/api/admin/content', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: settings, type: 'settings' })
    });
    setSaving(null);
    alert('Configuraciones globales publicadas.');
  };

  const handleAddFeatured = async () => {
    setSaving('add_featured');
    const res = await fetch('/api/admin/content', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        type: 'featured_add', 
        updates: { title: "Nueva Colección", content_text: "Descripción", image_url: "", action_text: "Ver Más", action_link: "/", is_active: true, order_index: featured.length } 
      })
    });
    const data = await res.json();
    if (data.success) setFeatured([...featured, data.featured]);
    setSaving(null);
  };

  const handleUpdateFeatured = async (item: FeaturedItem) => {
    setSaving(item.id);
    await fetch('/api/admin/content', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, updates: item, type: 'featured_update' })
    });
    setSaving(null);
    alert('Item destacado actualizado.');
  };

  const handleDeleteFeatured = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este item del panel destacado?')) return;
    setSaving('delete_' + id);
    await fetch('/api/admin/content', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, type: 'featured_delete' })
    });
    setFeatured(featured.filter(f => f.id !== id));
    setSaving(null);
  };

  if (loading || !settings) {
    return (
      <div className="flex justify-center items-center min-h-[50vh] text-zinc-500 animate-pulse">
        <span className="text-xl tracking-widest uppercase">Cargando Bóveda Extendida...</span>
      </div>
    );
  }

  return (
    <div className="bg-zinc-50 min-h-screen pb-20">
      <div className="bg-white border-b border-zinc-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center">
          <h1 className="text-2xl font-serif text-zinc-900 tracking-wide">Centro de Control Avanzado</h1>
          <button onClick={handleLogout} className="text-xs font-semibold uppercase tracking-widest text-red-500 hover:text-red-700 transition-colors bg-red-50 px-4 py-2 rounded-full">
            Bloquear Panel
          </button>
        </div>
        <div className="max-w-6xl mx-auto px-6 flex gap-8 overflow-x-auto">
          {['settings', 'sections', 'featured'].map((tab) => (
            <button key={tab}
              className={`pb-4 text-sm font-semibold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeTab === tab ? 'border-amber-500 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'}`}
              onClick={() => setActiveTab(tab as any)}
            >
              {tab === 'settings' ? 'Ajustes Globales' : tab === 'sections' ? 'Secciones Singulares' : 'Colecciones Destacadas (Carousel)'}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 mt-10">
        
        {activeTab === 'settings' && (
          <div className="bg-white border border-zinc-100 rounded-2xl p-8 shadow-sm max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="font-semibold text-lg uppercase tracking-wider text-zinc-800 mb-6">Identidad de la Marca</h2>
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Título de la Pestaña (SEO)</label>
                <input type="text" value={settings.site_title} onChange={e => setSettings({ ...settings, site_title: e.target.value })} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-3 text-sm focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Descripción (SEO Meta)</label>
                <textarea rows={3} value={settings.site_description} onChange={e => setSettings({ ...settings, site_description: e.target.value })} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-3 text-sm focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none transition-all resize-none" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ImageUploader 
                  label="Logotipo del Header" 
                  currentUrl={settings.logo_url} 
                  onUploadSuccess={(url) => setSettings({ ...settings, logo_url: url })}
                />
                <ImageUploader 
                  label="Favicon de la Pestaña" 
                  currentUrl={settings.favicon_url} 
                  onUploadSuccess={(url) => setSettings({ ...settings, favicon_url: url })}
                  isFavicon={true}
                />
              </div>
              <div className="pt-6 border-t border-zinc-100">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-700 mb-4">Presencia en Redes Sociales</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Instagram (URL Completa)</label>
                    <input type="text" value={settings.instagram_url || ''} onChange={e => setSettings({ ...settings, instagram_url: e.target.value })} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-2.5 text-xs focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none" placeholder="https://instagram.com/tu_perfil" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Facebook (URL Completa)</label>
                    <input type="text" value={settings.facebook_url || ''} onChange={e => setSettings({ ...settings, facebook_url: e.target.value })} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-2.5 text-xs focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none" placeholder="https://facebook.com/tu_perfil" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">WhatsApp (Número con Código de País)</label>
                    <input type="text" value={settings.whatsapp_number || ''} onChange={e => setSettings({ ...settings, whatsapp_number: e.target.value })} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-2.5 text-xs focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none" placeholder="Ej: 5491122334455" />
                    <p className="text-[9px] text-zinc-400 mt-1 italic">Este número se usará para el botón de chat directo.</p>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-100 flex justify-end">
                <button onClick={handleSaveSettings} disabled={saving === 'settings'} className="bg-zinc-900 text-white text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-amber-600 transition-colors shadow-sm">
                  {saving === 'settings' ? 'Sincronizando...' : 'Guardar Ajustes Globales'}
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
                  <h2 className="font-semibold text-lg uppercase tracking-wider text-zinc-800">Sección: {section.section_identifier.replace('_', ' ')}</h2>
                </div>
                <div className="space-y-5 flex-grow">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Título Principal</label>
                    <input type="text" value={section.title} onChange={e => setSections(sections.map(s => s.id === section.id ? { ...s, title: e.target.value } : s))} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-3 text-sm focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none transition-all" />
                  </div>
                  {section.subtitle !== undefined && (
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Sub-título / Atribución</label>
                      <input type="text" value={section.subtitle} onChange={e => setSections(sections.map(s => s.id === section.id ? { ...s, subtitle: e.target.value } : s))} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-3 text-sm focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none transition-all" />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Cuerpo de Texto</label>
                    <textarea rows={5} value={section.content_text} onChange={e => setSections(sections.map(s => s.id === section.id ? { ...s, content_text: e.target.value } : s))} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-3 text-sm focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none transition-all resize-none" />
                  </div>
                  <ImageUploader 
                    label="Fotografía de la Sección" 
                    currentUrl={section.image_url || ''} 
                    onUploadSuccess={(url) => setSections(sections.map(s => s.id === section.id ? { ...s, image_url: url } : s))}
                  />
                  {section.action_text !== undefined && (
                     <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Botón Inferior (Texto)</label>
                      <input type="text" value={section.action_text} onChange={e => setSections(sections.map(s => s.id === section.id ? { ...s, action_text: e.target.value } : s))} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-3 text-sm focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none transition-all" />
                    </div>
                  )}
                </div>
                <div className="pt-6 mt-6 border-t border-zinc-100 flex justify-end">
                  <button onClick={() => handleSaveSection(section)} disabled={saving === section.id} className="bg-zinc-900 text-white text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors shadow-sm">
                    {saving === section.id ? 'Sincronizando...' : 'Actualizar Sección'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'featured' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="flex items-center justify-between mb-8">
               <p className="text-zinc-500 text-sm">Estos recuadros rotarán dinámicamente en la página web principal cada pocos segundos. Añade cuantos desees.</p>
               <button onClick={handleAddFeatured} disabled={saving === 'add_featured'} className="bg-amber-500 text-white font-semibold uppercase tracking-wider text-xs px-5 py-3 rounded-lg hover:bg-amber-600 transition-colors shadow-sm">
                 + Añadir Nueva Colección
               </button>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {featured.map((item) => (
                  <div key={item.id} className="bg-white border-2 border-amber-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col h-full relative">
                    <button onClick={() => handleDeleteFeatured(item.id)} className="absolute top-4 right-4 text-zinc-400 hover:text-red-500 bg-white rounded-full p-1" title="Eliminar Panel">
                      ✕
                    </button>
                    <div className="space-y-4 flex-grow mt-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Título de Colección</label>
                        <input type="text" value={item.title} onChange={e => setFeatured(featured.map(s => s.id === item.id ? { ...s, title: e.target.value } : s))} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-2 text-sm focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none transition-all" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Descripción Breve</label>
                        <textarea rows={3} value={item.content_text} onChange={e => setFeatured(featured.map(s => s.id === item.id ? { ...s, content_text: e.target.value } : s))} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-2 text-sm focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none transition-all resize-none" />
                      </div>
                      <ImageUploader 
                        label="Fotografía Principal" 
                        currentUrl={item.image_url} 
                        onUploadSuccess={(url) => setFeatured(featured.map(s => s.id === item.id ? { ...s, image_url: url } : s))}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Texto Botón</label>
                          <input type="text" value={item.action_text} onChange={e => setFeatured(featured.map(s => s.id === item.id ? { ...s, action_text: e.target.value } : s))} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-2 text-xs focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none transition-all" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Enlace Destino</label>
                          <input type="text" value={item.action_link} onChange={e => setFeatured(featured.map(s => s.id === item.id ? { ...s, action_link: e.target.value } : s))} className="w-full border border-zinc-200 bg-zinc-50 rounded-lg p-2 text-xs focus:bg-white focus:ring-2 focus:ring-amber-300 outline-none transition-all" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-4 mt-4 border-t border-zinc-100 flex justify-center">
                      <button onClick={() => handleUpdateFeatured(item)} disabled={saving === item.id} className="w-full bg-zinc-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors">
                        {saving === item.id ? '...' : 'Guardar y Rotar'}
                      </button>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
