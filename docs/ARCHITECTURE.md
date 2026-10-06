# NetSentry AI — System Architecture

## 1. Executive Overview
NetSentry AI is a next-generation distributed Network Intrusion Detection System (NIDS) and Security Operations Center (SOC) intelligence platform designed for graduation thesis research. It addresses the limitation of traditional signature-based detection systems (such as Snort or Suricata) by combining **multi-class supervised machine learning** for known threat classification with **unsupervised anomaly detection** for novel/zero-day pattern discovery, backed by **eXplainable Artificial Intelligence (SHAP)**.

## 2. Distributed Component Pipeline & Security Architecture
```text
Dataset / Flow Replay Source (clean_flows.parquet)
                     │
                     ▼
       Redis Stream: netsentry:flows
                     │
       (Consumer Group: ml-inference)
                     ▼
                 ML Worker
   ┌─────────────────┼──────────────────┐
   ↓                 ↓                  ↓
LightGBM       Isolation Forest      TreeSHAP
(Supervised)    (τ* = 0.49540)     (Attributions)
   └─────────────────┬──────────────────┘
                     │ DetectionResult
                     ▼
       Redis Stream: netsentry:detections
                     │
       (Consumer Group: netsentry-api-group)
                     ▼
            NestJS Core API Orchestrator  ◄─── [Enrichment Layer: Threat Intel (AbuseIPDB)]
   ┌─────────────────┼──────────────────┐        (SSRF Protected, 24h Redis Cache, Non-blocking)
   ↓                 ↓                  ↓
PostgreSQL        AuditLog        Incident State Machine
(Persistence)   (Security Trail)  (Triage Validation)
   └─────────────────┬──────────────────┘
                     │ WSS (/events namespace, JWT Auth Guard)
                     ▼
         SOC Operations Dashboard (Next.js 16)
                     │
                     ▼
        SOC Analyst / Security Lead
```

## 3. Subsystem Breakdown

### 3.1 Data Ingestion & Stream Layer
- **Canonical Transport:** Redis Streams (`XREADGROUP`, `XACK`, `XADD`) provide durable, at-least-once message processing.
- **Stream Keys:**
  - `netsentry:flows`: Input stream receiving raw flow feature payloads.
  - `netsentry:detections`: Output stream containing validated `DetectionResult` objects with flow metadata.
  - `netsentry:flows:dlq`: Dead-letter queue for malformed flows exceeding retry limits (default: 3).
  - `netsentry:detections:dlq`: Dead-letter queue for unparseable detection events.
  - `netsentry:detections:pubsub`: Ephemeral channel for immediate real-time notifications.
- **Contract Parity:** Network flows conform to the strict schema defined in `@netsentry/shared` and validated via Pydantic in `apps/ml`.

### 3.2 Machine Learning Inference Service (`apps/ml`)
- **Dual-Entry Architecture:**
  - **Synchronous:** `POST /api/v1/predict` (FastAPI REST endpoint for direct ad-hoc flow evaluation).
  - **Asynchronous:** `MLStreamWorker` consuming `netsentry:flows` using consumer group `ml-inference`.
  - Both pathways share the exact same `InferenceService` singleton to guarantee zero drift.
- **Feature Order Guard:** Incoming feature dictionaries are strictly verified against the 77 canonical feature names and indices established during Phase 1 training. Missing, extra, NaN, infinite, or non-numeric features are rejected immediately with `400 Bad Request`.
- **Supervised Detection:** Evaluates flow vectors against pre-trained weights for recognized attack classes (DDoS, DoS, PortScan, BruteForce, Botnet, Infiltration, Heartbleed, WebAttack).
- **Unsupervised Anomaly Scoring:** Measures divergence from the clean traffic baseline using Isolation Forest ($s(x) = -\text{score\_samples}(x)$). Calibrated decision boundary: $\tau^* = 0.49540$.
- **Deterministic Hybrid Verdict Synthesis:**
  - BENIGN with $s(x) < \tau \rightarrow \textbf{NORMAL}$
  - BENIGN with $s(x) \ge \tau \rightarrow \textbf{UNKNOWN\_ANOMALOUS}$
  - Attack Class with Confidence $\ge 0.80$ and $s(x) \ge \tau \rightarrow \textbf{HIGH\_RISK}$
  - Attack Class with Confidence $\ge 0.80$ and $s(x) < \tau \rightarrow \textbf{KNOWN\_ATTACK}$
  - Attack Class with Confidence $< 0.80 \rightarrow \textbf{ANOMALOUS}$
- **Explainability (TreeSHAP):** Calculates exact marginal feature contributions (e.g. `destination_port`, `bwd_packet_length_mean`), categorizing directions into `increases_risk` and `decreases_risk`.

### 3.3 Core Backend & Persistence (`apps/api`)
- **Framework:** NestJS 11 with modular design.
- **Database:** PostgreSQL 16 managed via Prisma ORM.
- **Idempotency Strategy:** All incoming detection messages are keyed by `flowId` and `detectionId`. Existing records are skipped gracefully (`findUnique` / `upsert`), preventing duplicate DB records upon Redis message re-deliveries.
- **Incident Escalation:** Detections flagged with `HIGH` or `CRITICAL` severity, or `HIGH_RISK` verdict, automatically instantiate/update a corresponding `Incident` record in PostgreSQL.
- **WebSocket Gateway (`/events`):** Emits `threat_alert` to rooms subscribed to `threat_feed` and broadcasts `detection.created` globally.

