# NetSentry AI -- Final Demo Acceptance Report

## Executive Result
```text
FINAL DEMO ACCEPTANCE: PASS
```

- **Timestamp**: 2026-10-08T14:42:26Z
- **Git Commit**: `0dfac97a3963e7c6769d04f199bc6651a1cf3097`
- **Demonstration Mode**: Replay
- **Overall Status**: **PASS**

---

## Service Verification Matrix

| Subsystem | Component | Status | Verification Detail |
| :--- | :--- | :---: | :--- |
| **Infrastructure** | PostgreSQL (Port 5433) | **PASS** | Container healthy, migrations applied |
| **Infrastructure** | Redis (Port 6380) | **PASS** | Container healthy, Streams consumer ready |
| **Core API** | NestJS (Port 3001) | **PASS** | `/api/v1/health/detailed` HTTP 200 OK |
| **ML Engine** | FastAPI / Inference | **PASS** | 5 SHA-256 artifacts verified, 9 attack classes |
| **ML Worker** | Redis Stream Worker | **PASS** | Autonomous ml-inference consumer loop |
| **Frontend** | SOC Dashboard (Port 3000) | **PASS** | Next.js 16.3.6 responding HTTP 200 OK |

---

## Pipeline Ingestion & Verification

| Stage | Verification Assertion | Result |
| :--- | :--- | :---: |
| **Environment** | Docker, Python, Dataset, Models | **PASS** |
| **Authentication** | ADMIN role login (`admin@netsentry.ai`) | **PASS** |
| **Demo Reset** | Purged transient telemetry, preserved audit trail | **PASS** |
| **Ground-Truth Isolation** | `ground_truth_label` excluded from inference stream | **PASS** |
| **ML Inference** | Dual-Engine (LightGBM + Isolation Forest + TreeSHAP) | **PASS** |
| **Data Persistence** | PostgreSQL Flow & Detection records created | **PASS** |
| **Real-time Event** | WebSocket `/events` broadcast verified | **PASS** |
| **Dashboard Reachability** | http://localhost:3000 accessible | **PASS** |

---

### Important Academic Boundary
> **Academic Safety & Defense Policy**:
> This demonstration validates the complete NetSentry inference and SOC pipeline using controlled CIC-IDS2017 replay. It is not presented as a real-world attack simulation or packet injection tool.
>
> Live network capture is separately supported through the passive Npcap sensor and should be demonstrated on the local machine when physical-NIC observation is required. NetSentry does not claim zero-day infallibility and operates as an explainable NIDS platform rather than a full enterprise SIEM replacement.
