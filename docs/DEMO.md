# NetSentry AI — Academic Jury Demonstration Script (DEMO.md)

## 1. Demonstration Philosophy: Controlled Simulation
To comply with academic safety standards and university network policies, NetSentry AI **never** conducts real malicious attacks against external networks. Instead, a deterministic replay and synthetic simulation engine feeds verified flow signatures directly into the ingestion stream.

## 2. Walkthrough Steps for Thesis Committee

### Phase 1: Baseline Normal Operation
1. The presenter boots the system via `docker-compose up` or local services.
2. In the Next.js SOC Dashboard, observe steady background traffic:
   - Threat Level: `NORMAL`
   - Supervised verdict: `BENIGN`
   - Anomaly scores stay below threshold $\tau$.

### Phase 2: Synthetic Reconnaissance (Port Scan Simulation)
1. Trigger the controlled simulation script:
   ```bash
   python scripts/simulate_traffic.py --scenario port_scan --rate 50
   ```
2. Real-time event propagation:
   - Flow features captured -> Redis stream -> FastAPI -> NestJS -> WebSocket.
3. SOC Dashboard alert:
   - Amber alert: `PORT_SCAN` detected from simulated IP.
   - Live feed displays incoming packets, duration, and target ports.

### Phase 3: High-Volume DoS / SYN Flood Surge
1. Trigger volumetric attack simulation:
   ```bash
   python scripts/simulate_traffic.py --scenario ddos_syn --volume 500
   ```
2. Instant Red Alert on SOC screen:
   - Threat Level transitions to `CRITICAL`.
   - Dynamic incident generated with `Severity: CRITICAL`.

### Phase 4: Scientific Defense via Explainable AI (SHAP)
1. Click into the newly created incident in the SOC UI.
2. View the Explainable AI panel:
   - Model demonstrates exact feature contribution waterfall:
     `syn_flag_count` (+0.48), `flow_packets_per_sec` (+0.35).
   - Shows the jury: *"The system did not make a black-box guess; it isolated the high SYN flag volume as the principal decision factor."*

### Phase 5: Incident Response & Mitigation
1. Analyst clicks **"Investigate"**, adds an audit note, and activates **"Block IP"**.
2. Action logged in `AuditLog` table and IP stored in `BlacklistEntry`.
