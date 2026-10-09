'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, KeyRound, RotateCw, Send, Radio } from 'lucide-react';

export default function FullscreenLiveBrowserPage() {
  const [lastFrameTime, setLastFrameTime] = useState<number>(Date.now());
  const [status, setStatus] = useState<any>(null);
  const [interactionMsg, setInteractionMsg] = useState<string>('');
  const [textInput, setTextInput] = useState<string>('');
  const [actionInProgress, setActionInProgress] = useState<boolean>(false);
  const canvasRef = useRef<HTMLImageElement | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/admin/whatsapp?t=' + Date.now());
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchStatus();
    const sInt = setInterval(fetchStatus, 2500);
    const fInt = setInterval(() => setLastFrameTime(Date.now()), 700);
    return () => {
      clearInterval(sInt);
      clearInterval(fInt);
    };
  }, []);

  const handleCanvasClick = async (e: React.MouseEvent<HTMLImageElement>) => {
    if (!canvasRef.current || actionInProgress) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 800 / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    setInteractionMsg(`Clic en (${x}, ${y})...`);
    try {
      await fetch('/api/admin/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'click', x, y }),
      });
      setLastFrameTime(Date.now());
    } catch {}
    setTimeout(() => setInteractionMsg(''), 2000);
  };

  const handleLinkPhone = async () => {
    setActionInProgress(true);
    setInteractionMsg('Solicitando código para +1 786-246-2664...');
    try {
      await fetch('/api/admin/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'link_phone', phoneNumber: '7862462664' }),
      });
      setLastFrameTime(Date.now());
    } catch {} finally {
      setActionInProgress(false);
      setTimeout(() => setInteractionMsg(''), 3000);
    }
  };

  const handleReload = async () => {
    setActionInProgress(true);
    setInteractionMsg('Recargando página en servidor...');
    try {
      await fetch('/api/admin/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh' }),
      });
      setLastFrameTime(Date.now());
    } catch {} finally {
      setActionInProgress(false);
      setTimeout(() => setInteractionMsg(''), 3000);
    }
  };

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
    } catch {} finally {
      setActionInProgress(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col items-center p-3 select-none">
      {/* Top Bar */}
      <div className="w-full max-w-7xl flex items-center justify-between py-2 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/whatsapp"
            className="flex items-center gap-1 text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" /> Volver al panel
          </Link>
          <span className="font-semibold text-white">
            Navegador Chromium Servidor (1280x800)
          </span>
          <span className="text-emerald-400 flex items-center gap-1 font-mono">
            <Radio className="w-3 h-3 animate-pulse" /> Estado: {status?.state || 'En Vivo'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {interactionMsg && <span className="text-sky-400 text-xs">{interactionMsg}</span>}
          <button
            onClick={handleLinkPhone}
            disabled={actionInProgress}
            className="px-3 py-1 bg-sky-600 hover:bg-sky-500 rounded text-white font-semibold flex items-center gap-1"
          >
            <KeyRound className="w-3.5 h-3.5" /> Vincular +1 786-246-2664
          </button>
          <button
            onClick={handleReload}
            disabled={actionInProgress}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-medium flex items-center gap-1 border border-slate-700"
          >
            <RotateCw className="w-3.5 h-3.5" /> Recargar
          </button>
        </div>
      </div>

      {/* Screen */}
      <div className="w-full max-w-7xl flex-1 flex items-center justify-center my-2">
        <div className="relative border-2 border-slate-800 rounded-lg overflow-hidden shadow-2xl bg-slate-950 max-h-[85vh] flex items-center justify-center">
          <img
            ref={canvasRef}
            src={`/api/admin/whatsapp?view=frame&t=${lastFrameTime}`}
            alt="WhatsApp Live Viewport"
            onClick={handleCanvasClick}
            className="w-full h-auto object-contain cursor-crosshair"
            onError={() => setTimeout(() => setLastFrameTime(Date.now()), 1500)}
          />
        </div>
      </div>

      {/* Input bar */}
      <form onSubmit={handleSendText} className="w-full max-w-7xl flex items-center gap-2 py-1">
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Escribir texto en el navegador..."
          className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-white"
        />
        <button
          type="submit"
          className="px-4 py-1.5 bg-slate-800 text-white rounded text-xs font-semibold flex items-center gap-1"
        >
          <Send className="w-3 h-3" /> Enviar
        </button>
      </form>
    </div>
  );
}
