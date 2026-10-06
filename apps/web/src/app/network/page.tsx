'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Network, RefreshCw, Server, ArrowUpRight } from 'lucide-react';
import { getNetworkStats, NetworkStatsResponse } from '../../lib/api';
import { EmptyState, ErrorState, LoadingSkeleton } from '../../components/ui/EmptyState';
import { SeverityBadge } from '../../components/ui/SeverityBadge';

export default function NetworkPage() {
  const [data, setData] = useState<NetworkStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getNetworkStats();
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Ağ istatistikleri yüklenemedi');
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
        title="AĞ VERİSİ ALINAMADI"
        description={error || 'Veritabanı akış kayıtları okunamadı.'}
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
            <Network className="w-6 h-6 text-[#4f8cff]" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight uppercase text-[#ecebe6]">
              AĞ TRAFİĞİ İSTİHBARATI
            </h1>
          </div>
          <p className="text-xs text-[#8b8f98] mt-1">
            Protokol Dağılımı, Hedef Port İstatistikleri ve Ham Akış Hacmi Telemetrisi
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

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-4 rounded">
          <div className="text-[10px] text-[#8b8f98] uppercase">TOPLAM KAYITLI AKIŞ</div>
          <div className="text-2xl font-bold text-[#ecebe6] mt-1">
            {data.totalFlows.toLocaleString()}
          </div>
          <div className="text-[10px] text-[#8b8f98] mt-0.5">PostgreSQL &apos;Flow&apos; Tablosu</div>
        </div>

        <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-4 rounded">
          <div className="text-[10px] text-[#8b8f98] uppercase">ORTALAMA AKIM SÜRESİ</div>
          <div className="text-2xl font-bold text-[#ecebe6] mt-1">
            {data.averages?.durationMs?.toFixed(1) || 0} ms
          </div>
          <div className="text-[10px] text-[#8b8f98] mt-0.5">Akış Başına Gecikme</div>
        </div>

        <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-4 rounded">
          <div className="text-[10px] text-[#8b8f98] uppercase">ORTALAMA PAKET SAYISI</div>
          <div className="text-2xl font-bold text-[#ecebe6] mt-1">
            {data.averages?.totalPackets || 0} pkt
          </div>
          <div className="text-[10px] text-[#8b8f98] mt-0.5">İki Yönlü Toplam</div>
        </div>

        <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-4 rounded">
          <div className="text-[10px] text-[#8b8f98] uppercase">ORTALAMA HACİM</div>
          <div className="text-2xl font-bold text-[#ecebe6] mt-1">
            {data.averages?.totalBytes?.toLocaleString() || 0} B
          </div>
          <div className="text-[10px] text-[#8b8f98] mt-0.5">Akış Başına Bayt</div>
        </div>
      </div>

      {/* Protocol & Port Distribution Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Protocol Distribution */}
        <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-5 rounded space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#ecebe6] border-b border-[rgba(236,235,230,0.12)] pb-3">
            PROTOKOL DAĞILIMI
          </h3>

          <div className="space-y-3">
            {data.protocolDistribution.length === 0 ? (
              <div className="text-xs text-[#8b8f98] py-4 text-center">Henüz akış kaydı yok.</div>
            ) : (
              data.protocolDistribution.map((item) => (
                <div key={item.protocol} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-[#ecebe6]">{item.protocol}</span>
                    <span className="text-[#8b8f98]">
                      {item.count} akış ({item.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#060709] h-2 rounded overflow-hidden">
                    <div
                      style={{ width: `${item.percentage}%` }}
                      className="bg-[#4f8cff] h-full rounded"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Destination Ports */}
        <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-5 rounded space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#ecebe6] border-b border-[rgba(236,235,230,0.12)] pb-3">
            EN ÇOK HEDEF ALINAN PORTLAR
          </h3>

          <div className="space-y-2 text-xs">
            {data.portDistribution.length === 0 ? (
              <div className="text-xs text-[#8b8f98] py-4 text-center">Henüz akış kaydı yok.</div>
            ) : (
              data.portDistribution.map((item) => (
                <div
                  key={item.port}
                  className="flex items-center justify-between p-2 bg-[#060709] rounded border border-[rgba(236,235,230,0.06)]"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#ecebe6]">Port :{item.port}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-[#1a1d23] text-[#8b8f98] rounded">
                      {item.service}
                    </span>
                  </div>
                  <div className="text-[#8b8f98]">{item.count} akış</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Network Flows Table */}
      <div className="border border-[rgba(236,235,230,0.12)] bg-[#060709] rounded overflow-hidden">
        <div className="p-4 bg-[#101216] border-b border-[rgba(236,235,230,0.12)] flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#ecebe6]">
            SON İŞLENEN AĞ AKIŞLARI
          </h3>
          <span className="text-[10px] text-[#8b8f98]">PostgreSQL &apos;Flow&apos; tablosu</span>
        </div>

        {data.recentFlows.length === 0 ? (
          <EmptyState
            title="KAYITLI AKIŞ BULUNAMADI"
            description="Replay motoru veya ağ yakalama aracıyla akış üretildiğinde burada listelenir."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#101216] border-b border-[rgba(236,235,230,0.12)] text-[#8b8f98] uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">ZAMAN</th>
                  <th className="py-2.5 px-4">KAYNAK → HEDEF</th>
                  <th className="py-2.5 px-4">PROTOKOL</th>
                  <th className="py-2.5 px-4">SÜRE (MS)</th>
                  <th className="py-2.5 px-4">PAKETLER</th>
                  <th className="py-2.5 px-4">BAYT</th>
                  <th className="py-2.5 px-4 text-right">TESPİT DURUMU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(236,235,230,0.06)]">
                {data.recentFlows.map((flow) => {
                  const det = flow.detections?.[0];
                  return (
                    <tr key={flow.id} className="hover:bg-[#101216]/60 transition-colors">
                      <td className="py-2.5 px-4 text-[#8b8f98] whitespace-nowrap">
                        {new Date(flow.timestamp).toLocaleTimeString()}
                      </td>

                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className="text-[#ecebe6]">{flow.sourceIp}</span>
                        <span className="mx-1 text-[#8b8f98]">→</span>
                        <span className="text-[#ecebe6]">{flow.destinationIp}</span>
                        <span className="text-[#8b8f98]/70 text-[10px] ml-1">
                          :{flow.destinationPort}
                        </span>
                      </td>

                      <td className="py-2.5 px-4 text-[#ecebe6] font-medium">
                        {flow.protocol}
                      </td>

                      <td className="py-2.5 px-4 text-[#8b8f98]">
                        {flow.durationMs?.toFixed(1)}
                      </td>

                      <td className="py-2.5 px-4 text-[#8b8f98]">
                        {flow.totalFwdPackets + flow.totalBwdPackets}
                      </td>

                      <td className="py-2.5 px-4 text-[#8b8f98]">
                        {(flow.totalFwdBytes + flow.totalBwdBytes).toLocaleString()}
                      </td>

                      <td className="py-2.5 px-4 text-right">
                        {det ? (
                          <Link href={`/threats/${det.id}`}>
                            <SeverityBadge severity={det.severity} size="sm" />
                          </Link>
                        ) : (
                          <span className="text-[10px] text-[#8b8f98]">Tespit Yok</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
