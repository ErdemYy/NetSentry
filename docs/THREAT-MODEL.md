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
