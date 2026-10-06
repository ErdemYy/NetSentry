# NetSentry AI — API Specification

## 1. ML Inference Service (FastAPI · Port 8000)

### 1.1 Health & Model Readiness
- **Endpoint:** `GET /health`
- **Response Format:**
```json
{
  "status": "ok",
  "service": "NetSentry ML Inference Engine",
  "timestamp": "2026-10-06T17:53:59Z",
  "python_version": "3.12.10",
  "platform": "Windows-11-10.0.26100-SP0",
  "phase": "PHASE_2_REALTIME_INFERENCE",
  "models_ready": true,
  "models_loaded": {
    "supervised": true,
    "unsupervised": true,
    "explainer": true,
    "scaler": true,
    "classes_count": 9,
    "anomaly_threshold": 0.4954
  },
  "redis_connected": true,
  "redis_host": "localhost:6380"
}
```
*Note: If Redis is unreachable or model weights are missing, `status` returns `"degraded"` and `redis_connected` returns `false` (no mock responses).*

---

### 1.2 Synchronous Flow Inference
- **Endpoint:** `POST /api/v1/predict`
- **Summary:** Real-time multi-class classification, Isolation Forest anomaly scoring, and TreeSHAP explainability.
- **Request Body (`PredictRequest`):**
```json
{
  "flow_id": "flow-a1b2c3d4",
  "features": {
    "destination_port": 80.0,
    "flow_duration": 1450000.0,
    "total_fwd_packets": 12.0,
    "total_bwd_packets": 8.0,
    "total_fwd_bytes": 4500.0,
    ...
    "idle_min": 0.0
  },
  "compute_shap": true,
  "timestamp": "2026-10-06T18:00:00Z"
}
```

#### Strict Validation Rules (HTTP 400 Bad Request):
1. **Missing Features:** Request must contain all 77 features trained in Phase 1 (`apps/ml/models/metadata.json`). Missing any feature returns `400 Bad Request`.
2. **Unknown Features:** Extraneous keys not in the canonical 77 feature set return `400 Bad Request`.
3. **Invalid Datatypes:** Non-numeric values (e.g. strings, booleans, arrays) return `400 Bad Request`.
4. **NaN Values:** Feature vectors with `NaN` return `400 Bad Request`.
5. **Infinite Values:** Feature vectors with `+Infinity` or `-Infinity` return `400 Bad Request`.

- **Success Response (HTTP 200 OK — `DetectionResult` Contract):**
```json
{
  "id": "det-e2e-1791310119698",
  "flowId": "flow-a1b2c3d4",
  "timestamp": "2026-10-06T18:00:00Z",
  "verdict": "HIGH_RISK",
  "attackCategory": "DDOS",
  "supervisedConfidence": 0.9998,
  "unsupervisedAnomalyScore": 0.5032,
  "anomalyThreshold": 0.4954,
  "isAnomalous": true,
  "severity": "CRITICAL",
  "topFeatures": [
    {
      "feature": "min_seg_size_fwd",
      "value": 32.0,
      "contribution": 3.0437,
      "description": "min_seg_size_fwd (32.00) increases risk for DDOS",
      "direction": "increases_risk"
    },
    {
      "feature": "bwd_packet_length_mean",
      "value": 1225.0,
      "contribution": 2.845,
      "description": "bwd_packet_length_mean (1225.00) increases risk for DDOS",
      "direction": "increases_risk"
    }
  ],
  "explanation": "Primary decision factor: 'min_seg_size_fwd' (+3.04 contribution).",
  "modelVersionSupervised": "LightGBM-1.0.0",
  "modelVersionUnsupervised": "IsolationForest-1.0.0",
  "inferenceLatencyMs": 24.865,
  "classProbabilities": {
    "BENIGN": 0.0001,
    "BOTNET": 0.0,
    "BRUTE_FORCE": 0.0,
    "DDOS": 0.9998,
    "DOS": 0.0001,
    "HEARTBLEED": 0.0,
    "INFILTRATION": 0.0,
    "PORT_SCAN": 0.0,
    "WEB_ATTACK": 0.0
  },
  "telemetry": {
    "validation_ms": 0.21,
    "preprocessing_ms": 2.163,
    "supervised_ms": 2.616,
    "anomaly_ms": 12.879,
    "shap_ms": 6.794,
    "total_ms": 24.865
  }
}
```

---

## 2. Core API Orchestrator (NestJS · Port 3001)

### 2.1 Health & Connectivity
- **Endpoint:** `GET /health`
- **Response Format:**
```json
{
  "status": "ok",
  "service": "NetSentry Core API",
  "phase": "PHASE_2_REALTIME_INFERENCE",
  "timestamp": "2026-10-06T18:00:00Z",
  "uptimeSeconds": 142,
  "database": {
    "connected": true,
    "provider": "PostgreSQL"
  },
  "redis": {
    "connected": true,
    "port": 6380
  }
}
```

### 2.2 Real-Time WebSocket Gateway (`/events`)
- **Connection URL:** `ws://localhost:3001/events`
- **Rooms & Subscriptions:**
  - Client emits `subscribe_threat_feed` -> Joins room `threat_feed`.
- **Broadcast Events:**
  - `threat_alert`: Emitted to room `threat_feed` upon detection of anomalous or malicious traffic (`ThreatFeedEvent`).
  - `detection.created`: Emitted globally to all connected clients upon each processed detection (`DetectionResult`).
  - `metrics_snapshot`: Periodic aggregate telemetry (events/sec, active threats, anomaly rate).

---

## 3. Redis Streams Transport Specification

| Key | Type | Description |
|---|---|---|
| `netsentry:flows` | Stream | Input queue for network flows published by Replay Engine or packet tap. |
| `netsentry:detections` | Stream | Output queue consumed by NestJS Core API with full `DetectionResult` and `NetworkFlow`. |
| `netsentry:flows:dlq` | Stream | Dead-letter queue for flows failing validation after 3 retries. |
| `netsentry:detections:dlq` | Stream | Dead-letter queue for unparseable detection records. |
| `netsentry:detections:pubsub` | Pub/Sub | Ephemeral pub/sub broadcast for immediate WebSocket forwarding. |
