# Architectural Decision Records (ADR) — NetSentry AI

## ADR-001: Monorepo Architecture with npm Workspaces
- **Status:** Accepted
- **Context:** The system requires shared TypeScript contracts between the frontend (Next.js) and backend (NestJS), along with a Python FastAPI ML service and Docker Compose orchestrator.
- **Decision:** Use an npm workspaces monorepo with `apps/*` (`web`, `api`, `ml`) and `packages/*` (`shared`).
- **Consequences:** Provides type safety across client-server boundaries, simplifies development lifecycle, and cleanly isolates Python ML logic in its dedicated environment.

---

## ADR-002: Erdem Design System Integration Strategy
- **Status:** Accepted
- **Context:** The project requires professional, high-density, dark-themed SOC UI adhering to the user's Erdem Design System without copying design system files into NetSentry.
- **Decision:** Utilize the official Antigravity adapter installed at `.agents/skills/erdem`, reference canonical design tokens (`--color-ink: #060709`, `--color-graphite: #101216`, `--color-signal: #ff5b2e`, `--color-tech: #4f8cff`, `Space Grotesk`, `JetBrains Mono`), and map token semantics directly in Tailwind CSS.
- **Consequences:** Consistent, accessible design language without bloating the repository with third-party code.

---

## ADR-003: Hybrid ML Threat Detection (Supervised + Isolation Forest)
- **Status:** Accepted
- **Context:** A common critique of ML-based intrusion detection in academic defenses is that supervised models cannot identify zero-day attacks, while unsupervised models have high false positive rates.
- **Decision:** Deploy a dual-model hybrid pipeline:
  1. Supervised LightGBM/XGBoost for known attack taxonomy classification.
  2. Unsupervised Isolation Forest trained on pure benign baseline for anomaly outlier scoring.
  3. Synthesized verdict engine with SHAP explainability.
- **Consequences:** Scientifically sound defense against both known and novel threats, with verifiable reasoning.

---

## ADR-004: Asynchronous Redis Stream Ingestion
- **Status:** Accepted
- **Context:** High-throughput network packet bursts cannot be processed synchronously via HTTP request-response without packet loss.
- **Decision:** Decouple flow capture and ML prediction using Redis Pub/Sub / streams as an in-memory queue.
- **Consequences:** High-throughput resilience, non-blocking ingestion, and fault isolation.

---

## ADR-005: Strict Zero-Mock Policy for Academic Thesis Presentation
- **Status:** Accepted
- **Context:** Bitirme projelerinde sahte metrik veya mock verilere başvurulması akademik güvenilirliği zedeler.
- **Decision:** No hard-coded metrics, fake attack detections, or synthetic confusion matrices. All performance metrics must stem from real dataset splits and experiment runs.
- **Consequences:** Honest, defensible, and high-impact engineering portfolio.

---

## ADR-006: Label Normalization Taxonomy (15 Raw to 9 Semantic Classes)
- **Status:** Accepted
- **Context:** Raw CIC-IDS2017 files contain fragmented sub-labels (e.g., `DoS Hulk`, `DoS GoldenEye`, `Web Attack – XSS`, `FTP-Patator`).
- **Decision:** Consolidate related attack vectors into recognized semantic security families: `DoS`, `BruteForce`, `WebAttack`, while preserving distinct threats (`DDoS`, `PortScan`, `Botnet`, `Infiltration`, `Heartbleed`, and `BENIGN`).
- **Consequences:** Balanced model convergence without losing attack vector specificity.

---

## ADR-007: Stratified Sampling with 100% Minority Vector Retention
- **Status:** Accepted
- **Context:** Full CIC-IDS2017 contains 2,830,743 rows. In-memory loading and tree training over 2.8M rows requires excessive RAM and causes compute bottlenecks.
- **Decision:** Cap voluminous benign and DDoS/DoS classes while retaining **100% of minority attack vectors** (Heartbleed, Infiltration, Web Attacks, Botnet). Construct a verified representative dataset of 341,713 flows.
- **Consequences:** Retains full representation of rare and dangerous attacks while ensuring rapid, reproducible experimentation on workstation hardware.

---