### 3.4 Controlled Replay Engine (`apps/ml/app/streaming/replay.py`)
- **Academic Distinction:** NetSentry AI does NOT generate unconstrained synthetic attack traffic or flood external networks.
- **Dataset Replay:** Streams authentic, sanitized flow vectors from `apps/ml/data/processed/clean_flows.parquet`.
- **Modes:**
  - `NORMAL`: Strictly BENIGN traffic samples.
  - `ATTACK`: Threat traffic samples across canonical attack categories.
  - `MIXED`: Interleaved benign and attack traffic for realistic SOC stress testing.
- **Configurability:** Controllable replay rates (10–500 flows/sec), batch sizes, and optional fast-path (bypassing SHAP for high-speed stress benchmarks).

## 4. Frontend SOC Operations Dashboard (Phase 3 Implementation)

### 4.1 Architecture & Strict Zero-Mock Policy
The frontend (`apps/web`) is built with Next.js 16 (App Router, Turbopack), React 19, and Tailwind CSS v4, adhering strictly to the **Zero-Mock Policy** (ADR-005, ADR-015):
- No synthetic data, random generators (`Math.random()`), fake charts, or simulated alerts exist anywhere in production components.
- All metrics, charts, tables, and detail screens are dynamically hydrated from NestJS REST API endpoints:
  - `GET /api/v1/dashboard/overview` (Real-time KPIs, active threats, recent alerts)
  - `GET /api/v1/threats` & `GET /api/v1/threats/:id` (Filterable log & full flow telemetry with SHAP attributions)
  - `GET /api/v1/incidents` & `GET /api/v1/incidents/:id` (Automated incident escalation & status triage)
  - `GET /api/v1/network/stats` (Protocol, port, and byte volume aggregations)
  - `GET /api/v1/analytics/stats` (Attack taxonomy, severity breakdowns, confidence distribution)
  - `GET /api/v1/models/metrics` (Academic benchmarks: LightGBM, Isolation Forest, TreeSHAP, inference latencies)
  - `GET /api/v1/health/detailed` (Subsystem health probes: Core API, ML Engine, Redis, Database)
- When no detections exist, components display explicit `NO DATA` or `WAITING FOR EVENTS` empty states rather than fake fillers.

### 4.2 Erdem Design System Governance
The UI adapts the Erdem Design System (`.agents/skills/erdem`, ADR-002, ADR-016) for security operations:
- **Palette Tokens:** `--color-ink: #060709`, `--color-graphite: #101216`, `--color-signal: #ff5b2e`, `--color-tech: #4f8cff`.
- **Typography:** `Space Grotesk` for editorial headers and navigation; `JetBrains Mono` for all technical telemetry (IP addresses, ports, protocol names, model IDs, confidences, anomaly scores, SHAP values, timestamps, and latencies).
- **Aesthetic Stance:** Technical, minimal, information-dense, and restrained. Prohibits neon cyberpunk glows, spinning radars, matrix backgrounds, and decorative 3D objects.
- **Accessible Severity:** Dual-indicator semantic badges combining visual pills with uppercase labels (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO`).

### 4.3 Route Structure & Pages
1. **Overview (`/`):** Top bar with live subsystem health; real-time KPI strip (Active Threats, Incidents, Events/sec, Flows Analyzed); live network activity feed; hybrid architecture quick summary card.
2. **Threats (`/threats`):** Editorial tabular feed of all evaluated flows with status pills, IP routes, timestamps, and quick triage filters.
3. **Threat Detail (`/threats/[id]`):** Deep telemetry inspection containing:
   - Attack classification and severity badge.
   - Dual-model breakdown: LightGBM Supervised Confidence vs Isolation Forest Anomaly Score ($s(x)$ vs $\tau^* = 0.49540$).
   - Network flow metadata (IPs, ports, protocol, packet counts, flags, durations, rates).
   - "WHY DID THE MODEL FLAG THIS?": Exact TreeSHAP feature attributions with signed contribution bars (`+X.XXXX` / `-X.XXXX`) and direction badges (`INCREASED RISK` / `DECREASED RISK`).
4. **Incidents (`/incidents`):** Escalated security incidents table with severity indicators, status tags (`NEW`, `ASSIGNED`, `RESOLVED`), and associated threat categories.
5. **Incident Detail (`/incidents/[id]`):** Triage view with event timeline, source/target metadata, and interactive status transition controls (`INVESTIGATE`, `RESOLVE`).
6. **Network Intelligence (`/network`):** Aggregated flow volume, transport protocol distribution, destination port breakdown, and network utilization metrics.
7. **Analytics (`/analytics`):** Real-time aggregation cards, attack taxonomy distribution, verdict ratios, and confidence distribution buckets.
8. **Models (`/models`):** Academic evaluation dashboard displaying LightGBM 9-class metrics (Accuracy 99.85%, Macro F1 93.74%), Isolation Forest baseline metrics (ROC-AUC 73.35%, F1 52.36%), comparative matrix, and 6-stage latency benchmarks.
9. **Settings (`/settings`):** Platform configuration parameters, active model artifact versions, streaming consumer group states, and real-time health diagnostic probes.

### 4.4 Real-Time State Model & Motion Restraint
- **WebSocket Transport:** Client hook `useRealtime` establishes a resilient Socket.IO connection to `/events` on port 3001 with automatic reconnection and exponential backoff.
- **Event Listeners:** Listens for `threat_alert` and `detection.created` events, appending them to a 50-item bounded memory buffer with ID deduplication.
- **Motion Restraint:** Newly appended events use subtle, localized CSS transitions (`fade-in`, `translateY(4px -> 0)`). Full-screen flashing and pulse animations are strictly avoided. Full support for `prefers-reduced-motion` is baked in.

