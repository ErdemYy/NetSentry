# NetSentry AI — Academic Jury Demonstration Script (DEMO.md)

## 1. Demonstration Philosophy: Controlled Dataset Replay
To comply with academic safety standards and university network policies, NetSentry AI **never** conducts real malicious attacks against external networks or targets. Instead, a deterministic, controlled replay engine reads authentic flow vectors from the validated CIC-IDS2017 dataset (`clean_flows.parquet`) and streams them into the ingestion pipeline (`netsentry:flows`).

Ground-truth labels are strictly stripped before inference to ensure that the ML models evaluate traffic in zero-leakage conditions.

---

## 2. Service Startup Procedure

### Step 1: Start Infrastructure (PostgreSQL & Redis)
Ensure Docker Desktop is running, then execute:
```bash
docker compose up -d postgres redis
```
Verify connectivity:
- PostgreSQL: Port 5433 (Database: `netsentry_db`)
- Redis: Port 6380 (Stream transport)

### Step 2: Start NestJS Core API
In a terminal window:
```bash
cd apps/api
npm run start
```
*Health Check:* `curl http://localhost:3001/health`

### Step 3: Start ML Streaming Worker
In a second terminal window:
```bash
cd apps/ml
.venv/Scripts/python -m app.streaming.worker
```
The worker initializes all 5 artifacts (LightGBM, Isolation Forest, TreeSHAP, RobustScaler, LabelEncoder) and begins listening to `netsentry:flows` via consumer group `ml-inference`.

---

## 3. Demonstration Walkthrough Steps

### Phase 1: Baseline Benign Traffic Replay
Replay 20 authentic BENIGN traffic flows at a steady rate of 10 flows/sec:
```bash
cd apps/ml
.venv/Scripts/python -m app.streaming.replay --mode NORMAL --rate 10 --max 20
```
**Expected Observation:**
- ML Worker classifies all flows as `BENIGN` with `Verdict: NORMAL` and `Severity: LOW`.
- Anomaly scores remain below calibrated threshold $\tau = 0.49540$.
- Detections are persisted to PostgreSQL and broadcast over WebSocket without creating incidents.

### Phase 2: Targeted Threat Replay (DDoS & PortScan)
Stream specific authentic threat signatures:
```bash
# Replay 10 DDoS attack flows
cd apps/ml
.venv/Scripts/python -m app.streaming.replay --mode ATTACK --attack DDoS --rate 5 --max 10

# Replay 10 PortScan reconnaissance flows
.venv/Scripts/python -m app.streaming.replay --mode ATTACK --attack PortScan --rate 5 --max 10
```
**Expected Observation:**
- LightGBM detects attack class with $\ge 99\%$ confidence.
- Isolation Forest confirms anomalous divergence ($\text{score} \ge 0.50$).
- Detections are marked `HIGH_RISK` and `CRITICAL` severity.
- NestJS automatically escalates to a persistent `Incident` record in PostgreSQL.

### Phase 3: Stress Benchmark & Mixed Workload
Simulate mixed production traffic at 50 flows/sec:
```bash
cd apps/ml
.venv/Scripts/python -m app.streaming.replay --mode MIXED --rate 50 --max 100
```

### Phase 4: Scientific Explainability (SHAP) Defense
Explain to the thesis jury:
- For every detection, the system computes the exact mathematical Shapley contributions.
- Negative contributions indicate features reducing suspicion; positive contributions pinpoint the exact structural anomalies driving the alert (e.g. `psh_flag_count`, `min_seg_size_fwd`, `bwd_packet_length_mean`).
- Demonstrates to the jury that NetSentry AI eliminates the "black-box" dilemma in modern AI-driven cybersecurity.

### Phase 5: Automated Verification Suite
Run the automated end-to-end verification script:
```bash
cd apps/ml
.venv/Scripts/python scripts/verify_e2e_live.py
```
And execute the NestJS persistence & idempotency test:
```bash
cd apps/api
npx ts-node test/test-e2e-pipeline.ts
```
