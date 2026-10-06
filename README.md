# NetSentry AI

**Yapay Zeka Destekli Dağıtık Ağ Trafiği Anomali Tespiti ve Gerçek Zamanlı Tehdit İstihbarat Platformu**  
*AI-Assisted Distributed Network Traffic Anomaly Detection and Real-Time Threat Intelligence Platform*

---

## 1. Problem Tanımı (Problem)
Modern kurumsal ağlarda artan trafik hacmi ve karmaşık saldırı vektörleri, geleneksel siber güvenlik savunma mekanizmalarında iki kritik kısıt doğurmaktadır:
1. **İmza Tabanlı Kısıt:** Geleneksel kural motorları (Snort, Suricata vb.) daha önce tanımlanmamış sıfırıncı gün saldırılarını ve varyantları yakalayamaz.
2. **Kara Kutu (Black-Box) ve Dengesizlik Problemi:** Literatürdeki salt gözetimli derin öğrenme modelleri eğitimde görmedikleri akışları yanlış sınıflandırmakta, gözetimsiz anomali modelleri ise yüksek yanlış alarm oranları üretmektedir. Ayrıca güvenlik analistleri, yapay zekanın ürettiği kararların matematiksel gerekçesini doğrudan görememektedir.

---

## 2. Çözüm (Solution)
NetSentry AI; **çift motorlu hibrit yapay zeka**, **TreeSHAP açıklanabilirlik motoru**, **asenkron akış omurgası** ve **Erdem Tasarım Sistemi'ne dayalı operasyonel SOC arayüzü** ile bu problemleri uçtan uca çözer:
- **LightGBM (Gözetimli):** Bilinen saldırı sınıflarını (DDoS, PortScan, DoS, Brute Force vb.) mikrosaniye düzeyinde yüksek güvenle sınıflandırır.
- **Isolation Forest (Gözetimsiz):** Meşru ağ davranışı dışına çıkan istatistiksel sapmaları tespit eder ($\tau^* = 0.49540$).
- **TreeSHAP:** Her akış için 77 özniteliğin Shapley değerlerini hesaplayarak analiste "Model bu akışı neden işaretledi?" sorusunun yanıtını verir.
- **Threat Intelligence Enrichment:** Dış istihbarat sağlayıcılarını (AbuseIPDB) SSRF korumalı ve 24 saat önbellekli bir zenginleştirme katmanı olarak sunar; ana yapay zeka tespitini dış servise bağımlı kılmaz.

---

## 3. Sistem Mimarisi (Architecture)

```text
Dataset / Flow Source (clean_flows.parquet)
                     │
                     ▼
       Redis Stream: netsentry:flows
                     │
       (Consumer Group: ml-inference)
                     ▼
                 ML Worker
   ┌─────────────────┼──────────────────┐
   ↓                 ↓                  ↓
LightGBM       Isolation Forest      TreeSHAP
(Supervised)    (τ* = 0.49540)     (Attributions)
   └─────────────────┬──────────────────┘
                     │ DetectionResult
                     ▼
       Redis Stream: netsentry:detections
                     │
       (Consumer Group: netsentry-api-group)
                     ▼
            NestJS Core API Orchestrator  ◄─── [Enrichment: AbuseIPDB + Redis Cache]
   ┌─────────────────┼──────────────────┐        (SSRF Protected, Non-blocking)
   ↓                 ↓                  ↓
PostgreSQL        AuditLog        Incident State Machine
(Persistence)   (Security Trail)  (Triage Validation)
   └─────────────────┬──────────────────┘
                     │ WSS (/events namespace, JWT Auth Guard)
                     ▼
         SOC Operations Dashboard (Next.js 16)
                     │
                     ▼
              SOC Analisti
```

---

## 4. Makine Öğrenmesi Metodolojisi (ML Methodology)
- **Veri Sızıntısı Önleme:** `Source IP`, `Destination IP`, `Source Port`, `Timestamp` ve `Flow ID` gibi alanlar modelin ezber yapmasını önlemek için eğitimden tamamen çıkarılmıştır.
- **Ölçekleme:** `RobustScaler` dönüşümü yalnızca Train kümesi üzerinde fit edilmiştir.
- **Eşik Kalibrasyonu:** Isolation Forest eşiği ($\tau^* = 0.49540$), test kümesine bakılmaksızın validation kümesindeki F1 optimizasyonuyla belirlenmiştir.
- **Deterministik Karar Sentezi:**
  - `NORMAL`: Meşru trafik ve anomali yok ($s(x) < \tau^*$).
  - `KNOWN_ATTACK`: Tanınan saldırı sınıfı ($\ge 0.80$) ve $s(x) < \tau^*$.
  - `HIGH_RISK`: Tanınan saldırı sınıfı ($\ge 0.80$) ve anomali eşiği aşıldı ($s(x) \ge \tau^*$).
  - `UNKNOWN_ANOMALOUS`: Modelin `BENIGN` sandığı ancak anomali eşiğini aşan şüpheli trafik.

