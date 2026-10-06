import React from 'react';

interface KpiCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  highlight?: boolean;
}

export function KpiCard({ label, value, subtext, highlight = false }: KpiCardProps) {
  return (
    <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-4 rounded flex flex-col justify-between">
      <div className="text-[11px] font-mono text-[#8b8f98] uppercase tracking-wider mb-2">
        {label}
      </div>
      <div
        className={`text-2xl font-bold font-mono tracking-tight ${
          highlight ? 'text-[#ff5b2e]' : 'text-[#ecebe6]'
        }`}
      >
        {value !== null && value !== undefined && value !== '' ? value : '—'}
      </div>
      {subtext && (
        <div className="text-[10px] font-mono text-[#8b8f98] mt-1">
          {subtext}
        </div>
      )}
    </div>
  );
}
