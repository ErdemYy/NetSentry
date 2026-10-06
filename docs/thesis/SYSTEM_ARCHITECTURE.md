# BÖLÜM 3: SİSTEM MİMARİSİ VE UÇTAN UCA VERİ AKIŞI (SYSTEM_ARCHITECTURE.md)

## 1. Mimarî Genel Bakış
NetSentry AI, gevşek bağlı (loosely coupled), olay güdümlü (event-driven) ve yüksek verimli dağıtık bir mikroservis ekosistemi olarak tasarlanmıştır.

```text
                     ┌───────────────────────────────────┐
                     │     CIC-IDS2017 Akış Kaynağı      │
                     │      (clean_flows.parquet)        │
                     └─────────────────┬─────────────────┘
                                       │
                                       ▼
                     ┌───────────────────────────────────┐
                     │     Kontrollü Yeniden Oynatıcı    │
                     │       (FlowReplayEngine)          │
                     └─────────────────┬─────────────────┘
                                       │
                                       ▼
                     ┌───────────────────────────────────┐
                     │    Redis Stream: netsentry:flows  │
                     │    (Group: ml-inference)          │
                     └─────────────────┬─────────────────┘
                                       │
                                       ▼
                     ┌───────────────────────────────────┐
                     │     ML Inference Worker Servisi   │
                     │   - 77-Öznitelik Şema Kontrolü    │
                     │   - RobustScaler Dönüşümü         │
                     │   - LightGBM (9-Sınıf Gözetimli)  │
                     │   - Isolation Forest (Eşik: τ*)   │
                     │   - Hibrit Karar Sentezi          │
                     │   - TreeSHAP Öznitelik Açıklaması │
                     └─────────────────┬─────────────────┘
                                       │
                                       ▼
                     ┌───────────────────────────────────┐
                     │  Redis Stream: netsentry:detections
                     │  (Group: netsentry-api-group)     │
                     └─────────────────┬─────────────────┘
                                       │
                                       ▼
                     ┌───────────────────────────────────┐
                     │     NestJS Core API Orchestrator  │
                     │   - Idempotent PostgreSQL Upsert  │
                     │   - Olay Korelasyonu & Eskalasyon │
                     │   - JWT & RBAC Erişim Kontrolü    │
                     │   - Güvenlik Denetim Günlüğü      │
                     └───────┬───────────────────┬───────┘
                             │                   │
                             ▼                   ▼
           ┌───────────────────────┐   ┌───────────────────────┐
           │      PostgreSQL       │   │  Socket.IO Gateway    │
           │  (Kalıcı Veritabanı)  │   │  (WSS /events Odası)  │
           └───────────────────────┘   └───────────┬───────────┘
                                                   │
                                                   ▼
                                       ┌───────────────────────┐
                                       │ Next.js SOC Dashboard │
                                       │ Erdem Design System   │
                                       │ (Zero-Mock UI)        │
                                       └───────────────────────┘
```

## 2. Temel Alt Sistemler ve Bileşenler

### 2.1 Asenkron Akış Katmanı (Redis Streams)
- **Transport:** Redis 7.0 Streams mimarisi kullanılmıştır. Standart Pub/Sub mimarisinin aksine Streams, hafızada mesaj kalıcılığı (`persistence`), tüketici grupları (`consumer groups`), okunmamış mesaj takibi (`pending list`) ve onaylama (`XACK`) yetenekleri sunar.
- **Kuyruklar:**
  - `netsentry:flows`: Ham akış vektörlerinin yayınlandığı ana giriş akışı.
  - `netsentry:detections`: Modeller tarafından üretilen `DetectionResult` nesnelerinin iletildiği ana çıkış akışı.
  - `netsentry:flows:dlq` & `netsentry:detections:dlq`: İşlenemeyen veya bozuk akışlar için Dead-Letter Queue.

### 2.2 Makine Öğrenmesi Çıkarım Servisi (`apps/ml`)
- **Tekil Servis (Singleton Pattern):** `InferenceService`, modelleri belleğe bir kez yükler (`ModelArtifactLoader`) ve hem REST hem de streaming isteklerinde aynı nesneyi kullanır.
- **Şema Koruyucu:** Gelen JSON yükü, `metadata.json` dosyasında tanımlanan 77 kanonik sütun sırasına ve `feature-schema-v1` şemasına tam uyumlu olmak zorundadır. Eksik, fazla, NaN veya sonsuz değerler anında reddedilir.
- **Kriptografik Bütünlük:** Modeller yüklenirken diskteki dosyaların SHA-256 özetleri doğrulanır.

### 2.3 Çekirdek API ve Güvenlik Düzenleyici (`apps/api`)
- **Teknoloji:** NestJS 11, TypeScript ve Prisma ORM (PostgreSQL 16).
- **Idempotence Garantisi:** Dağıtık sistemlerdeki en-az-bir-kez (at-least-once) teslimat mekanizmasının neden olabileceği mükerrer kayıtları engellemek için `flowId` ve `detectionId` birincil anahtarları üzerinden kontrol edilir.
- **Otomatik Eskalasyon:** `HIGH_RISK` veya `CRITICAL` düzeyindeki tespitler otomatik olarak kalıcı bir `Incident` (Güvenlik Olayı) kaydına dönüştürülür.
- **Gerçek Zamanlı İletim:** Socket.IO `/events` ad alanı üzerinden tüm istemcilere `threat_alert` ve `detection.created` olayları yayınlanır.

### 2.4 Operasyonel SOC Arayüzü (`apps/web`)
- **Teknoloji:** Next.js 16.3.6 (App Router), React 19 ve Tailwind CSS v4.
- **Tasarım Standartları:** Erdem Tasarım Sistemi tokenları (`--color-ink`, `--color-graphite`, `--color-signal`, `--color-tech`, Space Grotesk, JetBrains Mono).
- **Zero-Mock Garantisi:** Hiçbir gösterge sahte/random fonksiyonlardan beslenmez; tüm veriler gerçek backend'den dinamik olarak akar.
