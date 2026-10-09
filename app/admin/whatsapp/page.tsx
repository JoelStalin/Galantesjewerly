'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  ExternalLink,
  MousePointer,
  Send,
  RotateCw,
  QrCode,
  KeyRound,
  ShieldCheck,
  Radio
} from 'lucide-react';

export default function WhatsAppAdminPage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastFrameTime, setLastFrameTime] = useState<number>(Date.now());
  const [interactionMsg, setInteractionMsg] = useState<string>('');
  const [textInput, setTextInput] = useState<string>('');
  const [actionInProgress, setActionInProgress] = useState<boolean>(false);
  const [streamActive, setStreamActive] = useState<boolean>(true);
  const canvasRef = useRef<HTMLImageElement | null>(null);

  // Poll status from server
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/admin/whatsapp?t=' + Date.now());
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.error('Status fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const statusInterval = setInterval(fetchStatus, 2500);
    return () => clearInterval(statusInterval);
  }, []);

  // Frame streaming interval
  useEffect(() => {
    if (!streamActive) return;
    const frameInterval = setInterval(() => {
      setLastFrameTime(Date.now());
    }, 800);
    return () => clearInterval(frameInterval);
  }, [streamActive]);

  // Handle direct click on live browser canvas
  const handleCanvasClick = async (e: React.MouseEvent<HTMLImageElement>) => {
    if (!canvasRef.current || actionInProgress) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 800 / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    setInteractionMsg(`Enviando clic en coordenadas (${x}, ${y})...`);
    try {
      const res = await fetch('/api/admin/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'click', x, y }),
      });
      if (res.ok) {
        setInteractionMsg(`Clic ejecutado en (${x}, ${y})`);
        setLastFrameTime(Date.now());
      }
    } catch {
      setInteractionMsg('Error al enviar clic');
    }
    setTimeout(() => setInteractionMsg(''), 3000);
  };

  // Quick Action: Link with Phone Number (+1 786-246-2664)
  const handleLinkPhone = async () => {
    setActionInProgress(true);
    setInteractionMsg('Solicitando código de vinculación para +1 786-246-2664...');
    try {
      const res = await fetch('/api/admin/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'link_phone', phoneNumber: '7862462664' }),
      });
      const data = await res.json();
      if (data.ok) {
        setInteractionMsg('¡Vinculación telefónica activada! Observa el código en pantalla.');
        setLastFrameTime(Date.now());
        fetchStatus();
      } else {
        setInteractionMsg(data.message || 'No se pudo activar la vinculación por teléfono.');
      }
    } catch {
      setInteractionMsg('Error de red al vincular teléfono.');
    } finally {
      setActionInProgress(false);
      setTimeout(() => setInteractionMsg(''), 4000);
    }
  };

  // Quick Action: Reload WhatsApp Web
  const handleReload = async () => {
    setActionInProgress(true);
    setInteractionMsg('Recargando WhatsApp Web en el servidor...');
    try {
      await fetch('/api/admin/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh' }),
      });
      setLastFrameTime(Date.now());
      setInteractionMsg('Página recargada');
    } catch {
      setInteractionMsg('Error al recargar');
    } finally {
      setActionInProgress(false);
      setTimeout(() => setInteractionMsg(''), 3000);
    }
  };

  // Quick Action: Send Text
  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || actionInProgress) return;
    setActionInProgress(true);
    try {
      await fetch('/api/admin/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'type', text: textInput }),
      });
      setTextInput('');
      setLastFrameTime(Date.now());
      setInteractionMsg('Texto ingresado en el navegador');
    } catch {
      setInteractionMsg('Error al enviar texto');
    } finally {
      setActionInProgress(false);
      setTimeout(() => setInteractionMsg(''), 3000);
    }
  };

  const getStatusBadge = () => {
    const s = status?.state || status?.status;
    if (s === 'logged_in') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800 text-xs font-semibold">
          <CheckCircle2 className="w-3.5 h-3.5" /> Sesión Conectada &amp; Activa
        </span>
      );
    }
    if (s === 'pairing_code_ready') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-950/80 text-sky-400 border border-sky-800 text-xs font-semibold">
          <KeyRound className="w-3.5 h-3.5" /> Código de Vinculación Listo
        </span>
      );
    }
    if (s === 'qr_ready') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/80 text-amber-400 border border-amber-800 text-xs font-semibold">
          <QrCode className="w-3.5 h-3.5 animate-pulse" /> Código QR en Vivo (Escanea ahora)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-xs font-medium">
        <RotateCw className="w-3.5 h-3.5 animate-spin" /> Conectando al motor en el servidor...
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-5 gap-4">
          <div className="flex items-center space-x-4">
            <Link
              href="/admin/dashboard"
              className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 transition"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Smartphone className="w-6 h-6 text-emerald-400" />
                Live Browser Interactivo &amp; WhatsApp Server Node
              </h1>
              <p className="text-sm text-slate-400">
                Navegador Chromium real ejecutado en el servidor GCP para vinculación directa y permanente
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/whatsapp/live"
              target="_blank"
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-lg shadow-emerald-950/40"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Abrir Live Browser Pantalla Completa
            </Link>
            <button
              onClick={fetchStatus}
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 transition text-slate-300"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>

        {/* Live Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
            <div>
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Estado del Navegador Servidor</span>
              <div className="mt-3 flex items-center gap-2">
                {getStatusBadge()}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
              <span>Streaming: {streamActive ? 'Activo (800ms)' : 'Pausado'}</span>
              <button
                onClick={() => setStreamActive(!streamActive)}
                className="text-emerald-400 hover:underline"
              >
                {streamActive ? 'Pausar' : 'Reanudar'}
              </button>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 col-span-2 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Número Whitelist para Ingesta</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-mono">
                  Producción GCP
                </span>
              </div>
              <div className="mt-2 text-lg font-mono text-white flex items-center gap-2">
                +1 786-246-2664
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Las fotos recibidas de este número se analizan con similitud visual y se catalogan en inglés en Odoo. Destino no reconocidos: <strong className="text-slate-200">galantesbacklog</strong>.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> Servidor: galantes_whatsapp_browser (Port 4000)
              </span>
            </div>
          </div>
        </div>

        {/* Live Interactive Browser Container */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-3">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <MousePointer className="w-4 h-4 text-sky-400" />
                Live Viewport Interactivo (Haz clic o interactúa directamente)
              </h2>
              <p className="text-xs text-slate-400">
                Transmisión continua de Chromium ejecutándose en vivo en el servidor. Cada clic se replica en el navegador real.
              </p>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleLinkPhone}
                disabled={actionInProgress}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold transition"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Vincular +1 786-246-2664
              </button>

              <button
                onClick={handleReload}
                disabled={actionInProgress}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-medium transition border border-slate-700"
              >
                <RotateCw className={`w-3.5 h-3.5 ${actionInProgress ? 'animate-spin' : ''}`} />
                Recargar Web
              </button>
            </div>
          </div>

          {interactionMsg && (
            <div className="p-2.5 rounded-lg bg-sky-950/70 border border-sky-800/70 text-sky-300 text-xs animate-fade-in flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 animate-pulse text-sky-400" />
              {interactionMsg}
            </div>
          )}

          {/* Browser Screen */}
          <div className="relative rounded-xl overflow-hidden border-2 border-slate-800 bg-black flex items-center justify-center min-h-[480px]">
            <img
              ref={canvasRef}
              src={`/api/admin/whatsapp?view=frame&t=${lastFrameTime}`}
              alt="Live Browser Viewport"
              onClick={handleCanvasClick}
              className="w-full max-w-5xl h-auto object-contain cursor-crosshair select-none"
              onError={(e) => {
                // If frame not ready yet, keep trying
                setTimeout(() => setLastFrameTime(Date.now()), 1500);
              }}
            />
          </div>

          {/* Keyboard input bar */}
          <form onSubmit={handleSendText} className="flex items-center gap-2 pt-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Escribe texto o números para ingresar en el campo seleccionado de WhatsApp Web..."
              className="flex-1 px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
            <button
              type="submit"
              disabled={actionInProgress || !textInput.trim()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-semibold rounded-lg transition border border-slate-700 flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              Enviar
            </button>
          </form>

          {/* User Guide */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 space-y-2">
            <h3 className="font-semibold text-slate-200 flex items-center gap-1.5">
              💡 Instrucciones para vincular tu teléfono:
            </h3>
            <ol className="list-decimal list-inside space-y-1 text-slate-400">
              <li>
                <strong>Opción A (Código QR):</strong> Abre WhatsApp en tu celular &gt; <em>Ajustes / Menú</em> &gt; <em>Dispositivos vinculados</em> &gt; <em>Vincular un dispositivo</em>, y apunta tu cámara al código QR visible arriba en tiempo real.
              </li>
              <li>
                <strong>Opción B (Código de 8 Dígitos):</strong> Haz clic en el botón azul <strong className="text-sky-300">"Vincular +1 786-246-2664"</strong> arriba. El servidor ingresará el número y mostrará el código de 8 dígitos en la pantalla. Luego en tu teléfono presiona <em>Vincular con el número de teléfono</em> e introduce dicho código.
              </li>
              <li>
                Una vez vinculado, la sesión queda guardada de forma permanente en el volumen del servidor GCP para el agente de inventario y Orca.
              </li>
            </ol>
          </div>

        </div>

      </div>
    </div>
  );
}
