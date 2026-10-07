# BÖLÜM 6: GERÇEK ZAMANLI AKIŞ MİMARİSİ (REALTIME_ARCHITECTURE.md)

## 1. Akış Ayrıştırma Felsefesi (Decoupled Stream Pipeline)
Geleneksel web servislerinde ağ akışlarının doğrudan HTTP `POST` ile senkron şekilde değerlendirilmesi, yoğun paket patlamaları sırasında HTTP zaman aşımlarına, kuyruk tıkanmalarına ve paket kayıplarına yol açar.

NetSentry AI, akış üretimini (ingestion) model çıkarımından (inference) ve veritabanı kaydından (persistence) tamamen bağımsızlaştırmak için **Redis Streams** olay veriyolunu merkezî omurga olarak kullanır.

---

## 2. Redis Streams ile Dağıtık Akış Yönetimi

### 2.1 Akış Kanalları ve Sorumluluklar
1. `netsentry:flows`: Ham akış meta-verilerinin ve 77 öznitelik vektörlerinin JSON olarak iletildiği ana giriş kanalı.
2. `netsentry:detections`: Model çıkarımından sonra üretilen `DetectionResult` ve SHAP özetlerinin iletildiği çıkış kanalı.
3. `netsentry:flows:dlq` & `netsentry:detections:dlq`: Format hatası veya ardışık 3 denemede işlenemeyen iletilerin aktarıldığı Dead-Letter Queue kuyrukları.

### 2.2 Tüketici Grupları (Consumer Groups)
- **`ml-inference` Grubu:** Python `MLStreamWorker` tarafından tüketilir. `XREADGROUP` ile bloklayıcı şekilde (1000 ms zaman aşımı) 10'lu partiler halinde akışları okur.
- **`netsentry-api-group` Grubu:** NestJS `RedisConsumerService` tarafından tüketilir. Üretilen tespit sonuçlarını yakalar.
- **Onaylama Disiplini (`XACK`):** Her mesaj ancak ve ancak çıkarım/kayıt başarıyla tamamlandıktan sonra onaylanır. Çökme veya yeniden başlama durumunda teslim edilmemiş iletiler otomatik olarak yeniden işlenir.

---

## 3. NestJS Core API Düzenleyici ve PostgreSQL Kalıcılığı

### 3.1 Idempotent Kayıt Stratejisi
Ağ aksamaları ve yeniden denemeler sonucu aynı akışın mükerrer iletilmesi durumunda veritabanında yinelenen kayıtlar oluşmasını engellemek için Prisma ORM üzerinden deterministik `flowId` ve `detectionId` anahtarları ile `upsert` ve `findUnique` kontrolleri uygulanır.

### 3.2 Olay Korelasyonu ve Olay (Incident) Eskalasyonu
Her tespit bir olay değildir. Analistlerin alarm yorgunluğu (alert fatigue) yaşamasını engellemek için:
- Yalnızca `HIGH` veya `CRITICAL` önem derecesindeki ya da `HIGH_RISK` kararına sahip tespitler otomatik olarak bir `Incident` (Güvenlik Olayı) kaydı haline getirilir.
- Benzer kaynak ve hedefe sahip akışlar ilişkilendirilir.

---

## 4. WebSocket Gateway ve Gerçek Zamanlı Dağıtım
- **Protokol:** Socket.IO / WSS.
- **Ad Alanı (Namespace):** `/events`.
- **Yayın Olayları:**
  - `threat_alert`: `threat_feed` odasına abone olan tüm analist ekranlarına anlık bildirim fırlatır.
  - `detection.created`: Genel akış akışına (activity stream) her yeni tespit olayını ulaştırır.
- **Yeniden Bağlanma Dayanıklılığı:** İstemci tarafındaki `useRealtime` kancası, üstel geri çekilme (exponential backoff: 1s-5s) ile bağlantı kesintilerinde otomatik olarak yeniden bağlanır (`RECONNECTING` $\rightarrow$ `LIVE`).

---

## 5. Çift Veri Kaynağı Mimarisi: Replay vs Canlı Sensör (Phase 6)

NetSentry AI, gerçek zamanlı tespit hattında iki bağımsız veri kaynağını destekleyecek biçimde tasarlanmıştır:

```text
┌────────────────────────────────┐       ┌────────────────────────────────┐
│   CIC-IDS2017 Veri Kümesi      │       │     Gerçek Ağ Arayüzü / PCAP   │
│   (Benchmark / Replay Motoru)  │       │     (Live Network Sensor)      │
└───────────────┬────────────────┘       └───────────────┬────────────────┘
                │                                        │
                │ FlowFeatureVector                      │ FlowFeatureVector
                │ source: "replay"                       │ source: "live"
                │                                        │
                └───────────────► ┌────────────────────┐ ◄┘
                                  │  netsentry:flows   │
                                  └─────────┬──────────┘
                                            │
                                            ▼
                                  ┌────────────────────┐
                                  │     ML Worker      │
                                  │ (LightGBM+IF+SHAP) │
                                  └─────────┬──────────┘
                                            │
                                            ▼
                                  ┌────────────────────┐
                                  │  NestJS Core API   │
                                  └─────────┬──────────┘
                                            │
                                  ┌─────────┴──────────┐
                                  ▼                    ▼
                           ┌──────────────┐     ┌──────────────┐
                           │  PostgreSQL  │     │  WebSocket   │
                           │ (Kalıcılık)  │     │  (SOC UI)    │
                           └──────────────┘     └──────────────┘
```

1. **Benchmark / Replay Modu (`source: "replay"`):**
   - Kaynak: Doğrulanmış CIC-IDS2017 zemin gerçekliği etiketlerine sahip kayıtlar.
   - Rol: Bilimsel doğruluk (Macro F1: %93.74, ROC-AUC: %73.35) ve benchmark karşılaştırmaları.

2. **Canlı Ağ Sensörü Modu (`source: "live"`):**
   - Kaynak: Windows Npcap / Scapy paket yakalama motoru ve iki yönlü akış birleştirici.
   - Rol: Gerçek ağda operasyonel anomali ve saldırı tespiti.
   - Başarım: 17,207.9 paket/sn işleme verimi, 0.1593 ms öznitelik çıkarım gecikmesi, 39.64 ms uçtan uca ML gecikmesi.
   - Güvence: Ground-truth etiketi bulunmayan canlı trafikte yapay doğruluk metriği uydurulmaz; operasyonel akış hacmi, sınıf dağılımı ve gecikme telemetrisi raporlanır.

