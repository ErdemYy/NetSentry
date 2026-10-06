import React from 'react';

export type SeverityType = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NORMAL' | string;

interface SeverityBadgeProps {
  severity: SeverityType;
  size?: 'sm' | 'md';
}

export function SeverityBadge({ severity, size = 'md' }: SeverityBadgeProps) {
  const norm = (severity || 'LOW').toUpperCase();

  const config: Record<string, { label: string; text: string; bg: string; border: string; dot: string }> = {
    CRITICAL: {
      label: 'CRITICAL',
      text: 'text-[#e63946]',
      bg: 'bg-[#e63946]/10',
      border: 'border-[#e63946]/30',
      dot: 'bg-[#e63946]',
    },
    HIGH: {
      label: 'HIGH',
      text: 'text-[#f77f00]',
      bg: 'bg-[#f77f00]/10',
      border: 'border-[#f77f00]/30',
      dot: 'bg-[#f77f00]',
    },
    MEDIUM: {
      label: 'MEDIUM',
      text: 'text-[#fcbf49]',
      bg: 'bg-[#fcbf49]/10',
      border: 'border-[#fcbf49]/30',
      dot: 'bg-[#fcbf49]',
    },
    LOW: {
      label: 'LOW',
      text: 'text-[#4f8cff]',
      bg: 'bg-[#4f8cff]/10',
      border: 'border-[#4f8cff]/30',
      dot: 'bg-[#4f8cff]',
    },
    NORMAL: {
      label: 'NORMAL',
      text: 'text-[#2a9d8f]',
      bg: 'bg-[#2a9d8f]/10',
      border: 'border-[#2a9d8f]/30',
      dot: 'bg-[#2a9d8f]',
    },
  };

  const current = config[norm] || config.LOW;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono font-medium rounded border ${current.bg} ${current.border} ${current.text} ${padding}`}
      title={`Severity: ${current.label}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />
      <span>{current.label}</span>
    </span>
  );
}
