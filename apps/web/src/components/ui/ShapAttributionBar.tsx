import React from 'react';

export interface ShapItem {
  feature: string;
  value: number;
  contribution: number;
  description?: string;
  direction?: 'increases_risk' | 'decreases_risk' | string;
}

interface ShapAttributionBarProps {
  features: ShapItem[];
  maxBars?: number;
}

export function ShapAttributionBar({ features, maxBars = 6 }: ShapAttributionBarProps) {
  if (!features || features.length === 0) {
    return (
      <div className="text-xs font-mono text-[#8b8f98] p-4 bg-[#060709] border border-[rgba(236,235,230,0.12)] rounded">
        SHAP öznitelik analizi bu tespit için hesaplanmadı.
      </div>
    );
  }

  const items = features.slice(0, maxBars);
  const maxAbsContrib = Math.max(...items.map((f) => Math.abs(f.contribution)), 0.001);

  return (
    <div className="space-y-3 font-mono">
      <div className="grid grid-cols-12 text-[10px] uppercase text-[#8b8f98] border-b border-[rgba(236,235,230,0.12)] pb-2 mb-2">
        <span className="col-span-5 md:col-span-4">ÖZNİTELİK / DEĞER</span>
        <span className="col-span-4 md:col-span-5">ETKİ DAĞILIMI (SHAPLEY DEĞERİ)</span>
        <span className="col-span-3 text-right">KATKI</span>
      </div>

      {items.map((item, idx) => {
        const isRiskIncrease = item.contribution >= 0;
        const widthPct = Math.min(100, Math.max(5, (Math.abs(item.contribution) / maxAbsContrib) * 100));

        return (
          <div
            key={idx}
            className="grid grid-cols-12 items-center text-xs py-1.5 border-b border-[rgba(236,235,230,0.06)] hover:bg-[#1a1d23]/50 transition-colors px-1 rounded"
          >
            {/* Feature & Raw Value */}
            <div className="col-span-5 md:col-span-4 pr-2 truncate">
              <span className="text-[#ecebe6] font-medium block truncate" title={item.feature}>
                {item.feature}
              </span>
              <span className="text-[10px] text-[#8b8f98]">
                val: {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
              </span>
            </div>

            {/* Visual Contribution Bar */}
            <div className="col-span-4 md:col-span-5 pr-2">
              <div className="w-full bg-[#101216] h-2.5 rounded-sm overflow-hidden flex items-center">
                <div
                  style={{ width: `${widthPct}%` }}
                  className={`h-full rounded-sm ${
                    isRiskIncrease ? 'bg-[#ff5b2e]' : 'bg-[#4f8cff]'
                  }`}
                  title={`${isRiskIncrease ? 'Tehdit Riskini Artırdı' : 'Riski Düşürdü'}: ${item.contribution}`}
                />
              </div>
              <span className="text-[9px] uppercase tracking-wider block mt-0.5 text-[#8b8f98]">
                {isRiskIncrease ? 'Risk Artışı (+)' : 'Normal Eğilim (-)'}
              </span>
            </div>

            {/* Exact Contribution Number */}
            <div
              className={`col-span-3 text-right font-bold text-xs ${
                isRiskIncrease ? 'text-[#ff5b2e]' : 'text-[#4f8cff]'
              }`}
            >
              {item.contribution > 0 ? `+${item.contribution.toFixed(4)}` : item.contribution.toFixed(4)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