## ADR-008: Methodological Threshold Selection on Validation Set
- **Status:** Accepted
- **Context:** Unsupervised anomaly detectors output continuous scores. Setting an arbitrary threshold (e.g. 0.5) is scientifically indefensible.
- **Decision:** Sweep candidate thresholds across 40 percentiles of validation benign scores, selecting $\tau^* = 0.49540$ based on F1-maximization and FPR constraints on the Validation set. Never tune $\tau$ on the Test set.
- **Consequences:** Objective, defensible anomaly cutoff that prevents test data snooping.

---

## ADR-009: Redis Streams as Canonical Event Bus Transport (Phase 2)
- **Status:** Accepted
- **Context:** Real-time distributed inference requires durable message delivery, consumer group scaling, and acknowledgment capabilities. Redis Pub/Sub lacks message persistence and delivery guarantees if a consumer restarts.
- **Decision:** Use Redis Streams (`XREADGROUP`, `XACK`, `XADD`) with consumer groups (`ml-inference` for ML Worker, `netsentry-api-group` for NestJS). Reserve Redis Pub/Sub strictly for lightweight ephemeral WebSocket client alerts.
- **Consequences:** Guarantees zero dropped packets, provides automatic recovery of pending messages, and isolates dead-letter queues (`netsentry:flows:dlq`, `netsentry:detections:dlq`).

---

## ADR-010: Unified InferenceService Singleton for Sync and Async Pathways
- **Status:** Accepted
- **Context:** Predictions can originate via HTTP `POST /api/v1/predict` or Redis Stream `netsentry:flows`. If implemented separately, logic drift could lead to discrepancies between REST and streaming verdicts.
- **Decision:** Encapsulate all validation, scaling, prediction, anomaly scoring, and SHAP calculation within a single, stateful `InferenceService` singleton instantiated once at worker/app startup.
- **Consequences:** 100% identical inference behavior regardless of ingestion entry point; models remain cached in memory and are never reloaded per flow.

---

## ADR-011: Strict 77-Feature Ordering and Input Validation Guard
- **Status:** Accepted
- **Context:** Decision trees and scalers depend on exact column indexing. In Python/JSON, dictionary key iteration orders can vary across platforms, and missing/NaN values can cause silent corruption or misleading classifications.
- **Decision:** Enforce rigorous pre-inference validation: verify exact set equality with the 77 canonical feature names, assert numeric datatypes, check for `NaN` and `+/-Infinity`, and reassemble vectors in strict canonical order (`apps/ml/models/metadata.json`).
- **Consequences:** Prevents feature ordering transposition bugs. Out-of-spec requests are immediately rejected with HTTP `400 Bad Request`.

---

## ADR-012: TreeSHAP Performance Profiling and Execution Strategy
- **Status:** Accepted
- **Context:** Computing SHAP values per flow introduces algorithmic overhead. In high-velocity streaming (>100 flows/sec), computing full Shapley values on every flow can saturate CPU cores.
- **Decision:** Based on rigorous 500-sample empirical profiling (EXP-004), TreeSHAP adds an average of **6.794 ms** latency per flow. For low-rate operations and individual REST calls, SHAP runs synchronously. For high-speed streaming stress tiers, a `compute_shap` boolean toggle enables fast-path execution (20.26 ms mean latency), while SHAP is generated selectively for elevated threats (`HIGH` / `CRITICAL`) and analyst investigations.
- **Consequences:** High-throughput streaming resilience while maintaining explainability when analysts need it most.

---

## ADR-013: Idempotent Persistence in NestJS Core API
- **Status:** Accepted
- **Context:** In distributed event processing, network retries or consumer restarts can cause at-least-once message delivery, leading to duplicate records in the database.
- **Decision:** Implement deterministic idempotency keys (`flowId`, `detectionId`) in NestJS persistence service using Prisma `upsert` and `findUnique` pre-checks.
- **Consequences:** Redundant delivery of previously processed detections is safely skipped with zero duplicate database rows.

---

