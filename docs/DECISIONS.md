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
