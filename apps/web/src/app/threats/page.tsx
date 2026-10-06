'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert, Filter, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { getThreats, ThreatListResponse } from '../../lib/api';
import { SeverityBadge } from '../../components/ui/SeverityBadge';
import { EmptyState, ErrorState, LoadingSkeleton } from '../../components/ui/EmptyState';

export default function ThreatsPage() {
  const [data, setData] = useState<ThreatListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [severityFilter, setSeverityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const loadThreats = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getThreats({
        page,
        limit: 15,
        severity: severityFilter || undefined,
        attackCategory: categoryFilter || undefined,
      });
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Tehditler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadThreats();
  }, [page, severityFilter, categoryFilter]);

  const categories = [
    'BENIGN',
    'DDOS',
    'PORT_SCAN',
    'DOS',
    'BRUTE_FORCE',
    'BOTNET',
    'WEB_ATTACK',
    'INFILTRATION',
    'HEARTBLEED',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[rgba(236,235,230,0.12)] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-[#ff5b2e]" />
            <h1 className="text-xl md:text-2xl font-bold font-mono tracking-tight uppercase">
              TEHDİT VE AKIŞ GÜNLÜĞÜ
            </h1>
          </div>
          <p className="text-xs text-[#8b8f98] font-mono mt-1">
            Gözetimli ve Gözetimsiz Modeller Tarafından İşlenen Tüm Ağ Akışlarının Detaylı Kaydı
          </p>
        </div>

        <button
          onClick={loadThreats}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#101216] hover:bg-[#1a1d23] text-[#8b8f98] hover:text-[#ecebe6] border border-[rgba(236,235,230,0.12)] rounded text-xs font-mono transition-colors self-start md:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Yenile</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-[#101216] border border-[rgba(236,235,230,0.12)] rounded text-xs font-mono">
        <div className="flex items-center gap-2 text-[#8b8f98]">
          <Filter className="w-3.5 h-3.5" />
          <span>FİLTRELER:</span>
        </div>

        {/* Severity Filter */}
        <select
          value={severityFilter}
          onChange={(e) => {
            setSeverityFilter(e.target.value);
            setPage(1);
          }}
          className="bg-[#060709] border border-[rgba(236,235,230,0.12)] text-[#ecebe6] px-2.5 py-1 rounded text-xs focus:outline-none focus:border-[#ff5b2e]"
        >
          <option value="">Tüm Önem Seviyeleri</option>
          <option value="CRITICAL">CRITICAL</option>
          <option value="HIGH">HIGH</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="LOW">LOW</option>
        </select>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          className="bg-[#060709] border border-[rgba(236,235,230,0.12)] text-[#ecebe6] px-2.5 py-1 rounded text-xs focus:outline-none focus:border-[#ff5b2e]"
        >
          <option value="">Tüm Kategoriler</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        {/* Active count */}
        {data && (
          <span className="text-[#8b8f98] ml-auto">
            Toplam: <strong className="text-[#ecebe6]">{data.total}</strong> kayıt
          </span>
        )}
      </div>

      {/* Main Table Content */}
      {loading ? (
        <LoadingSkeleton count={8} />
      ) : error ? (
        <ErrorState description={error} onRetry={loadThreats} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="FİLTREYE UYGUN TEHDİT BULUNAMADI"
          description="Seçilen kriterlerle eşleşen kayıt mevcut değil veya henüz akış işlenmedi."
        />
      ) : (
        <div className="border border-[rgba(236,235,230,0.12)] bg-[#060709] rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#101216] border-b border-[rgba(236,235,230,0.12)] text-[#8b8f98] uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">ZAMAN</th>
                  <th className="py-3 px-4">SALDIRI TÜRÜ</th>
                  <th className="py-3 px-4">KAYNAK → HEDEF</th>
                  <th className="py-3 px-4">GÖZETİMLİ (CONF)</th>
                  <th className="py-3 px-4">ANOMALİ (SKOR)</th>
                  <th className="py-3 px-4">SEVERITY</th>
                  <th className="py-3 px-4 text-right">DETAY</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(236,235,230,0.06)]">
                {data.items.map((threat) => {
                  const flow = threat.flow;

                  return (
                    <tr
                      key={threat.id}
                      className="hover:bg-[#101216]/60 transition-colors"
                    >
                      <td className="py-3 px-4 text-[#8b8f98] whitespace-nowrap">
                        {new Date(threat.timestamp).toLocaleTimeString()}
                      </td>

                      <td className="py-3 px-4 font-bold text-[#ecebe6] whitespace-nowrap">
                        <span>{threat.attackCategory}</span>
                        <span className="block text-[10px] font-normal text-[#8b8f98]">
                          {threat.verdict}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-[#8b8f98] whitespace-nowrap">
                        {flow ? (
                          <div>
                            <span className="text-[#ecebe6]">{flow.sourceIp}</span>
                            <span className="mx-1">→</span>
                            <span className="text-[#ecebe6]">{flow.destinationIp}</span>
                            <span className="text-[10px] text-[#8b8f98]/70 ml-1">
                              ({flow.protocol} :{flow.destinationPort})
                            </span>
                          </div>
                        ) : (
                          <span>{threat.flowId}</span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="text-[#ecebe6] font-medium">
                          {(threat.supervisedConfidence * 100).toFixed(1)}%
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={
                            threat.isAnomalous
                              ? 'text-[#ff5b2e] font-semibold'
                              : 'text-[#2a9d8f]'
                          }
                        >
                          {threat.unsupervisedAnomalyScore?.toFixed(4)}
                        </span>
                        <span className="text-[10px] text-[#8b8f98] block">
                          {threat.isAnomalous ? 'Eşik Üstü (Anomali)' : 'Normal Eşik'}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <SeverityBadge severity={threat.severity} size="sm" />
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Link
                          href={`/threats/${threat.id}`}
                          className="px-2.5 py-1 bg-[#1a1d23] hover:bg-[#262930] text-[#ecebe6] rounded border border-[rgba(236,235,230,0.12)] text-[11px] transition-colors inline-block"
                        >
                          İncele
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-3 bg-[#101216] border-t border-[rgba(236,235,230,0.12)] flex items-center justify-between text-xs font-mono text-[#8b8f98]">
            <div>
              Sayfa <strong className="text-[#ecebe6]">{page}</strong> / {data.totalPages || 1}
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded bg-[#060709] border border-[rgba(236,235,230,0.12)] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#1a1d23]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1 rounded bg-[#060709] border border-[rgba(236,235,230,0.12)] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#1a1d23]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
