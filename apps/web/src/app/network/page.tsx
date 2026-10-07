'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Network,
  RefreshCw,
  Server,
  Radio,
  Activity,
  Play,
  Square,
  AlertTriangle,
  CheckCircle,
  Database,
  Layers,
} from 'lucide-react';
import {
  getNetworkStats,
  NetworkStatsResponse,
  getSensorStatus,
  LiveSensorStatus,
  startSensorCapture,
  stopSensorCapture,
} from '../../lib/api';
import { EmptyState, ErrorState, LoadingSkeleton } from '../../components/ui/EmptyState';
import { SeverityBadge } from '../../components/ui/SeverityBadge';

export default function NetworkPage() {
  const [data, setData] = useState<NetworkStatsResponse | null>(null);
  const [sensorStatus, setSensorStatus] = useState<LiveSensorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [sensorActionLoading, setSensorActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [netRes, sensorRes] = await Promise.all([
        getNetworkStats(),
        getSensorStatus().catch(() => null),
      ]);
      setData(netRes);
      if (sensorRes) setSensorStatus(sensorRes);
    } catch (err: any) {
      setError(err?.message || 'Ağ istatistikleri yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleStartSensor = async () => {
    try {
      setSensorActionLoading(true);
      setActionMessage(null);
      const res = await startSensorCapture();
      if (!res.success) {
        setActionMessage(`Sensor başlatılamadı: ${res.error || res.status}`);
      } else {
        setActionMessage('Sensor başarıyla başlatıldı');
      }
      const updated = await getSensorStatus();
      setSensorStatus(updated);
    } catch (err: any) {
      setActionMessage(`Hata: ${err.message}`);
    } finally {
      setSensorActionLoading(false);
    }
  };

  const handleStopSensor = async () => {
    try {
      setSensorActionLoading(true);
      setActionMessage(null);
      await stopSensorCapture();
      setActionMessage('Sensor durduruldu');
      const updated = await getSensorStatus();
      setSensorStatus(updated);
    } catch (err: any) {
      setActionMessage(`Hata: ${err.message}`);
    } finally {
      setSensorActionLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(async () => {
      try {
        const s = await getSensorStatus();
        setSensorStatus(s);
      } catch {
        // silent background probe
      }
    }, 5000);
    return () => clearInterval(interval);
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

  const liveFlowCount = data.sourceBreakdown?.find((s) => s.source === 'live')?.count || 0;
  const replayFlowCount = data.sourceBreakdown?.find((s) => s.source === 'replay')?.count || data.totalFlows - liveFlowCount;

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
            İki Yönlü Akış Rekonstrüksiyonu, Canlı Sensör Telemetrisi ve Canonical 77-Feature İncelemesi
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

      {/* Phase 6 Live Sensor Operational Panel */}
      <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] rounded p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[rgba(236,235,230,0.08)] pb-3">
          <div className="flex items-center gap-2.5">
            <Radio className={`w-4 h-4 ${sensorStatus?.capture_state === 'RUNNING' ? 'text-[#00f2fe] animate-pulse' : 'text-[#8b8f98]'}`} />
            <span className="text-xs font-bold uppercase tracking-wider text-[#ecebe6]">
              CANLI AĞ SENSÖRÜ (PHASE 6 — LIVE SENSOR)
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded border uppercase font-semibold ${
                sensorStatus?.capture_state === 'RUNNING'
                  ? 'bg-[#00f2fe]/10 text-[#00f2fe] border-[#00f2fe]/30'
                  : sensorStatus?.capture_state === 'SENSOR_UNAVAILABLE'
                  ? 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30'
                  : 'bg-[#8b8f98]/10 text-[#8b8f98] border-[#8b8f98]/30'
              }`}
            >
              {sensorStatus?.capture_state || 'UNKNOWN'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {sensorStatus?.capture_state === 'RUNNING' ? (
              <button
                onClick={handleStopSensor}
                disabled={sensorActionLoading}
                className="flex items-center gap-1.5 px-3 py-1 bg-[#ef4444]/20 hover:bg-[#ef4444]/30 text-[#ef4444] border border-[#ef4444]/40 rounded text-xs transition-colors"
              >
                <Square className="w-3 h-3" />
                <span>Sensörü Durdur</span>
              </button>
            ) : (
              <button
                onClick={handleStartSensor}
                disabled={sensorActionLoading}
                className="flex items-center gap-1.5 px-3 py-1 bg-[#00f2fe]/10 hover:bg-[#00f2fe]/20 text-[#00f2fe] border border-[#00f2fe]/30 rounded text-xs transition-colors"
              >
                <Play className="w-3 h-3" />
                <span>Sensörü Başlat</span>
              </button>
            )}
          </div>
        </div>

        {actionMessage && (
          <div className="text-[11px] px-3 py-2 rounded bg-[#1a1d23] border border-[rgba(236,235,230,0.12)] text-[#ecebe6]">
            {actionMessage}
          </div>
        )}

        {sensorStatus?.error_message && (
          <div className="flex items-start gap-2 p-3 bg-[#f59e0b]/10 border border-[#f59e0b]/30 rounded text-xs text-[#f59e0b]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold uppercase text-[10px]">Sensör Durumu / Sürücü Uyarısı:</div>
              <div className="text-[11px] mt-0.5">{sensorStatus.error_message}</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 pt-1">
          <div className="bg-[#0b0d10] p-3 rounded border border-[rgba(236,235,230,0.06)]">
            <div className="text-[10px] text-[#8b8f98] uppercase">AĞ ARAYÜZÜ</div>
            <div className="text-xs font-bold text-[#ecebe6] mt-1 truncate" title={sensorStatus?.capture_interface || 'NONE'}>
              {sensorStatus?.capture_interface || 'YOK'}
            </div>
            <div className="text-[9px] text-[#8b8f98] mt-0.5">
              Npcap: {sensorStatus?.npcap_installed ? 'MEVCUT' : 'EKSİK'}
            </div>
          </div>

          <div className="bg-[#0b0d10] p-3 rounded border border-[rgba(236,235,230,0.06)]">
            <div className="text-[10px] text-[#8b8f98] uppercase">YAKALANAN PAKET</div>
            <div className="text-sm font-bold text-[#ecebe6] mt-1">
              {(sensorStatus?.packets_observed || 0).toLocaleString()}
            </div>
            <div className="text-[9px] text-[#8b8f98] mt-0.5">Scapy Sniffer</div>
          </div>

          <div className="bg-[#0b0d10] p-3 rounded border border-[rgba(236,235,230,0.06)]">
            <div className="text-[10px] text-[#8b8f98] uppercase">AKTİF AKIŞLAR</div>
            <div className="text-sm font-bold text-[#00f2fe] mt-1">
              {sensorStatus?.flows_active || 0}
            </div>
            <div className="text-[9px] text-[#8b8f98] mt-0.5">Flow Table Tablosu</div>
          </div>

          <div className="bg-[#0b0d10] p-3 rounded border border-[rgba(236,235,230,0.06)]">
            <div className="text-[10px] text-[#8b8f98] uppercase">TAMAMLANAN AKIŞ</div>
            <div className="text-sm font-bold text-[#ecebe6] mt-1">
              {(sensorStatus?.flows_completed || 0).toLocaleString()}
            </div>
            <div className="text-[9px] text-[#8b8f98] mt-0.5">TCP FIN/RST Teardown</div>
          </div>

          <div className="bg-[#0b0d10] p-3 rounded border border-[rgba(236,235,230,0.06)]">
            <div className="text-[10px] text-[#8b8f98] uppercase">ZAMAN AŞIMI (TIMEOUT)</div>
            <div className="text-sm font-bold text-[#ecebe6] mt-1">
              {(sensorStatus?.flows_expired || 0).toLocaleString()}
            </div>
            <div className="text-[9px] text-[#8b8f98] mt-0.5">UDP / Inactive TCP</div>
          </div>

          <div className="bg-[#0b0d10] p-3 rounded border border-[rgba(236,235,230,0.06)]">
            <div className="text-[10px] text-[#8b8f98] uppercase">HATA / DROPPED</div>
            <div className="text-sm font-bold text-[#ecebe6] mt-1">
              {sensorStatus?.feature_extraction_errors || 0}
            </div>
            <div className="text-[9px] text-[#8b8f98] mt-0.5">Schema Hataları</div>
          </div>
        </div>
      </div>

      {/* Dual Data Source Pipeline Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-4 rounded flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#9d4edd]/10 border border-[#9d4edd]/30 rounded">
              <Database className="w-5 h-5 text-[#c77dff]" />
            </div>
            <div>
              <div className="text-[10px] text-[#8b8f98] uppercase">VERİ KAYNAĞI: BENCHMARK / REPLAY</div>
              <div className="text-lg font-bold text-[#ecebe6] mt-0.5">
                {replayFlowCount.toLocaleString()} Akış
              </div>
              <div className="text-[10px] text-[#8b8f98]">CIC-IDS2017 Dataset Replay Motoru</div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] px-2 py-0.5 bg-[#9d4edd]/10 text-[#c77dff] border border-[#9d4edd]/30 rounded font-semibold uppercase">
              REPLAY
            </span>
          </div>
        </div>

        <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-4 rounded flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#00f2fe]/10 border border-[#00f2fe]/30 rounded">
              <Radio className="w-5 h-5 text-[#00f2fe]" />
            </div>
            <div>
              <div className="text-[10px] text-[#8b8f98] uppercase">VERİ KAYNAĞI: CANLI SENSÖR (LIVE)</div>
              <div className="text-lg font-bold text-[#ecebe6] mt-0.5">
                {liveFlowCount.toLocaleString()} Akış
              </div>
              <div className="text-[10px] text-[#8b8f98]">Gerçek Ağ Arayüzü / PCAP Yakalama</div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] px-2 py-0.5 bg-[#00f2fe]/10 text-[#00f2fe] border border-[#00f2fe]/30 rounded font-semibold uppercase">
              LIVE
            </span>
          </div>
        </div>
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
              <div className="text-xs text-[#8b8f98]">Henüz protokol verisi bulunmuyor.</div>
            ) : (
              data.protocolDistribution.map((proto) => (
                <div key={proto.protocol} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#ecebe6] font-semibold">{proto.protocol}</span>
                    <span className="text-[#8b8f98]">
                      {proto.count.toLocaleString()} (%{proto.percentage})
                    </span>
                  </div>
                  <div className="w-full bg-[#1a1d23] h-1.5 rounded overflow-hidden">
                    <div
                      className="bg-[#4f8cff] h-full rounded transition-all duration-300"
                      style={{ width: `${proto.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Port Distribution */}
        <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-5 rounded space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#ecebe6] border-b border-[rgba(236,235,230,0.12)] pb-3">
            EN ÇOK HEDEF ALINAN PORTLAR
          </h3>

          <div className="space-y-3">
            {data.portDistribution.length === 0 ? (
              <div className="text-xs text-[#8b8f98]">Henüz port aktivitesi bulunmuyor.</div>
            ) : (
              data.portDistribution.map((port) => (
                <div key={port.port} className="flex items-center justify-between text-xs py-1 border-b border-[rgba(236,235,230,0.04)] last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[#ecebe6] font-semibold">{port.port}</span>
                    <span className="text-[#8b8f98] text-[10px]">({port.service})</span>
                  </div>
                  <span className="text-[#8b8f98]">{port.count.toLocaleString()} akış</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Flows Table */}
      <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] rounded overflow-hidden">
        <div className="p-4 border-b border-[rgba(236,235,230,0.12)] flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#ecebe6]">
            SON GÖZLEMLENEN AKIŞLAR
          </h3>
          <span className="text-[10px] text-[#8b8f98]">Son 20 İşlem</span>
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
                  <th className="py-2.5 px-4">KAYNAK TÜRÜ</th>
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
                  const isLive = flow.source === 'live';
                  return (
                    <tr key={flow.id} className="hover:bg-[#101216]/60 transition-colors">
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded border uppercase font-semibold ${
                            isLive
                              ? 'bg-[#00f2fe]/10 text-[#00f2fe] border-[#00f2fe]/30'
                              : 'bg-[#9d4edd]/10 text-[#c77dff] border-[#9d4edd]/30'
                          }`}
                        >
                          {isLive ? 'LIVE' : 'REPLAY'}
                        </span>
                      </td>

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
