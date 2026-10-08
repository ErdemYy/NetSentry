# NetSentry AI — Authoritative Jury Demo Guide & Acceptance Manual

> **Document Purpose**: Single authoritative operational protocol and presentation guide for academic jury defense, teacher reviews, and technical evaluation.
> **Primary Command**: `.\tools\final-demo.ps1 -Mode Replay`
> **System Architecture**: Feature-Frozen (Phase 1–7 complete). Zero mock data. Zero packet injection.

---

## 1. Before the Jury (T-15 Minutes Preparation)

Ensure the evaluation environment meets the baseline operational prerequisites:

1. **Docker Infrastructure Active**:
   - Docker Desktop running with WSL2 backend.
   - Start baseline storage containers if not already up:
     ```powershell
     docker compose up -d postgres redis
     ```
2. **Environment Configuration**:
   - `.env` configured with required variables (`POSTGRES_PASSWORD`, `JWT_SECRET`, `INTERNAL_SERVICE_TOKEN`).
3. **Machine Learning Artifacts**:
   - `apps/ml/models/` populated with validated artifacts (`supervised_lightgbm.joblib`, `isolation_forest.joblib`, `scaler.joblib`, `label_encoder.joblib`, `shap_explainer.joblib`, `metadata.json`).
4. **Processed Dataset**:
   - `apps/ml/data/processed/clean_flows.parquet` present (42.97 MB, 341,713 authentic flows).
5. **Passive Live Sensor (Optional)**:
   - Npcap 1.70+ installed on Windows if demonstrating physical network interface monitoring. If Npcap is absent, the system gracefully falls back to deterministic Replay mode.

---

## 2. Start Command (Single Entrypoint)

Execute the unified PowerShell demo harness from the repository root:

```powershell
.\tools\final-demo.ps1 -Mode Replay
```

To automatically launch the browser upon completion:

```powershell
.\tools\final-demo.ps1 -Mode Replay -OpenBrowser
```

The script runs an 8-stage verification suite:

```text
============================================================
 NETSENTRY AI -- FINAL JURY DEMO AND ACCEPTANCE HARNESS
============================================================

[1/8] Environment validation     -> Checks Docker, Python, Node, dataset, model SHA-256 hashes
[2/8] Docker infrastructure      -> Verifies PostgreSQL (5433) and Redis (6380) containers
[3/8] Service health gate        -> Validates Core API (:3001), ML API (:8000), and SOC Web (:3000)
[4/8] Authentication             -> Authenticates as ADMIN (admin@netsentry.ai) via JWT
[5/8] Demo state reset           -> Calls protected POST /api/v1/demo/reset (purges telemetry, preserves audit)
[6/8] Controlled replay          -> Streams 5 authentic CIC-IDS2017 classes with zero ground-truth leakage
[7/8] End-to-end verification    -> Validates Redis consumption, ML inference, Postgres storage & WebSocket
[8/8] Jury handoff               -> Emits reports/final-demo/latest.json & latest.md and displays URLs
```

---

## 3. What the Jury Sees (Step-by-Step Defense Script)

Open Google Chrome or Microsoft Edge to: **`http://localhost:3000`**

### A. System Health Indicators (Top Bar)
- **Point out the dynamic status pills**:
  - `API ●` (NestJS Core API on port 3001)
  - `ML ENGINE ●` (FastAPI Dual-Engine Inference)
  - `REDIS ●` (Stream transport & caching)
  - `DATABASE ●` (PostgreSQL relational storage)
  - `LIVE ●` (Socket.IO WebSocket connection on `/events`)
- **Defense Explanation**: All pills are live probes dynamically polled from `/api/v1/health/detailed` and Socket.IO heartbeat events. There are zero hardcoded status values.

### B. Architectural Flow
- **Explain the end-to-end ingestion chain**:
  ```text
  CIC-IDS2017 Replay / Live Sensor
                 ↓
      Redis Stream netsentry:flows
                 ↓
             ML Worker
                 ↓
  LightGBM (Supervised) + Isolation Forest (Unsupervised) + TreeSHAP
                 ↓
    Redis Stream netsentry:detections
                 ↓
            NestJS Core API
                 ↓
       PostgreSQL + WebSocket
                 ↓
        Next.js SOC Dashboard
  ```

