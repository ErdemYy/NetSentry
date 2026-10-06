# NetSentry AI — API Specification

## 1. Core API (NestJS · Port 3001)

### 1.1 Health & Diagnostics
- `GET /health`
  - Returns: `{ status: 'ok', service: 'NetSentry Core API', timestamp: string, uptimeSeconds: number, version: string }`

### 1.2 Authentication & RBAC
- `POST /auth/login`: Issues HTTP-only JWT cookie.
- `POST /auth/logout`: Clears cookie.
- `GET /auth/me`: Returns active session profile and role (`ADMIN`, `ANALYST`, `VIEWER`).

### 1.3 Incidents & Detections
- `GET /incidents`: Query filtered incident list (status, severity, date range).
- `GET /incidents/:id`: Detailed incident record with flow characteristics, SHAP attributions, timeline, and analyst notes.
- `PATCH /incidents/:id/status`: Transition status (`INVESTIGATING`, `CONFIRMED_THREAT`, `FALSE_POSITIVE`, `RESOLVED`). Requires `ANALYST` or `ADMIN`.
- `POST /incidents/:id/notes`: Add analyst audit note.

### 1.4 Real-Time WebSocket Gateway (`/events`)
- **Connection:** `ws://localhost:3001/events`
- **Client Emits:**
  - `subscribe_threat_feed`: Joins room for live threat alerts.
- **Server Broadcasts:**
  - `threat_alert`: Emits `ThreatFeedEvent` upon new anomaly/attack detection.
  - `metrics_snapshot`: Periodic aggregate telemetry (events/sec, active threats, anomaly rate).

---

## 2. ML Inference Service (FastAPI · Port 8000)

### 2.1 Diagnostics
- `GET /health`
  - Returns: Python runtime details, platform info, and loaded model weights status.

### 2.2 Inference
- `POST /api/v1/predict`
  - Body: `NetworkFlowSchema`
  - Response: `DetectionResponseSchema` (Verdict, confidence, anomaly score, SHAP top features, dynamic explanation).
