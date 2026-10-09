'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, CheckCircle2, AlertCircle, Smartphone, ExternalLink } from 'lucide-react';

export default function WhatsAppAdminPage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/admin/whatsapp?t=' + Date.now());
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Navigation & Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-5">
          <div className="flex items-center space-x-4">
            <Link
              href="/admin/dashboard"
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 transition"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Smartphone className="w-6 h-6 text-emerald-400" />
                WhatsApp Live Browser & Scanner
              </h1>
              <p className="text-sm text-slate-400">
                Inicio de sesión persistente en el servidor para el agente de inventario y Orca
              </p>
            </div>
          </div>

          <button
            onClick={fetchStatus}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md bg-slate-900 border border-slate-800 hover:bg-slate-800 transition text-slate-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>

        {/* Live Status Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
            <div>
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Estado de la Conexión</span>
              <div className="mt-2 flex items-center gap-2">
                {status?.logged_in ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span className="text-lg font-semibold text-emerald-400">Sesión Activa</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-amber-400" />
                    <span className="text-lg font-semibold text-amber-400">Esperando Código QR</span>
                  </>
                )}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/60 text-xs text-slate-500">
              Último sondeo: {lastUpdated || 'Cargando...'}
            </div>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 col-span-2 flex flex-col justify-between">
            <div>
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Número Vinculado / Target</span>
              <div className="mt-2 text-base text-slate-200 font-mono">
                +1 786-246-2664 <span className="text-xs px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 ml-2">Whitelisted</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Canal exclusivo para ingesta de fotografías, extracción en inglés y aprendizaje en Orca.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/60 text-xs text-slate-500">
              Backlog destino para piezas no reconocidas: <strong className="text-slate-300">galantesbacklog</strong>
            </div>
          </div>
        </div>

        {/* Live QR Scanner or Active Browser View */}
        <div className="p-6 rounded-xl bg-slate-900/80 border border-slate-800">
          <h2 className="text-lg font-semibold text-white mb-4">
            {status?.logged_in ? 'Vista de Sesión en Vivo (WhatsApp Web)' : 'Código QR en Vivo del Servidor'}
          </h2>

          <div className="flex flex-col items-center justify-center p-8 bg-slate-950 rounded-lg border border-slate-800/80 min-h-[360px]">
            {status?.logged_in ? (
              <div className="w-full flex flex-col items-center space-y-4">
                <div className="relative rounded-lg overflow-hidden border border-slate-800 shadow-2xl max-w-3xl w-full">
                  <img
                    src={`/api/admin/whatsapp?view=screenshot&t=${Date.now()}`}
                    alt="WhatsApp Web Active Session"
                    className="w-full h-auto object-cover"
                  />
                </div>
                <p className="text-xs text-slate-400">
                  La sesión de WhatsApp Web está iniciada y sincronizada directamente en el servidor.
                </p>
              </div>
            ) : status?.qrAvailable ? (
              <div className="flex flex-col items-center space-y-4">
                <div className="p-4 bg-white rounded-xl shadow-xl">
                  <img
                    src={`/api/admin/whatsapp?view=qr&t=${Date.now()}`}
                    alt="WhatsApp QR Code"
                    className="w-64 h-64 object-contain"
                  />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-slate-200">
                    Abre WhatsApp en tu teléfono &gt; Dispositivos vinculados &gt; Vincular un dispositivo
                  </p>
                  <p className="text-xs text-slate-400">
                    Apunta la cámara de tu teléfono a este código QR para iniciar sesión en la plataforma.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-slate-600 animate-spin mx-auto" />
                <p className="text-sm text-slate-400">
                  Iniciando servicio de navegación de WhatsApp Web en el servidor...
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
