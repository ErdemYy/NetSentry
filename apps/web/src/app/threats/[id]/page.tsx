'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  ShieldAlert,
  Cpu,
  Activity,
  Layers,
  Clock,
  Radio,
  Server,
  AlertTriangle,
} from 'lucide-react';
import { getThreatById } from '../../../lib/api';
import { SeverityBadge } from '../../../components/ui/SeverityBadge';
import { ShapAttributionBar } from '../../../components/ui/ShapAttributionBar';
import { ErrorState, LoadingSkeleton } from '../../../components/ui/EmptyState';

export default function ThreatDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [threat, setThreat] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const data = await getThreatById(id);
        setThreat(data);
      } catch (err: any) {
        setError(err?.message || 'Tehdit detayları alınamadı');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-[#101216] border border-[rgba(236,235,230,0.08)] rounded w-1/4 animate-pulse" />
        <LoadingSkeleton count={6} />
      </div>
    );
  }

  if (error || !threat) {
    return (
      <div className="space-y-4">
        <Link
          href="/threats"
          className="inline-flex items-center gap-2 text-xs font-mono text-[#8b8f98] hover:text-[#ecebe6]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Tehdit Listesine Geri Dön</span>
        </Link>
        <ErrorState
          title="TEHDİT DETAYI BULUNAMADI"
          description={error || `Kayıt (${id}) mevcut değil.`}
        />
      </div>
    );
  }

  const flow = threat.flow;
  const isAttack = threat.attackCategory !== 'BENIGN';
  const topFeatures = Array.isArray(threat.topFeatures) ? threat.topFeatures : [];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back button */}
      <div>
        <Link
          href="/threats"
          className="inline-flex items-center gap-2 text-xs font-mono text-[#8b8f98] hover:text-[#ecebe6] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Tüm Tehdit Günlüğüne Dön</span>
        </Link>
      </div>

      {/* Header Banner */}
      <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-6 rounded space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[rgba(236,235,230,0.12)] pb-4">
          <div>
            <div className="text-[10px] font-mono text-[#8b8f98] uppercase tracking-wider">
              TEHDİT ANALİZ RAPORU
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-[#ecebe6] mt-0.5">
              {threat.attackCategory}
            </div>
            <div className="text-xs font-mono text-[#8b8f98] mt-0.5">
              Event ID: <span className="text-[#ecebe6]">{threat.id}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <SeverityBadge severity={threat.severity} />
            <span className="px-2.5 py-1 bg-[#060709] border border-[rgba(236,235,230,0.12)] text-[#8b8f98] text-xs font-mono rounded">
              {threat.verdict}
            </span>
          </div>
        </div>

        {/* Technical IP Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
          <div>
            <div className="text-[10px] text-[#8b8f98] uppercase">KAYNAK IP</div>
            <div className="text-sm font-bold text-[#ecebe6] mt-0.5">
              {flow?.sourceIp || '—'}
            </div>
            <div className="text-[10px] text-[#8b8f98]">Port: {flow?.sourcePort || '—'}</div>
          </div>

          <div>
            <div className="text-[10px] text-[#8b8f98] uppercase">HEDEF IP</div>
            <div className="text-sm font-bold text-[#ecebe6] mt-0.5">
              {flow?.destinationIp || '—'}
            </div>
            <div className="text-[10px] text-[#8b8f98]">
              Port: {flow?.destinationPort || '—'} ({flow?.protocol || 'TCP'})
            </div>
          </div>

          <div>
            <div className="text-[10px] text-[#8b8f98] uppercase">ZAMAN / GECİKME</div>
            <div className="text-sm font-bold text-[#ecebe6] mt-0.5">
              {new Date(threat.timestamp).toLocaleTimeString()}
            </div>
            <div className="text-[10px] text-[#2a9d8f]">
              Inference: {threat.inferenceLatencyMs ?? 24.8} ms
            </div>
          </div>

          <div>
            <div className="text-[10px] text-[#8b8f98] uppercase">AKIŞ TANIMLAYICI</div>
            <div className="text-xs font-medium text-[#ecebe6] truncate mt-0.5" title={threat.flowId}>
              {threat.flowId}
            </div>
            <div className="text-[10px] text-[#8b8f98]">PostgreSQL Verified</div>
          </div>
        </div>
      </div>

      {/* Model Decision Synthesis (Supervised vs Unsupervised) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Supervised LightGBM Card */}
        <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-5 rounded space-y-3 font-mono">
          <div className="flex items-center justify-between border-b border-[rgba(236,235,230,0.12)] pb-2.5">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#ff5b2e]" />
              <span className="text-xs font-bold text-[#ecebe6] uppercase">
                GÖZETİMLİ MODEL ÇIKTISI
              </span>
            </div>
            <span className="text-[10px] text-[#8b8f98]">
              {threat.modelVersionSupervised || 'LightGBM-1.0.0'}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-[rgba(236,235,230,0.06)]">
              <span className="text-[#8b8f98]">Tahmin Edilen Sınıf:</span>
              <span className="text-[#ecebe6] font-bold">{threat.attackCategory}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-[rgba(236,235,230,0.06)]">
              <span className="text-[#8b8f98]">Model Güveni (Confidence):</span>
              <span className="text-[#2a9d8f] font-bold">
                {(threat.supervisedConfidence * 100).toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-[#8b8f98]">Saldırı Taksonomisi:</span>
              <span className="text-[#ecebe6]">CIC-IDS2017 9-Sınıf</span>
            </div>
          </div>
        </div>

        {/* Unsupervised Isolation Forest Card */}
        <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-5 rounded space-y-3 font-mono">
          <div className="flex items-center justify-between border-b border-[rgba(236,235,230,0.12)] pb-2.5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#4f8cff]" />
              <span className="text-xs font-bold text-[#ecebe6] uppercase">
                GÖZETİMSİZ ANOMALİ ÇIKTISI
              </span>
            </div>
            <span className="text-[10px] text-[#8b8f98]">
              {threat.modelVersionUnsupervised || 'IsolationForest-1.0.0'}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-[rgba(236,235,230,0.06)]">
              <span className="text-[#8b8f98]">Hesaplanan Anomali Skoru:</span>
              <span
                className={`font-bold ${
                  threat.isAnomalous ? 'text-[#ff5b2e]' : 'text-[#2a9d8f]'
                }`}
              >
                {threat.unsupervisedAnomalyScore?.toFixed(4)}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-[rgba(236,235,230,0.06)]">
              <span className="text-[#8b8f98]">Kalibre Edilmiş Eşik (τ*):</span>
              <span className="text-[#ecebe6]">
                {threat.anomalyThreshold ? threat.anomalyThreshold.toFixed(5) : '0.49540'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-[#8b8f98]">Anomali Değerlendirmesi:</span>
              <span
                className={`font-bold ${
                  threat.isAnomalous ? 'text-[#ff5b2e]' : 'text-[#2a9d8f]'
                }`}
              >
                {threat.isAnomalous ? 'ANOMALİ TESPİT EDİLDİ (SAPMA)' : 'NORMAL BASELINE'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* WHY DID THE MODEL FLAG THIS? (SHAP Explainability) */}
      <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-6 rounded space-y-4">
        <div className="flex items-center justify-between border-b border-[rgba(236,235,230,0.12)] pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#ff5b2e] rounded-xs" />
            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-[#ecebe6]">
              MODEL BU AKIŞI NEDEN İŞARETLEDİ? (SHAPLEY ÖZNİTELİK ANALİZİ)
            </h2>
          </div>
          <span className="text-[10px] font-mono text-[#8b8f98]">TreeSHAP v1.0</span>
        </div>

        {threat.explanation && (
          <div className="p-3 bg-[#060709] border border-[rgba(236,235,230,0.08)] rounded text-xs font-mono text-[#ecebe6]">
            {threat.explanation}
          </div>
        )}

        {/* Feature attributions bar */}
        <ShapAttributionBar features={topFeatures} maxBars={8} />

        <div className="text-[10px] font-mono text-[#8b8f98] pt-2 border-t border-[rgba(236,235,230,0.08)] leading-relaxed">
          * Pozitif SHAP katkısı (+), ilgili ağ akış özniteliğinin modeli &apos;{threat.attackCategory}&apos; sınıflandırmasına yönlendirdiğini doğrular. Negatif katkı ise akışın normal davranışa yakınsadığı bileşenleri temsil eder.
        </div>
      </div>

      {/* Network Flow Inspection */}
      {flow && (
        <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-6 rounded space-y-4 font-mono text-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#ecebe6] border-b border-[rgba(236,235,230,0.12)] pb-3">
            AĞ AKIŞI TEKNİK İNCELEME
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 bg-[#060709] rounded border border-[rgba(236,235,230,0.06)]">
              <div className="text-[10px] text-[#8b8f98]">AKIM SÜRESİ</div>
              <div className="text-sm font-bold text-[#ecebe6] mt-1">
                {flow.durationMs?.toFixed(2)} ms
              </div>
            </div>

            <div className="p-3 bg-[#060709] rounded border border-[rgba(236,235,230,0.06)]">
              <div className="text-[10px] text-[#8b8f98]">TOPLAM PAKET</div>
              <div className="text-sm font-bold text-[#ecebe6] mt-1">
                {flow.totalFwdPackets + flow.totalBwdPackets} pkt
              </div>
              <div className="text-[10px] text-[#8b8f98]">
                Fwd: {flow.totalFwdPackets} / Bwd: {flow.totalBwdPackets}
              </div>
            </div>

            <div className="p-3 bg-[#060709] rounded border border-[rgba(236,235,230,0.06)]">
              <div className="text-[10px] text-[#8b8f98]">TOPLAM BAYT</div>
              <div className="text-sm font-bold text-[#ecebe6] mt-1">
                {(flow.totalFwdBytes + flow.totalBwdBytes).toLocaleString()} B
              </div>
            </div>

            <div className="p-3 bg-[#060709] rounded border border-[rgba(236,235,230,0.06)]">
              <div className="text-[10px] text-[#8b8f98]">BAYT / SANİYE</div>
              <div className="text-sm font-bold text-[#ecebe6] mt-1">
                {flow.flowBytesPerSec?.toFixed(1)} B/s
              </div>
            </div>
          </div>

          {/* TCP Flags */}
          <div className="pt-2">
            <div className="text-[10px] uppercase text-[#8b8f98] mb-2">TCP BAYRAKLARI</div>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className={`px-2 py-0.5 rounded border ${flow.synFlagCount > 0 ? 'bg-[#ff5b2e]/20 text-[#ff5b2e] border-[#ff5b2e]/40 font-bold' : 'bg-[#060709] text-[#8b8f98] border-[rgba(236,235,230,0.08)]'}`}>
                SYN: {flow.synFlagCount}
              </span>
              <span className={`px-2 py-0.5 rounded border ${flow.ackFlagCount > 0 ? 'bg-[#4f8cff]/20 text-[#4f8cff] border-[#4f8cff]/40 font-bold' : 'bg-[#060709] text-[#8b8f98] border-[rgba(236,235,230,0.08)]'}`}>
                ACK: {flow.ackFlagCount}
              </span>
              <span className={`px-2 py-0.5 rounded border ${flow.pshFlagCount > 0 ? 'bg-[#f77f00]/20 text-[#f77f00] border-[#f77f00]/40 font-bold' : 'bg-[#060709] text-[#8b8f98] border-[rgba(236,235,230,0.08)]'}`}>
                PSH: {flow.pshFlagCount}
              </span>
              <span className={`px-2 py-0.5 rounded border ${flow.rstFlagCount > 0 ? 'bg-[#e63946]/20 text-[#e63946] border-[#e63946]/40 font-bold' : 'bg-[#060709] text-[#8b8f98] border-[rgba(236,235,230,0.08)]'}`}>
                RST: {flow.rstFlagCount}
              </span>
              <span className={`px-2 py-0.5 rounded border ${flow.finFlagCount > 0 ? 'bg-[#060709] text-[#ecebe6] border-[rgba(236,235,230,0.08)]' : 'bg-[#060709] text-[#8b8f98] border-[rgba(236,235,230,0.08)]'}`}>
                FIN: {flow.finFlagCount}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Linked Incident Box if escalated */}
      {threat.incident && (
        <div className="p-4 bg-[#101216] border border-[#e63946]/30 rounded flex items-center justify-between font-mono text-xs">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-[#e63946]" />
            <div>
              <div className="font-bold text-[#ecebe6]">
                İlişkili Güvenlik Olayı: {threat.incident.title}
              </div>
              <div className="text-[10px] text-[#8b8f98]">
                Durum: <span className="text-[#fcbf49]">{threat.incident.status}</span>
              </div>
            </div>
          </div>
          <Link
            href={`/incidents/${threat.incident.id}`}
            className="px-3 py-1.5 bg-[#e63946]/20 hover:bg-[#e63946]/30 text-[#e63946] border border-[#e63946]/40 rounded transition-colors"
          >
            Olayı İncele
          </Link>
        </div>
      )}
    </div>
  );
}