---

## 5. Veri Seti (Dataset)
- **Kaynak:** CIC-IDS2017 (Canadian Institute for Cybersecurity).
- **Temizlenmiş Hacim:** 341.713 akış, 77 sayısal öznitelik.
- **Bölme:** %70 Eğitim (239.199), %15 Doğrulama (51.257), %15 Test (51.257).
- **Sınıflar (9 Sınıf):** `BENIGN`, `DDoS`, `PortScan`, `DoS`, `BruteForce`, `Botnet`, `WebAttack`, `Infiltration`, `Heartbleed`.

---

## 6. Deneysel Sonuçlar (Results)

### Gözetimli Model (LightGBM - EXP-001)
- **Doğruluk (Accuracy):** %99.85
- **Ağırlıklı F1 (Weighted F1):** %99.85
- **Makro Duyarlılık (Macro Recall):** %92.45
- **Makro Kesinlik (Macro Precision):** %98.78
- **Makro F1 (Macro F1):** %93.74

### Gözetimsiz Model (Isolation Forest - EXP-002)
- **ROC-AUC:** %73.35
- **Kesinlik (Precision):** %65.65
- **Duyarlılık (Recall):** %43.54
- **F1 Skoru:** %52.36
- **Yanlış Alarm Oranı (FPR):** %9.87

---

## 7. Gerçek Zamanlı Akış Boru Hattı (Real-Time Pipeline)
- **Taşıma:** Redis Streams (`XREADGROUP`, `XACK`, `XADD`) ile en az bir kez teslim garantisi.
- **DLQ:** Hatalı akışlar için `netsentry:flows:dlq` ve `netsentry:detections:dlq`.
- **Yayın:** NestJS WebSocket Gateway üzerinden `/events` isim alanında canlı istemci senkronizasyonu.

---

## 8. SOC Gösterge Paneli (SOC Dashboard)
- **Erdem Tasarım Sistemi:** `--color-ink` tabanlı editoryal koyu zemin, `Space Grotesk` başlıklar, telemetride `JetBrains Mono`.
- **%100 Zero-Mock Garantisi:** Sahte veri, rasgele grafikler veya `Math.random()` kesinlikle bulunmaz.
- **Temel Rotalar:**
  - `/` — Genel bakış, canlı sağlık probları, gerçek zamanlı aktivite akışı.
  - `/threats` & `/threats/[id]` — Tehdit tablosu, çift motorlu karar ve **"WHY DID THE MODEL FLAG THIS?" TreeSHAP** görselleştiricisi.
  - `/incidents` & `/incidents/[id]` — Olay önceliklendirme ve durum yönetimi.
  - `/network` & `/analytics` — Protokol, port ve saldırı taksonomisi analizleri.
  - `/models` — Eğitim deney metrikleri ile çalışma zamanı model bütünlüğü ayrımı.
  - `/settings` — Güvenlik denetim günlüğü ve kontrollü demo sıfırlama.

---

