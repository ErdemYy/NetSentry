import { Shield, Activity, Cpu, Server, Database, Radio, Terminal } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#060709] text-[#ecebe6] p-6 lg:p-10">
      {/* Header Bar */}
      <header className="border-b border-[rgba(236,235,230,0.12)] pb-6 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Shield className="w-7 h-7 text-[#ff5b2e]" />
            <h1 className="text-2xl font-bold tracking-tight uppercase">NetSentry AI</h1>
            <span className="bg-[#101216] border border-[rgba(236,235,230,0.12)] text-[#8b8f98] text-xs px-2.5 py-0.5 rounded font-mono">
              PHASE 0 · FOUNDATION
            </span>
          </div>
          <p className="text-sm text-[#8b8f98] mt-1 font-mono">
            Yapay Zeka Destekli Dağıtık Ağ Trafiği Anomali Tespiti ve Gerçek Zamanlı Tehdit İstihbarat Platformu
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 bg-[#101216] border border-[rgba(236,235,230,0.12)] px-3 py-1.5 rounded">
            <span className="w-2 h-2 rounded-full bg-[#2a9d8f]" />
            <span>SYSTEM: INITIALIZED</span>
          </div>
          <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] px-3 py-1.5 rounded text-[#8b8f98]">
            ERDEM DESIGN SYSTEM · DARK
          </div>
        </div>
      </header>

      {/* Subsystem Grid */}
      <section className="mb-10">
        <h2 className="text-xs uppercase tracking-wider text-[#8b8f98] font-mono mb-4">
          Core Subsystems Architecture
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1 */}
          <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-5 rounded">
            <div className="flex items-center justify-between mb-3">
              <Server className="w-5 h-5 text-[#4f8cff]" />
              <span className="text-[10px] font-mono text-[#8b8f98] uppercase">apps/api</span>
            </div>
            <h3 className="font-semibold text-sm mb-1">Core API & Gateway</h3>
            <p className="text-xs text-[#8b8f98] leading-relaxed mb-4">
              NestJS, Prisma ORM, PostgreSQL persistence, and WebSocket real-time alerting gateway.
            </p>
            <div className="text-[11px] font-mono text-[#8b8f98] border-t border-[rgba(236,235,230,0.12)] pt-3 flex justify-between">
              <span>Port: 3001</span>
              <span className="text-[#2a9d8f]">READY</span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-5 rounded">
            <div className="flex items-center justify-between mb-3">
              <Cpu className="w-5 h-5 text-[#ff5b2e]" />
              <span className="text-[10px] font-mono text-[#8b8f98] uppercase">apps/ml</span>
            </div>
            <h3 className="font-semibold text-sm mb-1">ML Inference Engine</h3>
            <p className="text-xs text-[#8b8f98] leading-relaxed mb-4">
              FastAPI service hosting LightGBM/XGBoost, Isolation Forest anomaly scoring, and SHAP XAI.
            </p>
            <div className="text-[11px] font-mono text-[#8b8f98] border-t border-[rgba(236,235,230,0.12)] pt-3 flex justify-between">
              <span>Port: 8000</span>
              <span className="text-[#8b8f98]">PHASE 1 WEIGHTS</span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-5 rounded">
            <div className="flex items-center justify-between mb-3">
              <Radio className="w-5 h-5 text-[#f77f00]" />
              <span className="text-[10px] font-mono text-[#8b8f98] uppercase">broker</span>
            </div>
            <h3 className="font-semibold text-sm mb-1">Stream & Message Layer</h3>
            <p className="text-xs text-[#8b8f98] leading-relaxed mb-4">
              Redis Pub/Sub & BullMQ event decoupling network packet ingestion from ML prediction.
            </p>
            <div className="text-[11px] font-mono text-[#8b8f98] border-t border-[rgba(236,235,230,0.12)] pt-3 flex justify-between">
              <span>Port: 6379</span>
              <span className="text-[#8b8f98]">DOCKER CONFIG</span>
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-5 rounded">
            <div className="flex items-center justify-between mb-3">
              <Database className="w-5 h-5 text-[#2a9d8f]" />
              <span className="text-[10px] font-mono text-[#8b8f98] uppercase">storage</span>
            </div>
            <h3 className="font-semibold text-sm mb-1">Relational Database</h3>
            <p className="text-xs text-[#8b8f98] leading-relaxed mb-4">
              PostgreSQL 16 housing flows, detections, incidents, threat indicators, and model audits.
            </p>
            <div className="text-[11px] font-mono text-[#8b8f98] border-t border-[rgba(236,235,230,0.12)] pt-3 flex justify-between">
              <span>Port: 5432</span>
              <span className="text-[#8b8f98]">PRISMA SCHEMA</span>
            </div>
          </div>
        </div>
      </section>

      {/* Target Pipeline Flow */}
      <section className="bg-[#101216] border border-[rgba(236,235,230,0.12)] p-6 rounded mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-[#ff5b2e]" />
          <h2 className="text-xs uppercase tracking-wider text-[#ecebe6] font-mono">
            Target Verification Pipeline (Zero-Mock Principle)
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs font-mono">
          <div className="bg-[#1a1d23] p-3 rounded border border-[rgba(236,235,230,0.06)]">
            <span className="text-[#8b8f98] block text-[10px]">STEP 01</span>
            <strong className="text-[#ecebe6] block mt-1">Network Replay</strong>
            <span className="text-[#8b8f98] text-[11px] mt-1 block">PCAP / CIC-IDS2017 Flow Extractor</span>
          </div>
          <div className="bg-[#1a1d23] p-3 rounded border border-[rgba(236,235,230,0.06)]">
            <span className="text-[#8b8f98] block text-[10px]">STEP 02</span>
            <strong className="text-[#ecebe6] block mt-1">Redis Ingestion</strong>
            <span className="text-[#8b8f98] text-[11px] mt-1 block">Asynchronous Decoupled Event Stream</span>
          </div>
          <div className="bg-[#1a1d23] p-3 rounded border border-[rgba(236,235,230,0.06)]">
            <span className="text-[#8b8f98] block text-[10px]">STEP 03</span>
            <strong className="text-[#ecebe6] block mt-1">Hybrid ML + XAI</strong>
            <span className="text-[#8b8f98] text-[11px] mt-1 block">Supervised + Isolation Forest + SHAP</span>
          </div>
          <div className="bg-[#1a1d23] p-3 rounded border border-[rgba(236,235,230,0.06)]">
            <span className="text-[#8b8f98] block text-[10px]">STEP 04</span>
            <strong className="text-[#ecebe6] block mt-1">Core Orchestrator</strong>
            <span className="text-[#8b8f98] text-[11px] mt-1 block">NestJS, Prisma, PostgreSQL & Audit Log</span>
          </div>
          <div className="bg-[#1a1d23] p-3 rounded border border-[rgba(236,235,230,0.06)]">
            <span className="text-[#8b8f98] block text-[10px]">STEP 05</span>
            <strong className="text-[#ecebe6] block mt-1">Live SOC Dashboard</strong>
            <span className="text-[#8b8f98] text-[11px] mt-1 block">WebSocket Feed, Threat Feed, Analytics</span>
          </div>
        </div>
      </section>

      {/* Terminal / Academic Notes Footer */}
      <footer className="border-t border-[rgba(236,235,230,0.12)] pt-6 flex flex-col md:flex-row items-start md:items-center justify-between text-xs font-mono text-[#8b8f98] gap-4">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-[#8b8f98]" />
          <span>Academic Thesis Deliverable · Antigravity & Erdem Design System</span>
        </div>
        <div>
          <span>Documentation: docs/ARCHITECTURE.md | docs/ML-METHODOLOGY.md</span>
        </div>
      </footer>
    </main>
  );
}
