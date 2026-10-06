'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  Activity,
  Layers,
  ArrowUpRight,
  RefreshCw,
  Cpu,
  Radio,
} from 'lucide-react';
import { getDashboardOverview, OverviewResponse } from '../lib/api';
import { useRealtime } from '../hooks/useRealtime';
import { KpiCard } from '../components/ui/KpiCard';
import { SeverityBadge } from '../components/ui/SeverityBadge';
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/ui/EmptyState';

export default function OverviewPage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { recentAlerts, status: wsStatus } = useRealtime();

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getDashboardOverview();
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Dashboard verisi yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Merge historical recent detections with incoming real-time alerts
  const displayEvents = React.useMemo(() => {
    const historical = data?.recentDetections || [];
    const merged = [...recentAlerts];
    historical.forEach((item) => {
      if (!merged.some((m) => m.id === item.id)) {
        merged.push(item);
      }
    });
    return merged.slice(0, 15);
  }, [recentAlerts, data]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-[#101216] border border-[rgba(236,235,230,0.08)] rounded w-1/3 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-[#101216] border border-[rgba(236,235,230,0.08)] rounded animate-pulse" />
          ))}
        </div>
        <LoadingSkeleton count={4} />
      </div>
    );
  }

  if (error && !data) {
    return (
      <ErrorState
        title="BAĞLANTI HATASI"
        description={`Core API'ye erişilemiyor: ${error}`}
        onRetry={loadData}
      />
    );
  }

  const kpis = data?.kpis;

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[rgba(236,235,230,0.12)] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold font-mono tracking-tight uppercase">
              GÜVENLİK OPERASYON MERKEZİ
            </h1>
            <span className="bg-[#101216] border border-[rgba(236,235,230,0.12)] text-[#ff5b2e] text-[10px] px-2 py-0.5 rounded font-mono font-medium">
              CANLI İZLEME
            </span>
          </div>
          <p className="text-xs text-[#8b8f98] font-mono mt-1">
            Dağıtık Ağ Trafiği Akış Analizi · LightGBM + Isolation Forest + TreeSHAP
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#101216] hover:bg-[#1a1d23] text-[#8b8f98] hover:text-[#ecebe6] border border-[rgba(236,235,230,0.12)] rounded text-xs font-mono transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Yenile</span>
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        <KpiCard
          label="AKTİF TEHDİTLER"
          value={kpis?.activeThreats ?? '—'}
          subtext="Yüksek & Kritik Tehditler"
          highlight={(kpis?.activeThreats || 0) > 0}
        />
        <KpiCard
          label="GÜVENLİK OLAYLARI"
          value={kpis?.openIncidents ?? '—'}
          subtext="İnceleme Bekleyen"
          highlight={(kpis?.openIncidents || 0) > 0}
        />
        <KpiCard
          label="ANALİZ EDİLEN AKIŞ"
          value={kpis?.totalFlows ? kpis.totalFlows.toLocaleString() : '—'}
          subtext="PostgreSQL Doğrulanmış"
        />
        <KpiCard
          label="ANOMALİ TESPİTİ"
          value={kpis?.anomalousFlows ?? '—'}
          subtext="τ = 0.4954 Eşik Üstü"
        />
        <KpiCard
          label="AKIŞ HIZI"
          value={kpis?.eventsPerSecond ? `${kpis.eventsPerSecond} akış/s` : '—'}
          subtext="Replay Stream Bandwidth"
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Real-Time Threat Activity Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-[rgba(236,235,230,0.12)] pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#ff5b2e]" />
              <h2 className="text-xs font-mono font-bold tracking-wider uppercase text-[#ecebe6]">
                GERÇEK ZAMANLI TEHDİT VE AKIŞ AKIŞI
              </h2>
            </div>
            <Link
              href="/threats"
              className="text-[11px] font-mono text-[#8b8f98] hover:text-[#ecebe6] flex items-center gap-1"
            >
              <span>Tümünü Gör</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {displayEvents.length === 0 ? (
            <EmptyState
              title="BEKLEMEDE · HENÜZ OLAY YOK"
              description="Sistem canlı Redis akışından ('netsentry:detections') ve PostgreSQL'den veri bekliyor. Replay motorunu çalıştırarak trafik başlatabilirsiniz."
            />
          ) : (
            <div className="border border-[rgba(236,235,230,0.12)] bg-[#060709] rounded divide-y divide-[rgba(236,235,230,0.08)] overflow-hidden">
              {displayEvents.map((event) => {
                const flow = event.flow;
                const isAttack = event.attackCategory !== 'BENIGN';

                return (
                  <Link
                    key={event.id}
                    href={`/threats/${event.id}`}
                    className="block p-3.5 hover:bg-[#101216] transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      {/* Left: Time, Category & IPs */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-[#8b8f98]">
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </span>
                          <span className="font-mono text-xs font-bold text-[#ecebe6]">
                            {event.attackCategory}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#1a1d23] border border-[rgba(236,235,230,0.1)] text-[#8b8f98] rounded">
                            {event.verdict}
                          </span>
                        </div>

                        {flow && (
                          <div className="text-[11px] font-mono text-[#8b8f98] flex items-center gap-1.5">
                            <span className="text-[#ecebe6]">{flow.sourceIp}</span>
                            <span>→</span>
                            <span className="text-[#ecebe6]">{flow.destinationIp}</span>
                            <span className="text-[#8b8f98]/70">
                              ({flow.protocol} :{flow.destinationPort})
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right: Confidence, Anomaly & Severity */}
                      <div className="flex items-center gap-3 self-start sm:self-auto">
                        <div className="text-right text-[11px] font-mono hidden sm:block">
                          <div className="text-[#ecebe6]">
                            {(event.supervisedConfidence * 100).toFixed(1)}% conf
                          </div>
                          <div className="text-[#8b8f98] text-[10px]">
                            ano: {event.unsupervisedAnomalyScore?.toFixed(3)}
                          </div>
                        </div>

                        <SeverityBadge severity={event.severity} size="sm" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 1 Col: Known Attack vs Anomaly Architecture Card */}
        <div className="space-y-6">
          {/* Scientific Defense Card */}
          <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-5 rounded space-y-4">
            <div className="flex items-center gap-2 border-b border-[rgba(236,235,230,0.12)] pb-3">
              <Cpu className="w-4 h-4 text-[#4f8cff]" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#ecebe6]">
                HİBRİT MODEL MİMARİSİ
              </h3>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="p-3 bg-[#060709] border border-[rgba(236,235,230,0.08)] rounded">
                <div className="text-[#8b8f98] text-[10px] uppercase">GÖZETİMLİ MODEL</div>
                <div className="font-bold text-[#ecebe6] mt-0.5">LightGBM (9 Sınıf)</div>
                <div className="text-[11px] text-[#2a9d8f] mt-1">
                  %99.85 Doğruluk · %93.74 Macro F1
                </div>
              </div>

              <div className="p-3 bg-[#060709] border border-[rgba(236,235,230,0.08)] rounded">
                <div className="text-[#8b8f98] text-[10px] uppercase">GÖZETİMSİZ ANOMALİ</div>
                <div className="font-bold text-[#ecebe6] mt-0.5">Isolation Forest (τ* = 0.4954)</div>
                <div className="text-[11px] text-[#4f8cff] mt-1">
                  %73.35 ROC-AUC · Sıfır-Gün Tespiti
                </div>
              </div>

              <div className="p-3 bg-[#060709] border border-[rgba(236,235,230,0.08)] rounded">
                <div className="text-[#8b8f98] text-[10px] uppercase">AÇIKLANABİLİR YAPAY ZEKA</div>
                <div className="font-bold text-[#ecebe6] mt-0.5">TreeSHAP (77 Öznitelik)</div>
                <div className="text-[11px] text-[#ff5b2e] mt-1">
                  Ort. 6.79 ms Gecikme · Karar Şeffaflığı
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href="/models"
                className="w-full py-2 bg-[#1a1d23] hover:bg-[#262930] text-[#ecebe6] border border-[rgba(236,235,230,0.12)] rounded text-xs font-mono flex items-center justify-center gap-2 transition-colors"
              >
                <span>Akademik Metrikleri İncele</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Quick Threat Distribution */}
          <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-5 rounded space-y-3">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#ecebe6] border-b border-[rgba(236,235,230,0.12)] pb-3">
              GÜVENLİK SÖZLÜĞÜ VE EŞİKLER
            </h3>
            <div className="space-y-2 text-xs font-mono text-[#8b8f98]">
              <div className="flex justify-between items-center py-1 border-b border-[rgba(236,235,230,0.06)]">
                <span>NORMAL</span>
                <span className="text-[#2a9d8f]">Benign & Anomali &lt; τ</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[rgba(236,235,230,0.06)]">
                <span>KNOWN_ATTACK</span>
                <span className="text-[#f77f00]">Tanınan Saldırı (Conf ≥ 0.8)</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[rgba(236,235,230,0.06)]">
                <span>HIGH_RISK</span>
                <span className="text-[#e63946]">Saldırı + Anomali Sapması</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span>UNKNOWN_ANOMALOUS</span>
                <span className="text-[#fcbf49]">Benign ama Anomali ≥ τ</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
