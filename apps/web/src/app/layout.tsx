import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NetSentry AI — SOC & Threat Intelligence Platform',
  description: 'AI-Driven Distributed Network Anomaly Detection and Real-Time Threat Intelligence',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#060709] text-[#ecebe6]">
        {children}
      </body>
    </html>
  );
}
