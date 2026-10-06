import React from 'react';

interface StatusIndicatorProps {
  label: string;
  isOnline: boolean;
  value?: string;
}

export function StatusIndicator({ label, isOnline, value }: StatusIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#101216] border border-[rgba(236,235,230,0.12)] rounded text-[11px] font-mono">
      <span className="text-[#8b8f98] uppercase">{label}</span>
      <span
        className={`w-2 h-2 rounded-full ${
          isOnline ? 'bg-[#2a9d8f]' : 'bg-[#e63946]'
        }`}
      />
      {value && <span className="text-[#ecebe6]">{value}</span>}
    </div>
  );
}
