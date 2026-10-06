'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Layers, Filter, RefreshCw, AlertCircle } from 'lucide-react';
import { getIncidents, IncidentListResponse } from '../../lib/api';
import { SeverityBadge } from '../../components/ui/SeverityBadge';
import { EmptyState, ErrorState, LoadingSkeleton } from '../../components/ui/EmptyState';

export default function IncidentsPage() {
  const [data, setData] = useState<IncidentListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  const loadIncidents = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getIncidents({
        page,
        limit: 15,
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
      });
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Olaylar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, [page, statusFilter, severityFilter]);

  const statusColors: Record<string, string> = {
    NEW: 'text-[#ff5b2e] bg-[#ff5b2e]/10 border-[#ff5b2e]/30',
    INVESTIGATING: 'text-[#fcbf49] bg-[#fcbf49]/10 border-[#fcbf49]/30',
    CONFIRMED_THREAT: 'text-[#e63946] bg-[#e63946]/10 border-[#e63946]/30',
    FALSE_POSITIVE: 'text-[#8b8f98] bg-[#1a1d23] border-[rgba(236,235,230,0.1)]',
    RESOLVED: 'text-[#2a9d8f] bg-[#2a9d8f]/10 border-[#2a9d8f]/30',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[rgba(236,235,230,0.12)] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <Layers className="w-6 h-6 text-[#ff5b2e]" />
            <h1 className="text-xl md:text-2xl font-bold font-mono tracking-tight uppercase">
              GÜVENLİK OLAYLARI (INCIDENT MANAGEMENT)
            </h1>
          </div>
          <p className="text-xs text-[#8b8f98] font-mono mt-1">
            Yüksek ve Kritik Riskli Tehditlerin Olay Müdahale ve Triage Kayıtları
          </p>
        </div>

        <button
          onClick={loadIncidents}
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

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="bg-[#060709] border border-[rgba(236,235,230,0.12)] text-[#ecebe6] px-2.5 py-1 rounded text-xs focus:outline-none focus:border-[#ff5b2e]"
        >
          <option value="">Tüm Durumlar</option>
          <option value="NEW">NEW (Yeni)</option>
          <option value="INVESTIGATING">INVESTIGATING (İncelemede)</option>
          <option value="CONFIRMED_THREAT">CONFIRMED_THREAT (Doğrulanmış Tehdit)</option>
          <option value="RESOLVED">RESOLVED (Çözüldü)</option>
          <option value="FALSE_POSITIVE">FALSE_POSITIVE (Yanlış Pozitif)</option>
        </select>

        <select
          value={severityFilter}
          onChange={(e) => {
            setSeverityFilter(e.target.value);
            setPage(1);
          }}
          className="bg-[#060709] border border-[rgba(236,235,230,0.12)] text-[#ecebe6] px-2.5 py-1 rounded text-xs focus:outline-none focus:border-[#ff5b2e]"
        >
          <option value="">Tüm Seviyeler</option>
          <option value="CRITICAL">CRITICAL</option>
          <option value="HIGH">HIGH</option>
          <option value="MEDIUM">MEDIUM</option>
        </select>

        {data && (
          <span className="text-[#8b8f98] ml-auto">
            Toplam: <strong className="text-[#ecebe6]">{data.total}</strong> olay
          </span>
        )}
      </div>

      {/* Table Content */}
      {loading ? (
        <LoadingSkeleton count={6} />
      ) : error ? (
        <ErrorState description={error} onRetry={loadIncidents} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="AÇIK GÜVENLİK OLAYI BULUNMUYOR"
          description="Kayıtlı olay bulunamadı. Kritik saldırı tespit edildiğinde otomatik olarak buraya eklenir."
        />
      ) : (
        <div className="border border-[rgba(236,235,230,0.12)] bg-[#060709] rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#101216] border-b border-[rgba(236,235,230,0.12)] text-[#8b8f98] uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">OLAY BAŞLIĞI</th>
                  <th className="py-3 px-4">KATEGORİ</th>
                  <th className="py-3 px-4">SEVERITY</th>
                  <th className="py-3 px-4">KAYNAK → HEDEF</th>
                  <th className="py-3 px-4">DURUM</th>
                  <th className="py-3 px-4">ZAMAN</th>
                  <th className="py-3 px-4 text-right">İŞLEM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(236,235,230,0.06)]">
                {data.items.map((incident) => {
                  return (
                    <tr key={incident.id} className="hover:bg-[#101216]/60 transition-colors">
                      <td className="py-3 px-4 font-semibold text-[#ecebe6] max-w-xs truncate">
                        <Link
                          href={`/incidents/${incident.id}`}
                          className="hover:text-[#ff5b2e] transition-colors"
                        >
                          {incident.title}
                        </Link>
                      </td>

                      <td className="py-3 px-4 font-bold text-[#ecebe6]">
                        {incident.attackCategory}
                      </td>

                      <td className="py-3 px-4">
                        <SeverityBadge severity={incident.severity} size="sm" />
                      </td>

                      <td className="py-3 px-4 text-[#8b8f98] whitespace-nowrap">
                        <span className="text-[#ecebe6]">{incident.sourceIp}</span>
                        <span className="mx-1">→</span>
                        <span className="text-[#ecebe6]">{incident.destinationIp}</span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                            statusColors[incident.status] || 'text-[#8b8f98]'
                          }`}
                        >
                          {incident.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-[#8b8f98] whitespace-nowrap">
                        {new Date(incident.createdAt).toLocaleTimeString()}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Link
                          href={`/incidents/${incident.id}`}
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
        </div>
      )}
    </div>
  );
}
