'use client';

import React, { useEffect, useState } from 'react';
import { BarChart3, RefreshCw, PieChart, ShieldAlert } from 'lucide-react';
import { getAnalyticsStats, AnalyticsStatsResponse } from '../../lib/api';
import { EmptyState, ErrorState, LoadingSkeleton } from '../../components/ui/EmptyState';
import { KpiCard } from '../../components/ui/KpiCard';

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAnalyticsStats();
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Analitik istatistikleri yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-[#101216] rounded w-1/4 animate-pulse" />
        <LoadingSkeleton count={6} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <ErrorState
        title="ANALİTİK VERİSİ ALINAMADI"
        description={error || 'Veritabanı analitik aggregations hesaplanamadı.'}
        onRetry={load}
      />
    );
  }

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[rgba(236,235,230,0.12)] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-[#ff5b2e]" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight uppercase text-[#ecebe6]">
              GÜVENLİK ANALİTİĞİ VE AGGREGATIONS
            </h1>
          </div>
          <p className="text-xs text-[#8b8f98] mt-1">
            PostgreSQL &apos;Detection&apos; Tablosu Doğrudan İstatistiksel Dağılımı (Sıfır Mock Veri)
          </p>
        </div>

        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#101216] hover:bg-[#1a1d23] text-[#8b8f98] hover:text-[#ecebe6] border border-[rgba(236,235,230,0.12)] rounded text-xs transition-colors self-start md:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Yenile</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="TOPLAM TESPİT"
          value={data.totalDetections}
          subtext="Model Tarafından İşlenen"
        />
        <KpiCard
          label="ANOMALİ ORANI"
          value={`${data.anomalyRate}%`}
          subtext={`${data.anomalousCount} / ${data.totalDetections} Akış Sapması`}
          highlight={data.anomalyRate > 20}
        />
        <KpiCard
          label="ORT. MODEL GÜVENİ"
          value={data.totalDetections > 0 ? `${(data.averageConfidence * 100).toFixed(1)}%` : '—'}
          subtext="LightGBM Olasılık Çıktısı"
        />
        <KpiCard
          label="ORT. ANOMALİ SKORU"
          value={data.totalDetections > 0 ? data.averageAnomalyScore.toFixed(4) : '—'}
          subtext="Eşik: τ = 0.4954"
        />
      </div>

      {data.totalDetections === 0 ? (
        <EmptyState
          title="ANALİZ EDİLECEK TESPİT BULUNMUYOR"
          description="Sistemde henüz tespit kaydı oluşturulmadı. Replay motoru çalıştırıldığında gerçek dağılımlar burada belirecektir."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Attack Category Breakdown */}
          <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-5 rounded space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#ecebe6] border-b border-[rgba(236,235,230,0.12)] pb-3">
              SALDIRI KATEGORİSİ DAĞILIMI
            </h3>

            <div className="space-y-3">
              {data.attackCategoryDistribution.map((item) => (
                <div key={item.category} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-[#ecebe6]">{item.category}</span>
                    <span className="text-[#8b8f98]">
                      {item.count} adet ({item.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#060709] h-2 rounded overflow-hidden">
                    <div
                      style={{ width: `${item.percentage}%` }}
                      className={`h-full rounded ${
                        item.category === 'BENIGN' ? 'bg-[#2a9d8f]' : 'bg-[#ff5b2e]'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Severity Breakdown */}
          <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-5 rounded space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#ecebe6] border-b border-[rgba(236,235,230,0.12)] pb-3">
              ÖNEM SEVİYESİ (SEVERITY) DAĞILIMI
            </h3>

            <div className="space-y-3">
              {data.severityDistribution.map((item) => {
                const colors: Record<string, string> = {
                  CRITICAL: 'bg-[#e63946]',
                  HIGH: 'bg-[#f77f00]',
                  MEDIUM: 'bg-[#fcbf49]',
                  LOW: 'bg-[#4f8cff]',
                };
                return (
                  <div key={item.severity} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-[#ecebe6]">{item.severity}</span>
                      <span className="text-[#8b8f98]">
                        {item.count} adet ({item.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#060709] h-2 rounded overflow-hidden">
                      <div
                        style={{ width: `${item.percentage}%` }}
                        className={`h-full rounded ${colors[item.severity] || 'bg-[#4f8cff]'}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Verdict Distribution */}
          <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-5 rounded space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#ecebe6] border-b border-[rgba(236,235,230,0.12)] pb-3">
              HİBRİT KARAR (THREAT VERDICT)
            </h3>

            <div className="space-y-3">
              {data.verdictDistribution.map((item) => (
                <div key={item.verdict} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-[#ecebe6]">{item.verdict}</span>
                    <span className="text-[#8b8f98]">
                      {item.count} adet ({item.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#060709] h-2 rounded overflow-hidden">
                    <div
                      style={{ width: `${item.percentage}%` }}
                      className="bg-[#2a9d8f] h-full rounded"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Confidence Buckets */}
          <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-5 rounded space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#ecebe6] border-b border-[rgba(236,235,230,0.12)] pb-3">
              MODEL GÜVENİLİRLİK (CONFIDENCE) ARALIKLARI
            </h3>

            <div className="space-y-3">
              {data.confidenceDistribution.map((item) => {
                const pct =
                  data.totalDetections > 0
                    ? ((item.count / data.totalDetections) * 100).toFixed(1)
                    : 0;

                return (
                  <div key={item.range} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-[#ecebe6]">{item.range}</span>
                      <span className="text-[#8b8f98]">
                        {item.count} adet ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#060709] h-2 rounded overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className="bg-[#4f8cff] h-full rounded"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
