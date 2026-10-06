'use client';

import React, { useEffect, useState } from 'react';
import { Settings, Server, Database, Radio, RefreshCw, CheckCircle2, Shield } from 'lucide-react';
import { getSystemHealth, SystemHealthStatus, API_BASE_URL, ML_BASE_URL } from '../../lib/api';

export default function SettingsPage() {
  const [health, setHealth] = useState<SystemHealthStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const check = async () => {
    setLoading(true);
    try {
      const h = await getSystemHealth();
      setHealth(h);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    check();
  }, []);

  return (
    <div className="space-y-6 max-w-4xl font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[rgba(236,235,230,0.12)] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-[#ff5b2e]" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight uppercase text-[#ecebe6]">
              SİSTEM VE PLATFORM AYARLARI
            </h1>
          </div>
          <p className="text-xs text-[#8b8f98] mt-1">
            Mimarî Bileşen Yapılandırması, Akış Eşikleri ve Servis Uç Noktaları
          </p>
        </div>

        <button
          onClick={check}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#101216] hover:bg-[#1a1d23] text-[#8b8f98] hover:text-[#ecebe6] border border-[rgba(236,235,230,0.12)] rounded text-xs transition-colors self-start md:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Bağlantıları Denetle</span>
        </button>
      </div>

      {/* Subsystem Endpoints */}
      <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-6 rounded space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#ecebe6] border-b border-[rgba(236,235,230,0.12)] pb-3">
          BAĞLI SERVİSLER VE ÇEVRESEL UÇ NOKTALAR
        </h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-[#060709] rounded border border-[rgba(236,235,230,0.06)]">
            <div>
              <div className="font-bold text-[#ecebe6]">NestJS Core API Orchestrator</div>
              <div className="text-[10px] text-[#8b8f98]">{API_BASE_URL}</div>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] border ${
                health?.api
                  ? 'bg-[#2a9d8f]/10 text-[#2a9d8f] border-[#2a9d8f]/30'
                  : 'bg-[#e63946]/10 text-[#e63946] border-[#e63946]/30'
              }`}
            >
              {health?.api ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-[#060709] rounded border border-[rgba(236,235,230,0.06)]">
            <div>
              <div className="font-bold text-[#ecebe6]">FastAPI ML Inference Service</div>
              <div className="text-[10px] text-[#8b8f98]">{ML_BASE_URL}</div>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] border ${
                health?.ml
                  ? 'bg-[#2a9d8f]/10 text-[#2a9d8f] border-[#2a9d8f]/30'
                  : 'bg-[#e63946]/10 text-[#e63946] border-[#e63946]/30'
              }`}
            >
              {health?.ml ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-[#060709] rounded border border-[rgba(236,235,230,0.06)]">
            <div>
              <div className="font-bold text-[#ecebe6]">Redis Stream Broker (Host Port: 6380)</div>
              <div className="text-[10px] text-[#8b8f98]">Streams: netsentry:flows, netsentry:detections</div>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] border ${
                health?.redis
                  ? 'bg-[#2a9d8f]/10 text-[#2a9d8f] border-[#2a9d8f]/30'
                  : 'bg-[#e63946]/10 text-[#e63946] border-[#e63946]/30'
              }`}
            >
              {health?.redis ? 'CONNECTED' : 'UNREACHABLE'}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-[#060709] rounded border border-[rgba(236,235,230,0.06)]">
            <div>
              <div className="font-bold text-[#ecebe6]">PostgreSQL Database (Host Port: 5433)</div>
              <div className="text-[10px] text-[#8b8f98]">Database: netsentry_db · Schema: public</div>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] border ${
                health?.database
                  ? 'bg-[#2a9d8f]/10 text-[#2a9d8f] border-[#2a9d8f]/30'
                  : 'bg-[#e63946]/10 text-[#e63946] border-[#e63946]/30'
              }`}
            >
              {health?.database ? 'CONNECTED' : 'UNREACHABLE'}
            </span>
          </div>
        </div>
      </div>

      {/* Redis Key & Parameter Registry */}
      <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-6 rounded space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#ecebe6] border-b border-[rgba(236,235,230,0.12)] pb-3">
          AKILLI STREAM VE ANOMALİ KONFİGÜRASYONU
        </h3>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between py-1.5 border-b border-[rgba(236,235,230,0.06)]">
            <span className="text-[#8b8f98]">Giriş Akış Stream Anahtarı:</span>
            <span className="text-[#ecebe6]">netsentry:flows</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-[rgba(236,235,230,0.06)]">
            <span className="text-[#8b8f98]">Tespit Çıktı Stream Anahtarı:</span>
            <span className="text-[#ecebe6]">netsentry:detections</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-[rgba(236,235,230,0.06)]">
            <span className="text-[#8b8f98]">Tüketici Grubu (Consumer Group):</span>
            <span className="text-[#ecebe6]">ml-inference / netsentry-api-group</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-[rgba(236,235,230,0.06)]">
            <span className="text-[#8b8f98]">Hata / Dead-Letter Queue (DLQ):</span>
            <span className="text-[#ecebe6]">netsentry:flows:dlq</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-[rgba(236,235,230,0.06)]">
            <span className="text-[#8b8f98]">Kalibre Edilmiş Anomali Eşiği (τ*):</span>
            <span className="text-[#ff5b2e] font-bold">0.49540</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-[rgba(236,235,230,0.06)]">
            <span className="text-[#8b8f98]">Maksimum Yeniden Deneme Sayısı:</span>
            <span className="text-[#ecebe6]">3 deneme</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-[#8b8f98]">Açıklanabilirlik Yöntemi:</span>
            <span className="text-[#ecebe6]">TreeSHAP (77 öznitelik)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
