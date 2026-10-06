import React from 'react';
import { Database, AlertCircle } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  title = 'VERİ BULUNAMADI',
  description = 'Sistemde henüz kayıtlı olay veya akış verisi bulunmuyor.',
  action,
}: EmptyStateProps) {
  return (
    <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-12 rounded flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 rounded-full bg-[#1a1d23] border border-[rgba(236,235,230,0.12)] flex items-center justify-center text-[#8b8f98] mb-4">
        <Database className="w-5 h-5" />
      </div>
      <h3 className="text-sm font-semibold font-mono uppercase tracking-wider text-[#ecebe6] mb-1">
        {title}
      </h3>
      <p className="text-xs font-mono text-[#8b8f98] max-w-md mb-4 leading-relaxed">
        {description}
      </p>
      {action}
    </div>
  );
}

export function ErrorState({
  title = 'VERİ YÜKLENEMEDİ',
  description = 'Backend servisleriyle bağlantı kurulamadı.',
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="bg-[#101216] border border-[#e63946]/30 p-10 rounded flex flex-col items-center justify-center text-center">
      <div className="w-10 h-10 rounded-full bg-[#e63946]/10 text-[#e63946] flex items-center justify-center mb-3">
        <AlertCircle className="w-5 h-5" />
      </div>
      <h3 className="text-sm font-semibold font-mono uppercase text-[#e63946] mb-1">
        {title}
      </h3>
      <p className="text-xs font-mono text-[#8b8f98] max-w-sm mb-4">
        {description}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-3 py-1.5 bg-[#1a1d23] hover:bg-[#262930] text-[#ecebe6] border border-[rgba(236,235,230,0.12)] rounded text-xs font-mono transition-colors"
        >
          Yeniden Dene
        </button>
      )}
    </div>
  );
}

export function LoadingSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-12 bg-[#101216] border border-[rgba(236,235,230,0.08)] rounded animate-pulse"
        />
      ))}
    </div>
  );
}
