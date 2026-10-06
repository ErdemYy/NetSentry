# NetSentry AI — Threat Model & Security Architecture

## 1. Scope & System Boundaries
The threat model assesses potential vulnerabilities within the NetSentry AI distributed architecture, including data ingestion pipelines, ML inference services, backend APIs, and the SOC frontend interface.

## 2. Adversary Model & Capabilities
1. **External Network Attacker:**
   - Capabilities: Sends malicious TCP/UDP/ICMP traffic bursts, scans target subnet ports, conducts volumetric DDoS, or initiates credential brute forcing.
   - Goals: Disruption of service availability, reconnaissance, lateral movement.
2. **Adversarial ML Attacker (Evasion):**
   - Capabilities: Crafts adversarial perturbations in packet length or inter-arrival timing to intentionally minimize anomaly scores or mimic benign traffic distributions.
   - Goals: Evading NIDS detection without altering exploit payload efficacy.
3. **Malicious Insider / Compromised Client:**
   - Capabilities: Manipulating analyst dashboards, spoofing alerts, or tampering with database records.

## 3. Threat Taxonomy (MITRE ATT&CK Mapping)
| ATT&CK ID | Tactic | Technique | NetSentry Detection Strategy |
|---|---|---|---|
| T1046 | Discovery | Network Service Scanning | PortScan detection via flow connection rates and SYN flag frequency |
| T1110 | Credential Access | Brute Force (SSH/FTP) | Repetitive short flow volume & bidirectional packet byte symmetry |
| T1498 | Impact | Network Denial of Service | Volumetric packet burst rate and abnormal backward packet deficits |
| T1071 | Command and Control | Application Layer Protocol | Outlier flow duration and periodic packet beaconing detected by Isolation Forest |

## 4. Defense-in-Depth Mechanisms
- **Input Validation:** Strict Pydantic schema validation at the ML layer and ClassValidator at the NestJS gateway.
- **Authentication:** JWT stored in HTTP-only, Secure, SameSite cookies to protect against XSS token harvesting.
- **Role-Based Access Control (RBAC):** `ADMIN`, `ANALYST`, and `VIEWER` roles enforced on sensitive incident resolution and blacklist routes.
- **Tamper-Evident Audit Logging:** All user actions (status transitions, IP blacklisting, note creation) write immutable records to the `AuditLog` entity.

---

## 5. Deterministic Threat Severity Rule Engine (Phase 2 Specification)

Severity levels (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`) are derived deterministically from model confidence, attack classification, and unsupervised anomaly divergence. No hardcoded or randomized values are permitted.

```text
Input:
- predicted_class (LightGBM)
- confidence ∈ [0.0, 1.0]
- is_anomalous (bool: anomaly_score ≥ τ* = 0.49540)
- anomaly_score ∈ [0.0, 1.0]

Evaluation Rules:

1. CRITICAL Severity:
   - High-impact target vector (HEARTBLEED, INFILTRATION, BOTNET) with confidence ≥ 0.60.
   - Volumetric DDoS with confidence ≥ 0.85 AND is_anomalous = True.
   - Severe anomaly divergence: anomaly_score ≥ 0.70 AND confidence ≥ 0.80.

2. HIGH Severity:
   - Known attack category (DOS, DDOS, PORT_SCAN, BRUTE_FORCE, WEB_ATTACK) with confidence ≥ 0.80.
   - High-impact target vector (HEARTBLEED, INFILTRATION, BOTNET) with confidence < 0.60.
   - Any attack vector with is_anomalous = True AND anomaly_score ≥ 0.60.

3. MEDIUM Severity:
   - Known attack category with moderate confidence (0.50 ≤ confidence < 0.80).
   - Benign traffic diverging from baseline (predicted_class = BENIGN, is_anomalous = True)
     indicating potential novel or zero-day anomaly (verdict = UNKNOWN_ANOMALOUS).

4. LOW Severity:
   - Baseline normal traffic (predicted_class = BENIGN, is_anomalous = False).
   - Weak attack predictions with confidence < 0.50 and normal anomaly score.
```

---

## 6. Comprehensive Security Risk Assessment & Mitigation Matrix (Phase 4)

| Surface / Domain | Threat Description | Impact | Likelihood | Mitigation Strategy | Residual Risk |
| :--- | :--- | :---: | :---: | :--- | :--- |
| **1. Attack Surface** | Port enumeration and unauthenticated endpoint probing on ports 3000, 3001, 8000. | High | High | Minimal exposure, Docker network isolation, rate limiting on all ingress routes. | Low (Private network binding in prod). |
| **2. Authentication** | Credential brute-forcing, credential stuffing, session hijacking. | High | Medium | Bcrypt hashing (cost 10), JWT in HTTP-only SameSite cookies, rate limiting on `/api/v1/auth/login`. | Low (Strong password policies enforced). |
| **3. Authorization** | Privilege escalation; Analyst accessing administrative audit logs or demo reset. | High | Medium | Server-side `RolesGuard` enforcing `@Roles('ADMIN')`, returning 403 Forbidden. | Negligible (Explicit claims verification). |
| **4. API Security** | Denial of Service via oversized JSON payloads, malformed parameter injection. | High | Medium | Payload body size capped at 1MB, Throttler rate limiting (300 req/min), structured JSON parsing. | Low (Distributed DDoS requires cloud WAF). |
| **5. Redis Transport** | Unauthorized stream tampering, queue injection, or credential interception. | Critical | Low | Container network isolation, Redis password authentication, DLQ quarantine for malformed packets. | Negligible (Accessible only to internal services). |
| **6. PostgreSQL** | SQL Injection, unauthorized data exfiltration or table tampering. | Critical | Low | Parameterized queries enforced via Prisma ORM, strict foreign keys, zero raw string SQL concatenation. | Negligible (No dynamic SQL construction). |
| **7. ML Artifacts** | Model tampering, pickle deserialization exploits, backdoored weights. | Critical | Low | Cryptographic SHA-256 integrity verification upon loader startup; failure aborts startup. | Negligible (Read-only container volumes). |
| **8. Threat Intel** | Server-Side Request Forgery (SSRF) targeting internal IPs (`127.0.0.1`, RFC 1918). | High | High | `SsrfValidator` blocks internal/private/link-local ranges before initiating any outbound HTTP call. | Negligible (Strict IP range filtering). |
| **9. WebSocket** | Unauthorized room subscription, connection flooding, cross-site hijacking. | Medium | Medium | Origin allowlist, bounded in-memory buffer (50 alerts), scoped `/events` namespace. | Low (WSS transport in production). |
| **10. Frontend** | Cross-Site Scripting (XSS), Clickjacking, UI tampering. | Medium | Low | React JSX contextual encoding, Helmet HTTP headers (`X-Frame-Options: DENY`, `nosniff`), no localStorage tokens. | Negligible. |
| **11. Secrets** | Hardcoded API keys, JWT secret exposure in version control. | Critical | Low | Dotenv configuration, `.gitignore` exclusion, sanitized error messages stripping secrets. | Negligible (Audit scans verified). |
| **12. Logging** | Log injection, sensitive data leakage (passwords, tokens) in audit files. | Medium | Low | Structured JSON logging, password fields sanitized and excluded from `AuditLog` details. | Negligible. |

