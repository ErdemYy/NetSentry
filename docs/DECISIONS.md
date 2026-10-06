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
- **Decision:** No hard-coded metrics, fake attack detections, or synthetic confusion matrices. Phase 0 contains foundation skeletons, while Phase 1 trains real baseline models on CIC-IDS2017.
- **Consequences:** Honest, defensible, and high-impact engineering portfolio.
