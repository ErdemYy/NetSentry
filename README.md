# NetSentry AI

> **Yapay Zeka Destekli Dağıtık Ağ Trafiği Anomali Tespiti ve Gerçek Zamanlı Tehdit İstihbarat Platformu**  
> *Academic Capstone / Graduation Thesis Project (Akademik Bitirme Tezi)*

---

## 🛡️ Project Overview
**NetSentry AI** is a distributed, explainable, and real-time Network Intrusion Detection System (NIDS) and Security Operations Center (SOC) intelligence platform. It bridges the gap between traditional signature-based security rules and modern artificial intelligence by fusing **multi-class supervised machine learning** (LightGBM/XGBoost) with **unsupervised anomaly detection** (Isolation Forest) and **Explainable AI (SHAP)**.

---

## 🏛️ System Architecture

```
[Network Traffic / PCAP Replay]
               │
               ▼
[Flow Extractor (CIC-FlowMeter)]
               │ (Statistical Flow Features)
               ▼
   [Redis Event Stream] (In-memory message broker)
               │
               ▼
[Python FastAPI ML Engine] ─── (Supervised + Isolation Forest + SHAP XAI)
               │
               ▼
   [NestJS Core API] ─────── (Prisma ORM + PostgreSQL 16 + RBAC)
               │
               ▼ (WebSocket /events)
[Next.js SOC Dashboard] ──── (Erdem Design System · Real-Time Incident Response)
```

---

## 🧰 Technology Stack

| Layer | Technologies | Role |
|---|---|---|
| **Web Frontend** | Next.js 16 (App Router), React 19, Tailwind CSS, Erdem Design System, Lucide React, Recharts | High-density SOC Dashboard, Live threat stream, XAI visualizer |
| **Core Backend** | NestJS 11, TypeScript, Prisma ORM, WebSocket (Socket.io) | Orchestration, JWT cookie auth, RBAC, audit logging |
| **Database** | PostgreSQL 16 | Relational domain storage (12 models) |
| **Message Broker** | Redis 7 | Event stream and ingestion decoupling |
| **ML Engine** | Python 3.12, FastAPI, Scikit-learn, LightGBM, XGBoost, SHAP | Flow inference, anomaly scoring, feature attribution |
| **Design System** | Erdem Design System (Antigravity Adapter) | Technical dark tokens, Space Grotesk, JetBrains Mono |
| **Infrastructure** | Docker Compose | Multi-container local orchestration |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js:** v20+ (Tested on v24.19)
- **Python:** 3.12+
- **Docker & Docker Compose**

### Running via Docker Compose
```bash
# 1. Clone & enter repository
cd NetSentry

# 2. Copy environment template
cp .env.example .env

# 3. Spin up all services
docker compose up -d
```

### Local Development Setup
```bash
# 1. Install Node dependencies
npm install

# 2. Build shared TypeScript contracts
npm run build --workspace=@netsentry/shared

# 3. Setup Python virtual environment for ML service
cd apps/ml
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd ../..

# 4. Generate Prisma Client
npm run prisma:generate --workspace=@netsentry/api

# 5. Start development servers
npm run dev
```

---

## 📚 Documentation
- [System Architecture](file:///C:/Users/Okul/OneDrive/Belgeler/NetSentry/docs/ARCHITECTURE.md)
- [Machine Learning Methodology](file:///C:/Users/Okul/OneDrive/Belgeler/NetSentry/docs/ML-METHODOLOGY.md)
- [Dataset Specifications (CIC-IDS2017)](file:///C:/Users/Okul/OneDrive/Belgeler/NetSentry/docs/DATASET.md)
- [Threat Model & MITRE ATT&CK](file:///C:/Users/Okul/OneDrive/Belgeler/NetSentry/docs/THREAT-MODEL.md)
- [REST & WebSocket API Reference](file:///C:/Users/Okul/OneDrive/Belgeler/NetSentry/docs/API.md)
- [Academic Jury Demonstration Script](file:///C:/Users/Okul/OneDrive/Belgeler/NetSentry/docs/DEMO.md)
- [Experimentation Ledger](file:///C:/Users/Okul/OneDrive/Belgeler/NetSentry/docs/EXPERIMENTS.md)
- [Architectural Decision Records](file:///C:/Users/Okul/OneDrive/Belgeler/NetSentry/docs/DECISIONS.md)

---

## ⚖️ License
Academic Research & Capstone Project License.