## 9. Tehdit İstihbaratı ve SSRF Güvenliği (Threat Intelligence)
- **AbuseIPDB Entegrasyonu:** Gerçek dış IP istihbaratı.
- **SSRF Önleme:** RFC 1918 özel IP blokları (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.1`) dış dünyaya sorgulanmaz (`INVALID_TARGET`).
- **Önbellek:** 24 saatlik Redis önbelleği ile kota koruması.
- **Non-Blocking Yapı:** İstihbarat servisi kapalı olsa dahi yapay zeka tespiti kesintisiz çalışır.

---

## 10. Güvenlik ve Sıkılaştırma (Security)
- **Kimlik Doğrulama:** JWT ve HTTP-only güvenli çerez (`netsentry_session`), bcrypt parola özetleme.
- **RBAC:** `ANALYST` ve `ADMIN` rolleri backend guards ile denetlenir.
- **Model Bütünlüğü:** 5 model dosyasının SHA-256 hash kontrolleri başlangıçta doğrulanır; manipüle edilmiş model yüklenmez.
- **API Koruması:** Helmet güvenlik başlıkları, Throttler rate limiting (300 req/dk), sanitize edilmiş hata filtresi.
- **Denetim Günlüğü:** `AuditLog` tablosu kritik tüm eylemleri kaydeder.

---

## 11. Performans Profili (Performance - EXP-005)
- **Ortalama Çıkarım Gecikmesi (SHAP Dahil):** 26.36 ms (P50: 24.12 ms, P95: 33.15 ms).
- **Hızlı Yol Gecikmesi (Fast-Path / No SHAP):** 20.26 ms.
- **Tek İş Parçacıklı İşleme Hacmi:** ~56.40 akış/saniye.
- **Güvenlik Ek Yükü:** < %6 (sıfır performans regresyonu).

---

## 12. Bilimsel Kısıtlar (Limitations)
- CIC-IDS2017 kontrollü laboratuvar ortamında üretilmiştir; gerçek dünya ağ gürültüsünün tamamını kapsamaz.
- Infiltration sınıfında düşük test desteği (3 örnek) nedeniyle Recall %33.3 seviyesindedir.
- Isolation Forest gözetimli model kadar yüksek kesinliğe sahip değildir (FPR %9.87).
- Sistem kurumsal bir SIEM'in tam ikamesi değildir; SIEM yetenekleriyle güçlendirilmiş bir NIDS/NDR platformudur.

---

## 13. Canlı Demo Yürütme (Demo)
```bash
# 1. Altyapıyı başlat
docker compose up -d postgres redis

# 2. Servisleri başlat
cd apps/api && npm run start
cd apps/ml && .venv/Scripts/python -m app.streaming.worker
cd apps/web && npm run start

# 3. Kontrollü akış oynat
cd apps/ml
.venv/Scripts/python -m app.streaming.replay --mode MIXED --rate 5 --max 5
```
Ayrıntılı 16 adımlı sunum senaryosu için: [docs/thesis/PRESENTATION_SCRIPT.md](file:///C:/Users/Okul/OneDrive/Belgeler/NetSentry/docs/thesis/PRESENTATION_SCRIPT.md)

---

## 14. Teknoloji Yığını (Tech Stack)
- **Frontend:** Next.js 16.3.6 (Turbopack), React 19.2.8, Tailwind CSS v4, Lucide React, Recharts.
- **Backend:** NestJS 11.0.1, TypeScript 5.7, Prisma 5.22, Socket.IO 4.8, Helmet, Throttler.
- **Yapay Zeka:** Python 3.12.10, LightGBM 4.6, Scikit-learn 1.6, SHAP 0.47, FastAPI, Pydantic.
- **Veri & Akış:** PostgreSQL 16-alpine, Redis 7-alpine, Docker Compose.

---

## 15. Tez Dokümantasyon Paketi (Thesis Package)
Kapsamlı akademik tez dokümanlarına `docs/thesis/` dizininden erişilebilir:
- [01. Özet (Abstract)](file:///C:/Users/Okul/OneDrive/Belgeler/NetSentry/docs/thesis/ABSTRACT.md)
- [02. Problem Tanımı](file:///C:/Users/Okul/OneDrive/Belgeler/NetSentry/docs/thesis/PROBLEM.md)
- [03. Proje Amaçları](file:///C:/Users/Okul/OneDrive/Belgeler/NetSentry/docs/thesis/OBJECTIVES.md)
- [04. Sistem Mimarisi](file:///C:/Users/Okul/OneDrive/Belgeler/NetSentry/docs/thesis/SYSTEM_ARCHITECTURE.md)
- [05. Veri Seti ve Ön İşleme](file:///C:/Users/Okul/OneDrive/Belgeler/NetSentry/docs/thesis/DATASET_AND_PREPROCESSING.md)
- [06. Makine Öğrenmesi Metodolojisi](file:///C:/Users/Okul/OneDrive/Belgeler/NetSentry/docs/thesis/MACHINE_LEARNING_METHODOLOGY.md)
- [07. Gerçek Zamanlı Akış Mimarisi](file:///C:/Users/Okul/OneDrive/Belgeler/NetSentry/docs/thesis/REALTIME_ARCHITECTURE.md)
- [08. Tehdit İstihbaratı Katmanı](file:///C:/Users/Okul/OneDrive/Belgeler/NetSentry/docs/thesis/THREAT_INTELLIGENCE.md)
- [09. Güvenlik Mimarisi](file:///C:/Users/Okul/OneDrive/Belgeler/NetSentry/docs/thesis/SECURITY_ARCHITECTURE.md)
- [10. Deneysel Sonuçlar](file:///C:/Users/Okul/OneDrive/Belgeler/NetSentry/docs/thesis/EXPERIMENTAL_RESULTS.md)
- [11. Sistemsel Sınırlılıklar](file:///C:/Users/Okul/OneDrive/Belgeler/NetSentry/docs/thesis/LIMITATIONS.md)
- [12. Sonuç ve Gelecek Çalışmalar](file:///C:/Users/Okul/OneDrive/Belgeler/NetSentry/docs/thesis/CONCLUSION.md)
- [13. Jüri Sunum Senaryosu](file:///C:/Users/Okul/OneDrive/Belgeler/NetSentry/docs/thesis/PRESENTATION_SCRIPT.md)
- [14. Jüri Soru-Cevap Rehberi](file:///C:/Users/Okul/OneDrive/Belgeler/NetSentry/docs/thesis/JURY_QA.md)
- [15. Savunma Kontrol Listesi](file:///C:/Users/Okul/OneDrive/Belgeler/NetSentry/docs/thesis/DEFENSE_CHECKLIST.md)
- [16. Nihai Sistem Doğrulama Raporu](file:///C:/Users/Okul/OneDrive/Belgeler/NetSentry/docs/thesis/FINAL_VALIDATION.md)
