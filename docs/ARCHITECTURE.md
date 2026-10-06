# NetSentry AI — System Architecture

## 1. Executive Overview
NetSentry AI is a next-generation distributed Network Intrusion Detection System (NIDS) and Security Operations Center (SOC) intelligence platform designed for graduation thesis research. It addresses the limitation of traditional signature-based detection systems (such as Snort or Suricata) by combining **multi-class supervised machine learning** for known threat classification with **unsupervised anomaly detection** for novel/zero-day pattern discovery, backed by **eXplainable Artificial Intelligence (SHAP)**.

## 2. Distributed Component Pipeline
```
[Network Traffic / PCAP Replay]
               │ (Raw packets)
               ▼
[Flow Extraction Engine] (CIC-FlowMeter / Scapy)
               │ (Statistical Flow Features JSON)
               ▼
   [Redis Event Stream] (In-memory pub/sub broker)
               │
               ▼
[Python FastAPI Inference Service]
       ├── Supervised Engine (LightGBM / XGBoost)
       ├── Unsupervised Engine (Isolation Forest / Autoencoder)
       └── XAI Engine (SHAP Tree/Kernel Explainer)
               │ (Detection Result + Feature Attributions)
               ▼
   [NestJS Core API Orchestrator]
       ├── Persistence (Prisma ORM -> PostgreSQL 16)
       ├── RBAC & Audit Logger
       └── WebSocket Gateway (/events namespace)
               │ (Real-time WSS Events)
               ▼
[Next.js SOC Operations Dashboard]
       ├── Live Threat Feed
       ├── Threat Origin Geospatial Map
       ├── Incident Response Workflows
       └── Model Analytics & Confusion Matrix
```

## 3. Subsystem Breakdown

### 3.1 Data Ingestion & Stream Layer
- **Decoupled Architecture:** Packet sniffing/flow extraction operates asynchronously from prediction. High-throughput bursts are buffered via Redis streams to prevent dropped packets.
- **Contract Parity:** Network flows conform to the strict schema defined in `@netsentry/shared` and validated via Pydantic in `apps/ml`.

### 3.2 Machine Learning Inference Service (`apps/ml`)
- **Supervised Detection:** Evaluates flow vectors against pre-trained weights for recognized attack classes (DDoS, DoS, PortScan, BruteForce, Botnet, Infiltration).
- **Unsupervised Anomaly Scoring:** Measures divergence from the clean traffic baseline (Isolation Forest anomaly score $[0, 1]$).
- **Hybrid Decision Logic:**
  - $\text{Score} < \tau_{\text{normal}} \rightarrow \textbf{NORMAL}$
  - Known Class Confident $\rightarrow \textbf{KNOWN\_ATTACK}$
  - High Anomaly Score with Low Known Class Confidence $\rightarrow \textbf{UNKNOWN\_ANOMALOUS}$
  - High Anomaly Score + Known Attack Class $\rightarrow \textbf{HIGH\_RISK}$
- **Explainability (SHAP):** Calculates exact marginal feature contributions (e.g. `syn_flag_count`, `flow_packets_per_sec`), preventing black-box decisions.

### 3.3 Core Backend & Persistence (`apps/api`)
- **Framework:** NestJS 11 with modular design.
- **Database:** PostgreSQL 16 managed via Prisma ORM.
- **Entities:** Separated into 12 distinct relational domains (`User`, `Role`, `Flow`, `NetworkEvent`, `Detection`, `Incident`, `IncidentNote`, `ThreatIndicator`, `BlacklistEntry`, `ModelVersion`, `ModelEvaluation`, `AuditLog`).
- **Security:** HTTP-only cookie JWTs, role guards (`ADMIN`, `ANALYST`, `VIEWER`), and tamper-evident audit logging.

### 3.4 SOC Frontend (`apps/web`)
- **Framework:** Next.js 16 App Router, React 19, Tailwind CSS.
- **Design System:** Strictly integrated with Erdem Design System (`Space Grotesk`, `JetBrains Mono`, near-black `#060709`, graphite `#101216`, signal `#ff5b2e`, tech `#4f8cff`).
- **Interface Focus:** High information density, clear severity hierarchy, zero decorative distraction.
