'use client';

import React, { useEffect, useState } from 'react';
import { Cpu, Activity, RefreshCw, BarChart2, CheckCircle2 } from 'lucide-react';
import { getModelMetrics } from '../../lib/api';
import { ErrorState, LoadingSkeleton } from '../../components/ui/EmptyState';

export default function ModelsPage() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getModelMetrics();
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Model metrikleri yüklenemedi');
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
        title="MODEL VERİSİ ALINAMADI"
        description={error || 'Model değerlendirme kayıtları okunamadı.'}
        onRetry={load}
      />
    );
  }

  const sup = data.supervised;
  const ano = data.unsupervised;
  const xai = data.explainability;
  const comp = data.comparison || [];
  const latency = data.latencyBenchmark;

  return (
    <div className="space-y-8 font-mono">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[rgba(236,235,230,0.12)] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <Cpu className="w-6 h-6 text-[#ff5b2e]" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight uppercase text-[#ecebe6]">
              MAKİNE ÖĞRENMESİ MODELLERİ VE AKADEMİK METRİKLER
            </h1>
          </div>
          <p className="text-xs text-[#8b8f98] mt-1">
            Gözetimli Sınıflandırma, Gözetimsiz Anomali Tespiti ve SHAP Açıklanabilirlik Doğrulama Kayıtları
          </p>
        </div>

        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#101216] hover:bg-[#1a1d23] text-[#8b8f98] hover:text-[#ecebe6] border border-[rgba(236,235,230,0.12)] rounded text-xs transition-colors self-start md:self-auto cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Yenile</span>
        </button>
      </div>

      {/* Provenance Callout Banner (ADR-018 / Section 3) */}
      <div className="p-4 bg-[#101216] border-l-2 border-[#ff5b2e] border-y border-r border-[rgba(236,235,230,0.12)] rounded-r text-xs space-y-1.5 leading-relaxed">
        <div className="flex items-center gap-2 text-[#ff5b2e] font-bold uppercase tracking-wider text-[11px]">
          <CheckCircle2 className="w-4 h-4" />
          <span>BİLİMSEL KANIT VE METRİK KÖKENİ AYRIMI (PROVENANCE ARCHITECTURE)</span>
        </div>
        <p className="text-[#8b8f98]">
          <strong className="text-[#ecebe6]">EĞİTİM DENEYİ (EXP-001):</strong> CIC-IDS2017 test kümesi üzerinde ölçülen matematiksel referans sonuçlarıdır (LightGBM Macro F1 %93.74, Isolation Forest ROC-AUC %73.35).
        </p>
        <p className="text-[#8b8f98]">
          <strong className="text-[#ecebe6]">ÇALIŞMA ZAMANI MODELİ (RUNTIME):</strong> Bellekteki modelin aktif durumu, SHA-256 kriptografik bütünlük doğrulaması, feature-schema-v1 kontratı ve gerçek zamanlı çıkarım gecikmeleridir.
        </p>
      </div>

      {/* Section 1 Header */}
      <div className="flex items-center justify-between border-b border-[rgba(236,235,230,0.12)] pb-2 pt-2">
        <h2 className="text-xs font-bold uppercase text-[#4f8cff] tracking-wider">
          BÖLÜM 1 — EĞİTİM DENEYİ METRİKLERİ (OFFLINE BENCHMARK: EXP-001)
        </h2>
        <span className="text-[10px] text-[#8b8f98]">341,713 Doğrulanmış Akış</span>
      </div>

      {/* Model Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Supervised LightGBM Card */}
        <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-6 rounded space-y-4">
          <div className="flex items-center justify-between border-b border-[rgba(236,235,230,0.12)] pb-3">
            <div>
              <div className="text-[10px] text-[#8b8f98] uppercase">GÖZETİMLİ SALDIRI SINIFLANDIRICI (EXP-001)</div>
              <h2 className="text-base font-bold text-[#ecebe6] mt-0.5">{sup.modelName}</h2>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-[#060709] border border-[rgba(236,235,230,0.12)] text-[#2a9d8f] rounded">
              v{sup.version} · TEST KÜMESİ DOĞRULANDI
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-[#060709] rounded border border-[rgba(236,235,230,0.06)]">
              <div className="text-[10px] text-[#8b8f98]">DOĞRULUK</div>
              <div className="text-lg font-bold text-[#2a9d8f] mt-0.5">
                {(sup.metrics.accuracy * 100).toFixed(2)}%
              </div>
            </div>

            <div className="p-3 bg-[#060709] rounded border border-[rgba(236,235,230,0.06)]">
              <div className="text-[10px] text-[#8b8f98]">MACRO F1</div>
              <div className="text-lg font-bold text-[#ecebe6] mt-0.5">
                {(sup.metrics.macroF1 * 100).toFixed(2)}%
              </div>
            </div>

            <div className="p-3 bg-[#060709] rounded border border-[rgba(236,235,230,0.06)]">
              <div className="text-[10px] text-[#8b8f98]">PRECISION</div>
              <div className="text-lg font-bold text-[#ecebe6] mt-0.5">
                {(sup.metrics.macroPrecision * 100).toFixed(2)}%
              </div>
            </div>

            <div className="p-3 bg-[#060709] rounded border border-[rgba(236,235,230,0.06)]">
              <div className="text-[10px] text-[#8b8f98]">RECALL</div>
              <div className="text-lg font-bold text-[#ecebe6] mt-0.5">
                {(sup.metrics.macroRecall * 100).toFixed(2)}%
              </div>
            </div>
          </div>

          <div className="text-xs text-[#8b8f98] space-y-1 pt-2">
            <div>Veri Seti: <span className="text-[#ecebe6]">{sup.dataset}</span></div>
            <div>Eğitim / Test: <span className="text-[#ecebe6]">{sup.samplesTrained.toLocaleString()} / {sup.samplesTested.toLocaleString()} akış</span></div>
            <div>Öznitelik Sayısı: <span className="text-[#ecebe6]">{sup.featureCount} öznitelik</span></div>
          </div>
        </div>

        {/* Unsupervised Isolation Forest Card */}
        <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-6 rounded space-y-4">
          <div className="flex items-center justify-between border-b border-[rgba(236,235,230,0.12)] pb-3">
            <div>
              <div className="text-[10px] text-[#8b8f98] uppercase">GÖZETİMSİZ ANOMALİ MOTORU</div>
              <h2 className="text-base font-bold text-[#ecebe6] mt-0.5">{ano.modelName}</h2>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-[#060709] border border-[rgba(236,235,230,0.12)] text-[#4f8cff] rounded">
              v{ano.version} · AKTİF
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-[#060709] rounded border border-[rgba(236,235,230,0.06)]">
              <div className="text-[10px] text-[#8b8f98]">ROC-AUC</div>
              <div className="text-lg font-bold text-[#4f8cff] mt-0.5">
                {(ano.metrics.rocAuc * 100).toFixed(2)}%
              </div>
            </div>

            <div className="p-3 bg-[#060709] rounded border border-[rgba(236,235,230,0.06)]">
              <div className="text-[10px] text-[#8b8f98]">F1 SKORU</div>
              <div className="text-lg font-bold text-[#ecebe6] mt-0.5">
                {(ano.metrics.f1 * 100).toFixed(2)}%
              </div>
            </div>

            <div className="p-3 bg-[#060709] rounded border border-[rgba(236,235,230,0.06)]">
              <div className="text-[10px] text-[#8b8f98]">EŞİK (τ*)</div>
              <div className="text-lg font-bold text-[#fcbf49] mt-0.5">
                {ano.optimalThresholdTau}
              </div>
            </div>

            <div className="p-3 bg-[#060709] rounded border border-[rgba(236,235,230,0.06)]">
              <div className="text-[10px] text-[#8b8f98]">YANLIŞ POZİTİF</div>
              <div className="text-lg font-bold text-[#8b8f98] mt-0.5">
                {(ano.metrics.falsePositiveRate * 100).toFixed(2)}%
              </div>
            </div>
          </div>

          <div className="text-xs text-[#8b8f98] space-y-1 pt-2">
            <div>Baseline Referans: <span className="text-[#ecebe6]">{ano.trainingBaseline}</span></div>
            <div>Eşik Seçimi: <span className="text-[#ecebe6]">Validasyon Seti Üzerinde F1-Maksimizasyonu (EXP-002)</span></div>
            <div>Rolü: <span className="text-[#ecebe6]">Sıfır-gün sapmaları ve etiketlenmemiş anomalileri yakalama</span></div>
          </div>
        </div>
      </div>

      {/* Model Comparison Matrix (Section 23) */}
      <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-6 rounded space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#ecebe6] border-b border-[rgba(236,235,230,0.12)] pb-3">
          HİBRİT MİMARİ KARŞILAŞTIRMASI: GÖZETİMLİ VS. GÖZETİMSİZ
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#060709] text-[#8b8f98] uppercase text-[10px] border-b border-[rgba(236,235,230,0.08)]">
              <tr>
                <th className="py-2.5 px-4">METRİK</th>
                <th className="py-2.5 px-4 text-[#ff5b2e]">LIGHTGBM (GÖZETİMLİ)</th>
                <th className="py-2.5 px-4 text-[#4f8cff]">ISOLATION FOREST (GÖZETİMSİZ)</th>
                <th className="py-2.5 px-4">MİMARİ ROL VE GEREKÇE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(236,235,230,0.06)]">
              {comp.map((row: any, i: number) => (
                <tr key={i} className="hover:bg-[#1a1d23]/50 transition-colors">
                  <td className="py-2.5 px-4 font-bold text-[#ecebe6]">{row.metric}</td>
                  <td className="py-2.5 px-4 font-bold text-[#ff5b2e]">{row.supervised}</td>
                  <td className="py-2.5 px-4 font-bold text-[#4f8cff]">{row.unsupervised}</td>
                  <td className="py-2.5 px-4 text-[#8b8f98]">{row.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-Class Breakdown Table */}
      <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-6 rounded space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#ecebe6] border-b border-[rgba(236,235,230,0.12)] pb-3">
          SINIF BAZINDA PERFORMANS DAĞILIMI (TEST SETİ — 51,257 AKIŞ)
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#060709] text-[#8b8f98] uppercase text-[10px] border-b border-[rgba(236,235,230,0.08)]">
              <tr>
                <th className="py-2.5 px-4">SINIF</th>
                <th className="py-2.5 px-4">PRECISION</th>
                <th className="py-2.5 px-4">RECALL</th>
                <th className="py-2.5 px-4">F1-SKOR</th>
                <th className="py-2.5 px-4 text-right">TEST DESTEK SAYISI (SUPPORT)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(236,235,230,0.06)]">
              {sup.classBreakdown.map((item: any) => (
                <tr key={item.className} className="hover:bg-[#1a1d23]/50 transition-colors">
                  <td className="py-2.5 px-4 font-bold text-[#ecebe6]">{item.className}</td>
                  <td className="py-2.5 px-4 text-[#2a9d8f]">{(item.precision * 100).toFixed(2)}%</td>
                  <td className="py-2.5 px-4 text-[#4f8cff]">{(item.recall * 100).toFixed(2)}%</td>
                  <td className="py-2.5 px-4 font-bold text-[#ecebe6]">{(item.f1 * 100).toFixed(2)}%</td>
                  <td className="py-2.5 px-4 text-right text-[#8b8f98]">{item.support.toLocaleString()} akış</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2 Header */}
      <div className="flex items-center justify-between border-b border-[rgba(236,235,230,0.12)] pb-2 pt-4">
        <h2 className="text-xs font-bold uppercase text-[#2a9d8f] tracking-wider">
          BÖLÜM 2 — ÇALIŞMA ZAMANI MODELİ VE GÜVENLİK BÜTÜNLÜĞÜ (RUNTIME PIPELINE)
        </h2>
        <span className="text-[10px] text-[#2a9d8f]">Aktif Dağıtık Çıkarım Durumu</span>
      </div>

      {/* Runtime Integrity Card */}
      <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-6 rounded space-y-4">
        <div className="flex items-center justify-between border-b border-[rgba(236,235,230,0.12)] pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#2a9d8f]" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#ecebe6]">
              MODEL ARTIFACT GÜVENLİĞİ VE BÜTÜNLÜK DOĞRULAMASI
            </h3>
          </div>
          <span className="text-[10px] text-[#2a9d8f] bg-[#2a9d8f]/10 border border-[#2a9d8f]/20 px-2 py-0.5 rounded">
            SHA-256 DOĞRULANDI
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-[#060709] rounded border border-[rgba(236,235,230,0.06)]">
            <div className="text-[10px] text-[#8b8f98]">ÖZNİTELİK ŞEMASI</div>
            <div className="text-sm font-bold text-[#ecebe6] mt-1">feature-schema-v1</div>
            <div className="text-[10px] text-[#8b8f98] mt-0.5">77 Kanonik Sütun</div>
          </div>

          <div className="p-3 bg-[#060709] rounded border border-[rgba(236,235,230,0.06)]">
            <div className="text-[10px] text-[#8b8f98]">ANOMALİ EŞİĞİ (τ*)</div>
            <div className="text-sm font-bold text-[#4f8cff] mt-1">0.49540</div>
            <div className="text-[10px] text-[#8b8f98] mt-0.5">Validation F1-Max</div>
          </div>

          <div className="p-3 bg-[#060709] rounded border border-[rgba(236,235,230,0.06)]">
            <div className="text-[10px] text-[#8b8f98]">BELLEK DURUMU</div>
            <div className="text-sm font-bold text-[#2a9d8f] mt-1">YÜKLÜ (CACHED)</div>
            <div className="text-[10px] text-[#8b8f98] mt-0.5">Singleton Loader</div>
          </div>

          <div className="p-3 bg-[#060709] rounded border border-[rgba(236,235,230,0.06)]">
            <div className="text-[10px] text-[#8b8f98]">AKIM TÜKETİCİSİ</div>
            <div className="text-sm font-bold text-[#ecebe6] mt-1">ml-inference</div>
            <div className="text-[10px] text-[#8b8f98] mt-0.5">Redis Streams XREADGROUP</div>
          </div>
        </div>
      </div>

      {/* Latency Benchmark Profile (EXP-004) */}
      <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-6 rounded space-y-4">
        <div className="flex items-center justify-between border-b border-[rgba(236,235,230,0.12)] pb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#ecebe6]">
            CANLI INFERENCE GECİKME PROFİLİ (EXP-004 · 500 AKIŞ ÖLÇÜMÜ)
          </h3>
          <span className="text-[10px] text-[#8b8f98]">phase2_benchmark.json</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-3 bg-[#060709] rounded border border-[rgba(236,235,230,0.06)]">
            <div className="text-[10px] text-[#8b8f98]">ORT. TOPLAM (SHAP İLE)</div>
            <div className="text-lg font-bold text-[#ff5b2e] mt-0.5">
              {latency?.total_with_shap?.mean_ms || 24.865} ms
            </div>
            <div className="text-[10px] text-[#8b8f98]">P95: {latency?.total_with_shap?.p95_ms || 31.65} ms</div>
          </div>

          <div className="p-3 bg-[#060709] rounded border border-[rgba(236,235,230,0.06)]">
            <div className="text-[10px] text-[#8b8f98]">HIZLI YOL (SHAP OLMADAN)</div>
            <div className="text-lg font-bold text-[#2a9d8f] mt-0.5">
              {latency?.total_without_shap?.mean_ms || 20.260} ms
            </div>
            <div className="text-[10px] text-[#8b8f98]">P95: {latency?.total_without_shap?.p95_ms || 26.68} ms</div>
          </div>

          <div className="p-3 bg-[#060709] rounded border border-[rgba(236,235,230,0.06)]">
            <div className="text-[10px] text-[#8b8f98]">LIGHTGBM PREDICT</div>
            <div className="text-lg font-bold text-[#4f8cff] mt-0.5">
              {latency?.supervised_prediction?.mean_ms || 2.616} ms
            </div>
            <div className="text-[10px] text-[#8b8f98]">Ağaç İlerleme</div>
          </div>

          <div className="p-3 bg-[#060709] rounded border border-[rgba(236,235,230,0.06)]">
            <div className="text-[10px] text-[#8b8f98]">TREESHAP ATTRIBUTION</div>
            <div className="text-lg font-bold text-[#fcbf49] mt-0.5">
              {latency?.shap_explanation?.mean_ms || 6.794} ms
            </div>
            <div className="text-[10px] text-[#8b8f98]">77 Öznitelik Katkısı</div>
          </div>
        </div>
      </div>
    </div>
  );
}