## ADR-014: Deterministic Threat Severity Rule Engine
- **Status:** Accepted
- **Context:** Severity levels (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`) must not be hardcoded, guessed, or randomly assigned.
- **Decision:** Implement a rule-based deterministic matrix evaluating:
  1. Attack category severity ceiling (e.g. Heartbleed, DDoS, Infiltration -> CRITICAL/HIGH).
  2. Model confidence thresholds (>= 0.85 -> full category severity; lower confidence scales down).
  3. Unsupervised anomaly confirmation (s(x) >= tau elevates medium threats to high).
- **Consequences:** Transparent, auditable, and reproducible alert classification documented in `docs/THREAT-MODEL.md`.

---

## ADR-015: Strict Zero-Mock SOC Dashboard Architecture and Real Telemetry Guarantee
- **Status:** Accepted
- **Context:** Standard dashboard templates frequently simulate activity with `Math.random()`, fake threat feeds, or client-side synthetic metric counters. In an academic capstone defense, mock data renders the demonstration scientifically untrustworthy.
- **Decision:** Strictly prohibit any synthetic data, random generators, or client-side mock feeds in `apps/web`. Every metric, flow record, SHAP score, and incident timeline displayed in the UI must originate directly from NestJS REST API endpoints (`/api/v1/dashboard/*`, `/api/v1/threats/*`, `/api/v1/incidents/*`, `/api/v1/analytics/*`, `/api/v1/models/*`), PostgreSQL query aggregations, or live WebSocket `/events` frames. When no data exists, the UI renders explicit `NO DATA` or `WAITING FOR EVENTS` empty states.
- **Consequences:** 100% genuine system telemetry. The interface directly exposes the real underlying ML inference engine and network flows.

---

## ADR-016: Erdem Design System Security Adaptation and Semantic Severity Tokens
- **Status:** Accepted
- **Context:** SOC dashboards often suffer from overwhelming visual noise: neon green/red cyberpunk themes, terminal hacker gimmicks, glowing animations, and card overload. Conversely, Erdem Design System emphasizes minimal, editorial, cinematic, high-density, and restrained typography.
- **Decision:** Adapt the Erdem Design System for Security Operations without altering the core design system:
  1. Maintain base palette: `--color-ink: #060709`, `--color-graphite: #101216`, `--color-signal: #ff5b2e`, `--color-tech: #4f8cff`.
  2. Implement semantic, accessible severity badges combining both dual-indicator visuals (subtle edge pills) and uppercase text: `CRITICAL` (crimson), `HIGH` (amber/orange), `MEDIUM` (signal blue), `LOW` (slate), `INFO` (zinc).
  3. Avoid full card colored backgrounds, pulse glows, spinning radars, or matrix particle backgrounds.
  4. Preserve Space Grotesk for editorial headers and JetBrains Mono for all telemetry data (IPs, ports, scores, latencies, timestamps).
- **Consequences:** A calm, authoritative, information-dense Security Intelligence Operating Interface with high readability and zero decorative gimmicks.

---

## ADR-017: TreeSHAP Feature Attribution UX and Risk Direction Visualization
- **Status:** Accepted
- **Context:** Security analysts must know *why* an AI model flagged a network flow as malicious. Hardcoded explanations or arbitrary feature lists do not provide defensible explanations.
- **Decision:** Expose genuine TreeSHAP Shapley values computed by the Python ML Worker (`apps/ml`) directly in the Threat Detail view (`/threats/[id]`):
  1. Section header: "WHY DID THE MODEL FLAG THIS?".
  2. Render exact feature names, input flow values, and signed contribution bars (`+X.XXXX` vs `-X.XXXX`).
  3. Explicitly categorize directionality into `INCREASED RISK` (positive Shapley value pushing towards attack prediction) and `DECREASED RISK` (negative value mitigating risk).
  4. Monospace numerical typography with hover tooltips displaying feature descriptions and impact magnitude.
- **Consequences:** Transparent, auditable, and interpretable machine learning that directly answers analyst questions and passes academic defense criteria.

---

## ADR-018: Hybrid Threat vs Anomaly Cognitive Separation in Operations Interface
- **Status:** Accepted
- **Context:** Intrusion detection systems often conflate known attacks with unknown anomalies, confusing operators about the detection mechanism.
- **Decision:** Explicitly separate model outputs on all cards, tables, and detail screens into two distinct analytical pillars:
  1. **Supervised Verdict (LightGBM):** Attack classification category (e.g. `PORT_SCAN`, `DDOS`, `BENIGN`) and confidence percentage (e.g. `99.94%`).
  2. **Unsupervised Anomaly (Isolation Forest):** Normalized outlier score $s(x)$ evaluated against the methodologically derived threshold $\tau^* = 0.49540$, with explicit status (`NORMAL` vs `ANOMALOUS`).
- **Consequences:** Analysts instantly recognize whether a flow is a signature-like known threat, a statistical anomaly, or a dangerous hybrid combination.

---

## ADR-019: Realtime WebSocket State Management and Selective Motion Restraint
- **Status:** Accepted
- **Context:** High-velocity streaming events can trigger massive React rerenders, causing layout thrashing, performance degradation, and distracting UI flickering.
- **Decision:**
  1. Centralize WebSocket state in `useRealtime` hook with clear connection states: `LIVE`, `RECONNECTING`, `DISCONNECTED` with exponential backoff.
  2. Maintain a capped FIFO buffer (50 most recent alerts) and deduplicate by `id`.
  3. Micro-animations are strictly restrained to newly inserted rows (`fade-in`, `translateY(4px -> 0)`), with zero whole-screen flashing, zero glow pulses, and full `prefers-reduced-motion` compliance.
- **Consequences:** Silky smooth 60fps rendering under active packet streams, zero layout shifts, and full WCAG accessibility.

---

## ADR-020: Bidirectional Flow Reconstruction & Initiator-Relative Direction Semantics (Phase 6)
- **Status:** Accepted
- **Context:** Raw network interfaces deliver individual unidirectional packets. Supervised models trained on CIC-IDS2017 expect bidirectional flow vectors featuring forward and backward statistics (e.g. `total_fwd_packets`, `total_bwd_packets`, `fwd_packet_length_mean`, `bwd_packet_length_mean`).
- **Decision:**
  1. Implement a canonical hashable conversation key `((min_endpoint, max_endpoint), protocol)` ensuring packets from $A \to B$ and $B \to A$ resolve to the exact same in-memory flow accumulator (`BidirectionalFlow`).
  2. The first observed packet in the conversation deterministically defines the conversation **Initiator (FORWARD direction)**. Subsequent packets originating from the reciprocal endpoint are classified as **Responder (BACKWARD direction)**.
  3. Connection teardown uses full TCP state tracking: connections terminate immediately upon reciprocal FIN exchange (`fin_count >= 2`) or unilateral RST (`rst_count >= 1`). Inactive UDP/TCP conversations expire via a configurable inactivity sweep (`FLOW_TIMEOUT_MS = 30000`).
  4. Partial, unterminated flows are never sent to the ML inference pipeline.
- **Consequences:** Preserves 100% mathematical and semantic consistency with CICFlowMeter and the frozen Phase 1 `feature-schema-v1` contract without retraining existing models.

---

## ADR-021: Windows Npcap Driver Abstraction and Dual Ingestion Pipelines (Phase 6)
- **Status:** Accepted
- **Context:** Capturing live promiscuous Ethernet/IP traffic on Windows requires the Npcap kernel driver. In development or restricted lab environments where Npcap or Administrator privileges are unavailable, the system must not crash or fail silently.
- **Decision:**
  1. Detect Npcap presence at runtime via `scapy.conf.use_pcap`.
  2. If missing, transition sensor operational state cleanly to `SENSOR_UNAVAILABLE` with informative operator remediation instructions rather than raising unhandled exceptions.
  3. Provide offline PCAP ingestion (`process_pcap_file`) using standard `scapy.PcapReader`, enabling full 77-feature extraction and streaming without kernel drivers or root privileges.
  4. Establish a dual-mode ingestion architecture: Benchmark/Replay Mode (`source: "replay"`) for academic evaluation against ground truth, and Live Sensor Mode (`source: "live"`) for operational traffic monitoring. Ground-truth metrics (Accuracy, F1) are never fabricated for live traffic.
- **Consequences:** Safe, resilient deployment on Windows workstations with verifiable parity against historical model contracts.