### C. Real-Time Detection
- Navigate to **Threats** (`/threats`) or view the **Real-Time Network Activity** table on **Overview** (`/`).
- Show the jury the freshly processed flow detections (e.g. `DDOS`, `PORT_SCAN`, `DOS`, `BRUTE_FORCE`, `BENIGN`).
- Highlight that every record contains real latency measurements ($\sim 25\text{--}35\text{ ms}$), supervised classification confidence, and anomaly scores.

### D. Scientific Explainability (TreeSHAP)
- Click on an elevated attack detection (e.g., `DDOS` or `PORT_SCAN`).
- Navigate to the **Threat Detail** page (`/threats/[id]`).
- Focus on the section: **"MODEL BU AKIŞI NEDEN İŞARETLEDİ?"** (Why did the model flag this flow?).
- **Show the signed Shapley contribution bars**:
  - Positive contributions (red/amber) indicate structural features pushing the classifier toward attack verdict (e.g., `min_seg_size_fwd`, `fwd_packet_length_max`, `psh_flag_count`).
  - Negative contributions indicate normal baseline behaviors mitigating suspicion.
- **Academic Defense**: Emphasize to the jury that NetSentry AI eliminates the "black-box" dilemma in modern AI cybersecurity by producing deterministic mathematical feature attributions.

### E. Incident Management
- Navigate to **Incidents** (`/incidents`).
- Show how critical threats automatically escalate to persistent incident records.
- Demonstrate real-time status transitions: `NEW` $\to$ `INVESTIGATING` $\to$ `RESOLVED`.
- Point out that invalid state transitions are blocked by backend finite state validation.

### F. Analytics & Telemetry
- Navigate to **Analytics** (`/analytics`).
- Review detection category distribution, severity breakdown, and average inference latency.

### G. ML Models & Rigorous Verification
- Navigate to **Models** (`/models`).
- Explain the academic distinction between:
  1. **EXP-001 Training Benchmark**: LightGBM 99.85% Accuracy, 93.74% Macro F1, 92.45% Macro Recall across all 9 classes.
  2. **Runtime Memory State**: SHA-256 cryptographic hashes verified at boot time against `metadata.json`.

### H. Live Network Sensor (Phase 6)
- Navigate to **Network** (`/network`).
- Review the **Canlı Ağ Sensörü** panel:
  - Active network adapter, driver status, observed packets, and completed flows.
  - Explain: *"Sensörümüz yalnızca pasif gözlem yapmakta, ham paket yüklerini (payload) kaydetmemekte ve 77 öznitelikli kanonik akış vektörleri üretmektedir."*

---

## 4. 60-Second Fallback Procedure

If physical network adapter access, Npcap driver, or external connectivity experiences issues in the examination room:

```text
============================================================
 60-SECOND DEMO FALLBACK (100% RELIABLE)
============================================================

1. Open PowerShell in repository root.
2. Run:
   .\tools\final-demo.ps1 -Mode Replay

3. Open browser: http://localhost:3000
4. Show health indicators (API, ML, Redis, DB).
5. Open a threat from /threats.
6. Present TreeSHAP explainability bars.
7. Show incident workflow in /incidents.
============================================================
```

> **Academic Guarantee**: The fallback mode uses authentic CIC-IDS2017 flow vectors, zero mock data, and executes the exact same production inference pipeline.

---

## 5. Important Academic Boundaries

When presenting to the thesis committee:

1. **Controlled Replay vs Real Attacks**: Replay streams authentic flow vectors extracted from CIC-IDS2017. NetSentry does not generate live malicious exploits or flood external targets.
2. **Passive Observation**: Physical NIC capture is passive sniffing only. The system does not inject packets or perform unauthorized scanning.
3. **SIEM Scope**: NetSentry is an AI-powered Network Intrusion Detection System (NIDS) with incident management capabilities; it does not claim to replace an enterprise-wide SIEM log aggregator.
4. **Zero-Day Realism**: The unsupervised Isolation Forest engine detects statistical divergence from normal traffic baselines; this provides anomaly flagging rather than guaranteed zero-day classification.
