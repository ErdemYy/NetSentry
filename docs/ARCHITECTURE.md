# NetSentry AI — System Architecture

## 1. Executive Overview
NetSentry AI is a next-generation distributed Network Intrusion Detection System (NIDS) and Security Operations Center (SOC) intelligence platform designed for graduation thesis research. It addresses the limitation of traditional signature-based detection systems (such as Snort or Suricata) by combining **multi-class supervised machine learning** for known threat classification with **unsupervised anomaly detection** for novel/zero-day pattern discovery, backed by **eXplainable Artificial Intelligence (SHAP)**.

## 2. Distributed Component Pipeline (Phase 2 Real-Time Implementation)
```text
Controlled Replay Engine (clean_flows.parquet)
                     │
                     ▼
       Redis Stream: netsentry:flows
                     │
       (Consumer Group: ml-inference)
                     ▼
         ML Worker (Streaming / Batch)
   ┌─────────────────┴──────────────────┐
   │ 1. Schema & Feature Order Check   │
   │ 2. RobustScaler Transformation    │
   │ 3. LightGBM Classification        │
   │ 4. Isolation Forest Scoring (τ*)  │
   │ 5. Deterministic Severity & Hybrid│
   │ 6. SHAP TreeExplainer Attributions│
   └─────────────────┬──────────────────┘
                     │ DetectionResult
                     ▼
    Redis Stream: netsentry:detections
    Redis Pub/Sub: netsentry:detections:pubsub
                     │
      (Consumer Group: netsentry-api-group)
                     ▼
          NestJS Core API Orchestrator
   ┌─────────────────┴──────────────────┐
   │ 1. DetectionResult Validation     │
   │ 2. Idempotent PostgreSQL Upsert   │
   │    - Flow, Detection, Incident    │
   │ 3. WebSocket Gateway Broadcast    │
   └─────────────────┬──────────────────┘
                     │ WSS (/events namespace)
                     ▼
         SOC Operations Dashboard
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
