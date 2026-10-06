# NetSentry AI — Dataset Documentation (CIC-IDS2017)

## 1. Dataset Origin & Metadata
- **Dataset Name:** CIC-IDS2017 (Canadian Institute for Cybersecurity Intrusion Detection System 2017)
- **Institution:** University of New Brunswick (UNB)
- **Source URL:** https://www.unb.ca/cic/datasets/ids-2017.html
- **License / Terms of Use:** Academic and non-commercial research use.
- **Collection Period:** Monday, July 3, 2017 to Friday, July 7, 2017 (9:00 AM - 5:00 PM daily).

## 2. Ingestion Format & Preprocessing
The dataset provides both raw PCAPs and pre-extracted CSV flow files generated using `CICFlowMeter`:
- **Daily Sessions:**
  - `Monday-WorkingHours.pcap_ISCX.csv`: Benign background baseline
  - `Tuesday-WorkingHours.pcap_ISCX.csv`: FTP-Patator & SSH-Patator (Brute Force)
  - `Wednesday-WorkingHours.pcap_ISCX.csv`: DoS Slowloris, Slowhttptest, Hulk, GoldenEye & Heartbleed
  - `Thursday-WorkingHours-Morning-WebAttacks.pcap_ISCX.csv`: Web Attacks (Brute Force, XSS, SQL Injection)
  - `Thursday-WorkingHours-Afternoon-Infiltration.pcap_ISCX.csv`: Infiltration (Dropbox / MetaSploit)
  - `Friday-WorkingHours-Morning.pcap_ISCX.csv`: Botnet (ARES)
  - `Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv`: Port Scan
  - `Friday-WorkingHours-Afternoon-DDos.pcap_ISCX.csv`: DDoS (LOIC)

## 3. Class Imbalance Profile
A major challenge in realistic NIDS benchmarks is extreme class imbalance:
- **Benign:** Over 80% of total flows across the dataset.
- **Minority Classes:** Infiltration and Heartbleed constitute less than 0.1% of samples.
- **Mitigation Strategy:** Balanced class weights during training (`class_weight='balanced'`), Stratified K-Fold splitting, and evaluating macro-averaged F1 alongside PR-AUC rather than accuracy alone.

## 4. Feature Space & Cleansing Rules
- **Total Features:** 83 statistical flow attributes.
- **Excluded Features:** `Flow ID`, `Source IP`, `Destination IP`, `Timestamp` (excluded from model training to prevent memorization and spatial overfitting).
- **Cleansing:** Removal of `NaN`, `+Inf`, and `-Inf` flow rate values, followed by robust quantile clipping or standard scaling.
