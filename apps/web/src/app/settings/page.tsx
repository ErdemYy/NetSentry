'use client';

import React, { useEffect, useState } from 'react';
import { Settings, Server, Database, Radio, RefreshCw, CheckCircle2, Shield, Trash2, Lock } from 'lucide-react';
import {
  getSystemHealth,
  SystemHealthStatus,
  API_BASE_URL,
  ML_BASE_URL,
  getCurrentUser,
  getAuditLogs,
  resetDemoState,
  UserProfile,
} from '../../lib/api';

export default function SettingsPage() {
  const [health, setHealth] = useState<SystemHealthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const check = async () => {
    setLoading(true);
    try {
      const h = await getSystemHealth();
      setHealth(h);
      const uRes = await getCurrentUser();
      if (uRes?.user) {
        setUser(uRes.user);
        if (uRes.user.role === 'ADMIN') {
          const logs = await getAuditLogs({ limit: 15 });
          if (logs?.logs) setAuditLogs(logs.logs);
        }
      }
    } catch {
      // transient
    } finally {
      setLoading(false);
    }
  };

  const handleResetDemo = async () => {
    if (!confirm('Tüm demo tespitleri, akışları ve olayları sıfırlanacaktır. Kullanıcı hesapları ve denetim logları korunur. Onaylıyor musunuz?')) return;
    setIsResetting(true);
    setResetMessage(null);
    try {
      const res = await resetDemoState();
      setResetMessage(res.message || 'Demo durumu başarıyla sıfırlandı.');
      check();
    } catch (err: any) {
      setResetMessage(`Sıfırlama hatası: ${err.message}`);
    } finally {
      setIsResetting(false);
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

      {/* Jury Demo Management & Reset (ADR-019 / Section 29, 30) */}
      <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-6 rounded space-y-4">
        <div className="flex items-center justify-between border-b border-[rgba(236,235,230,0.12)] pb-3">
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-[#e63946]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#ecebe6]">
              JÜRİ DEMO YÖNETİMİ VE TEMİZLEME (DEMO MANAGEMENT)
            </h3>
          </div>
          <span className="text-[10px] text-[#ff5b2e] bg-[#ff5b2e]/10 border border-[#ff5b2e]/20 px-2 py-0.5 rounded">
            ADMIN YETKİSİ GEREKLİ
          </span>
        </div>

        <p className="text-xs text-[#8b8f98] leading-relaxed">
          Bu işlem, bitirme projesi jüri sunumu öncesinde sistemdeki geçici demo akışlarını, tespitleri ve olayları sıfırlar. Kullanıcı hesapları, roller ve güvenlik denetim kayıtları korunur.
        </p>

        {resetMessage && (
          <div className="p-3 bg-[#4f8cff]/10 border border-[#4f8cff]/20 text-[#4f8cff] rounded text-xs font-mono">
            {resetMessage}
          </div>
        )}

        <div className="pt-2">
          {user?.role === 'ADMIN' ? (
            <button
              onClick={handleResetDemo}
              disabled={isResetting}
              className="px-4 py-2 bg-[#e63946] hover:bg-[#ff4d5e] text-white font-bold rounded text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isResetting ? 'Sıfırlanıyor...' : 'DEMO VERİLERİNİ TEMİZLE (RESET STATE)'}
            </button>
          ) : (
            <div className="flex items-center gap-2 text-[#8b8f98] text-xs">
              <Lock className="w-3.5 h-3.5" />
              <span>Demo durumunu sıfırlamak için Yönetici (ADMIN) rolüyle giriş yapınız.</span>
            </div>
          )}
        </div>
      </div>

      {/* Security Audit Trail (Admin Only) */}
      {user?.role === 'ADMIN' && (
        <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-6 rounded space-y-4">
          <div className="flex items-center justify-between border-b border-[rgba(236,235,230,0.12)] pb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#4f8cff]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#ecebe6]">
                GÜVENLİK DENETİM GÜNLÜĞÜ (AUDIT TRAIL)
              </h3>
            </div>
            <span className="text-[10px] text-[#8b8f98]">Son 15 Güvenlik Olayı</span>
          </div>

          {auditLogs.length === 0 ? (
            <div className="text-xs text-[#8b8f98] py-4 text-center">Kayıtlı denetim olayı bulunamadı.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#060709] text-[#8b8f98] text-[10px] uppercase border-b border-[rgba(236,235,230,0.08)]">
                  <tr>
                    <th className="py-2 px-3">ZAMAN</th>
                    <th className="py-2 px-3">EYLEM (ACTION)</th>
                    <th className="py-2 px-3">HEDEF</th>
                    <th className="py-2 px-3">KULLANICI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(236,235,230,0.06)] font-mono text-[11px]">
                  {auditLogs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-[#1a1d23]/50">
                      <td className="py-2 px-3 text-[#8b8f98]">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="py-2 px-3 font-bold text-[#ecebe6]">{log.action}</td>
                      <td className="py-2 px-3 text-[#4f8cff]">{log.targetResource}</td>
                      <td className="py-2 px-3 text-[#2a9d8f]">{log.user?.email || 'ANONYMOUS'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
