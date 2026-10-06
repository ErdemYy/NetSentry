# NetSentry AI — Dataset Documentation (CIC-IDS2017)

## 1. Dataset Provenance & Official Source
- **Dataset Name:** CIC-IDS2017 (Canadian Institute for Cybersecurity Intrusion Detection System 2017)
- **Institution / Provider:** Canadian Institute for Cybersecurity, University of New Brunswick (UNB), Canada
- **Official URL:** https://www.unb.ca/cic/datasets/ids-2017.html
- **Research Citation:**
  > Iman Sharafaldin, Arash Habibi Lashkari, and Ali A. Ghorbani, “Toward Generating a New Intrusion Detection Dataset and Intrusion Traffic Characterization”, 4th International Conference on Information Systems Security and Privacy (ICISSP), Portugal, January 2018.
- **Verified Download Mirror:** https://huggingface.co/datasets/c01dsnap/CIC-IDS2017
- **Download Date:** 2026-10-06T17:21:35Z
- **License / Terms of Use:** Academic and non-commercial research use.

---

## 2. Ingested Canonical Source Files & Checksums

| File Name | File Size | SHA-256 Checksum | Ingested Raw Rows |
|---|---|---|---|
| `Friday-WorkingHours-Afternoon-DDos.pcap_ISCX.csv` | 73.55 MB | `6ff1580f5f81c0ae28a26f7631721018577f5f7c5e0feac28b795fcfe7b411ee` | 225,745 |
| `Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv` | 73.34 MB | `ca1824c51bfbb7b3c72290a11be04366ba8815878c6a1cc5c44cb1cee269e99b` | 286,467 |
| `Friday-WorkingHours-Morning.pcap_ISCX.csv` | 55.62 MB | `53a41c24d570ea83b7ac55b2e94df94e7a8216aeb80a2af0246b6bc8bb543000` | 191,033 |
| `Monday-WorkingHours.pcap_ISCX.csv` | 168.73 MB | `852c4beb34eda186f32561fa79df7a0747e92e1a6535b01270820dd9ffe17f34` | 529,918 |
| `Thursday-WorkingHours-Afternoon-Infilteration.pcap_ISCX.csv` | 79.25 MB | `6bcda3857c2504676034e3ea57762d38393cc734cb377a726bd5cb153961b1b5` | 288,602 |
| `Thursday-WorkingHours-Morning-WebAttacks.pcap_ISCX.csv` | 49.61 MB | `d67066211fb1689c78406f1506f4c44704ecb92088353d5c96d96d6474eb819d` | 170,366 |
| `Tuesday-WorkingHours.pcap_ISCX.csv` | 128.82 MB | `52b8692ae8c7d2ed04671fe2b98335693c0a92c7ab157d8c8b534d6523080851` | 445,909 |
| `Wednesday-workingHours.pcap_ISCX.csv` | 214.74 MB | `893c27dc968bf7a8adef1689f90be55ca4a4dc3088fb63d6ff247ac56856df2a` | 692,703 |
| **Total** | **843.66 MB** | — | **2,830,743** |

---

## 3. Data Cleansing & Audit Trail

| Step | Operation Description | Rows Impacted | Remaining Rows |
|---|---|---|---|
| **Raw Input** | Initial CSV ingestion across 8 days | — | 2,830,743 |
| **Infinite Values** | Stripped non-computable `+Inf` and `-Inf` rates | 2,867 | 2,827,876 |
| **Missing Values (NaN)** | Missing value audit (no NaN remained after inf removal) | 0 | 2,827,876 |
| **Deduplication** | Removed identical feature vectors across capture windows | 256,858 | 2,572,593 |
| **Clean Representative Subset** | Stratified sampling preserving 100% of minority attack vectors | — | **341,713** |

---

## 4. Label Normalization Taxonomy

All 15 raw labels from CIC-IDS2017 are canonically mapped into 9 coherent security classes:

| Raw CIC-IDS2017 Label | Normalized Semantic Label | Methodological Rationale |
|---|---|---|
| `BENIGN` | `BENIGN` | Baseline normal non-attack traffic. |
| `DDoS` | `DDoS` | Distributed denial of service attacks via LOIC botnet. |
| `PortScan` | `PortScan` | Reconnaissance scanning generated using Nmap. |
| `DoS Hulk`, `DoS GoldenEye`, `DoS slowloris`, `DoS Slowhttptest` | `DoS` | Aggregated denial of service tool suite into unified category. |
| `FTP-Patator`, `SSH-Patator` | `BruteForce` | Combined protocol-level credential brute forcing. |
| `Bot` | `Botnet` | ARES botnet command-and-control communication. |
| `Web Attack – Brute Force`, `Web Attack – XSS`, `Web Attack – Sql Injection` | `WebAttack` | Consolidated application-layer web vulnerability exploits. |
| `Infiltration` | `Infiltration` | Preserved lateral movement and MetaSploit payload execution. |
| `Heartbleed` | `Heartbleed` | Preserved OpenSSL memory vulnerability disclosure exploit. |

---

## 5. Cleaned Dataset Class Distribution

| Class Label | Row Count | Percentage (%) | Role in Pipeline |
|---|---|---|---|
| **BENIGN** | 238,427 | 69.77% | Negative baseline for Supervised & Training set for Isolation Forest |
| **DDoS** | 30,000 | 8.78% | Volumetric malicious class |
| **PortScan** | 30,000 | 8.78% | Reconnaissance class |
| **DoS** | 29,998 | 8.78% | Service disruption class |
| **BruteForce** | 9,150 | 2.68% | Credential brute-forcing class |
| **WebAttack** | 2,143 | 0.63% | Web exploitation class |
| **Botnet** | 1,948 | 0.57% | Command & Control class |
| **Infiltration** | 36 | 0.0105% | Lateral movement minority class |
| **Heartbleed** | 11 | 0.0032% | Memory exploit minority class |
| **Total** | **341,713** | **100.00%** | Comprehensive research dataset |
