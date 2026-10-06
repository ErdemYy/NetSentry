'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Layers,
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  User,
} from 'lucide-react';
import { getIncidentById, updateIncidentStatus } from '../../../lib/api';
import { SeverityBadge } from '../../../components/ui/SeverityBadge';
import { ErrorState, LoadingSkeleton } from '../../../components/ui/EmptyState';

export default function IncidentDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [incident, setIncident] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const load = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getIncidentById(id);
      setIncident(data);
    } catch (err: any) {
      setError(err?.message || 'Olay detayları yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleStatusChange = async (newStatus: string) => {
    try {
      setUpdating(true);
      await updateIncidentStatus(id, newStatus);
      await load();
    } catch (err: any) {
      alert(`Durum güncellenemedi: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-[#101216] rounded w-1/4 animate-pulse" />
        <LoadingSkeleton count={5} />
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="space-y-4">
        <Link
          href="/incidents"
          className="inline-flex items-center gap-2 text-xs font-mono text-[#8b8f98] hover:text-[#ecebe6]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Olay Listesine Dön</span>
        </Link>
        <ErrorState
          title="OLAY BULUNAMADI"
          description={error || `Olay kaydı (${id}) mevcut değil.`}
        />
      </div>
    );
  }

  const detection = incident.detection;

  return (
    <div className="space-y-6 max-w-5xl font-mono">
      {/* Back Link */}
      <div>
        <Link
          href="/incidents"
          className="inline-flex items-center gap-2 text-xs text-[#8b8f98] hover:text-[#ecebe6] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Tüm Olaylara Geri Dön</span>
        </Link>
      </div>

      {/* Header Card */}
      <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-6 rounded space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[rgba(236,235,230,0.12)] pb-4">
          <div>
            <div className="text-[10px] text-[#8b8f98] uppercase tracking-wider">
              GÜVENLİK OLAYI DETAYI
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#ecebe6] mt-0.5">
              {incident.title}
            </h1>
            <div className="text-xs text-[#8b8f98] mt-1">
              ID: <span className="text-[#ecebe6]">{incident.id}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <SeverityBadge severity={incident.severity} />
            <span className="px-2.5 py-1 bg-[#060709] border border-[rgba(236,235,230,0.12)] text-[#fcbf49] text-xs font-semibold rounded">
              {incident.status}
            </span>
          </div>
        </div>

        {/* Triage Status Transition Action Strip */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="text-[#8b8f98] mr-2">DURUMU GÜNCELLE:</span>
          {['INVESTIGATING', 'CONFIRMED_THREAT', 'RESOLVED', 'FALSE_POSITIVE'].map(
            (statusKey) => (
              <button
                key={statusKey}
                disabled={updating || incident.status === statusKey}
                onClick={() => handleStatusChange(statusKey)}
                className={`px-3 py-1 rounded border text-[11px] transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                  incident.status === statusKey
                    ? 'bg-[#1a1d23] text-[#ecebe6] border-[#ff5b2e]'
                    : 'bg-[#060709] hover:bg-[#1a1d23] text-[#8b8f98] hover:text-[#ecebe6] border-[rgba(236,235,230,0.12)]'
                }`}
              >
                {statusKey}
              </button>
            ),
          )}
        </div>
      </div>

      {/* Target & Source Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[#101216] border border-[rgba(236,235,230,0.12)] p-4 rounded text-xs">
        <div>
          <div className="text-[10px] text-[#8b8f98] uppercase">SALDIRGAN KAYNAK</div>
          <div className="text-sm font-bold text-[#e63946] mt-1">{incident.sourceIp}</div>
        </div>
        <div>
          <div className="text-[10px] text-[#8b8f98] uppercase">HEDEF SUNUCU</div>
          <div className="text-sm font-bold text-[#ecebe6] mt-1">{incident.destinationIp}</div>
        </div>
        <div>
          <div className="text-[10px] text-[#8b8f98] uppercase">İLK GÖRÜLME</div>
          <div className="text-sm font-medium text-[#ecebe6] mt-1">
            {new Date(incident.firstSeen).toLocaleTimeString()}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[#8b8f98] uppercase">SON ETKİNLİK</div>
          <div className="text-sm font-medium text-[#ecebe6] mt-1">
            {new Date(incident.lastSeen).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Linked Detection Reference */}
      {detection && (
        <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-5 rounded space-y-3">
          <div className="flex items-center justify-between border-b border-[rgba(236,235,230,0.12)] pb-2.5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#ff5b2e]" />
              <span className="text-xs font-bold text-[#ecebe6] uppercase">
                TETİKLEYİCİ TESPİT KAYDI
              </span>
            </div>
            <Link
              href={`/threats/${detection.id}`}
              className="text-xs text-[#4f8cff] hover:underline"
            >
              Tam Tespit Detayı →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-[#060709] rounded border border-[rgba(236,235,230,0.06)]">
              <div className="text-[10px] text-[#8b8f98]">SALDIRI TÜRÜ</div>
              <div className="font-bold text-[#ecebe6] mt-0.5">{detection.attackCategory}</div>
              <div className="text-[10px] text-[#8b8f98]">{detection.verdict}</div>
            </div>

            <div className="p-3 bg-[#060709] rounded border border-[rgba(236,235,230,0.06)]">
              <div className="text-[10px] text-[#8b8f98]">MODEL GÜVENİ</div>
              <div className="font-bold text-[#2a9d8f] mt-0.5">
                {(detection.supervisedConfidence * 100).toFixed(1)}%
              </div>
              <div className="text-[10px] text-[#8b8f98]">LightGBM</div>
            </div>

            <div className="p-3 bg-[#060709] rounded border border-[rgba(236,235,230,0.06)]">
              <div className="text-[10px] text-[#8b8f98]">ANOMALİ SKORU</div>
              <div className="font-bold text-[#ff5b2e] mt-0.5">
                {detection.unsupervisedAnomalyScore?.toFixed(4)}
              </div>
              <div className="text-[10px] text-[#8b8f98]">Isolation Forest (τ* = 0.4954)</div>
            </div>
          </div>

          {detection.explanation && (
            <div className="text-xs text-[#8b8f98] p-3 bg-[#060709] border border-[rgba(236,235,230,0.06)] rounded">
              {detection.explanation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
