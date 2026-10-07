# Canlı Ağ Sensörü, İki Yönlü Akış Rekonstrüksiyonu ve Gerçek Zamanlı Öznitelik Çıkarımı
## NetSentry AI — Faz 6 Operasyonel Ağ Sensörü Dokümantasyonu

---

## 1. Giriş ve Problem Tanımı

Ağ Tabanlı Saldırı Tespit Sistemleri (NIDS) üzerine yapılan akademik ve endüstriyel çalışmalarda en sık karşılaşılan kısıt, modellerin **yalnızca önceden işlenmiş statik veri seti akış kayıtları (örneğin CIC-IDS2017 CSV kayıtları)** üzerinde doğrulanıp, gerçek bir ağ arayüzünden akan ham paketleri (Ethernet/IP/TCP/UDP) gerçek zamanlı olarak yakalayıp işleyememesidir.

NetSentry AI Faz 0 — Faz 5 aşamalarında, bilimsel metodolojiye uygun olarak CIC-IDS2017 veri seti işlenmiş, `feature-schema-v1` ile dondurulmuş 77 kanonik öznitelik çıkarılmış, hibrit LightGBM (Supervised) + Isolation Forest (Unsupervised) + TreeSHAP (XAI) modelleri eğitilmiş ve Redis tabanlı asenkron olay hattı kurulmuştur.

**Faz 6'nın temel amacı:** Mevcut eğitilmiş modelleri ve dondurulmuş sözleşmeleri (model weights, scaler, schema, hyperparameters) **kesinlikle değiştirmeden**, sisteme gerçek ağ arayüzünden (NIC) veya offline PCAP yakalama dosyalarından doğrudan paket dinleyen, iki yönlü (bidirectional) akışları birleştiren ve mikrosaniye seviyesinde 77 kanonik öznitelik vektörü üreten bağımsız bir **Live Network Sensor** alt sistemi kazandırmaktır.

```text
┌────────────────────────────────────────────────────────┐
│           AĞ KATMANI (NIC / PCAP Dosyası)              │
└──────────────────────────┬─────────────────────────────┘
                           │ Ham Paketler (Scapy / Npcap)
                           ▼
┌────────────────────────────────────────────────────────┐
│               PacketParser (Gizlilik Korumalı)         │
│  - Yalnızca L3/L4 başlık istatistikleri ve bayraklar   │
│  - Ham paket yükü (payload) ASLA saklanmaz             │
└──────────────────────────┬─────────────────────────────┘
                           │ ParsedPacket
                           ▼
┌────────────────────────────────────────────────────────┐
│        FlowManager & BidirectionalFlow Tablosu         │
│  - 5'li Demet Kanonik Konuşma Anahtarı (FlowKey)       │
│  - İleri/Geri Yön Tespiti (Initiator-Relative)         │
│  - Yaşam Döngüsü: TCP FIN/RST Teardown + Timeout       │
└──────────────────────────┬─────────────────────────────┘
                           │ Tamamlanmış Akış
                           ▼
┌────────────────────────────────────────────────────────┐
│        Canonical 77 Feature Extraction Motoru          │
│  - feature-schema-v1 doğrulaması (Sıfır NaN / Inf)     │
│  - Ortalama Çıkarım Gecikmesi: 0.1593 ms               │
└──────────────────────────┬─────────────────────────────┘
                           │ FlowFeatureVector { source: "live" }
                           ▼
┌────────────────────────────────────────────────────────┐
│         Redis Stream: netsentry:flows                  │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│         Mevcut ML Worker (LightGBM + IF + SHAP)        │
└────────────────────────────────────────────────────────┘
```

---

## 2. Windows Npcap ve Paket Yakalama Mimarisi

Geliştirme ve işletim ortamı Windows olduğu için paket yakalama katmanı platforma uygun olarak Scapy ve Npcap kütüphaneleriyle entegre edilmiştir.

### 2.1. Npcap Sürücü Tespiti ve Zarafetle Hata Yönetimi (Graceful Degradation)
Windows işletim sistemlerinde Ethernet düzeyinde promiscuous mode paket yakalama `Npcap` çekirdek sürücüsünü gerektirir. Sensör motoru başlatılırken:
1. `InterfaceManager.is_npcap_installed()` çağrısı yapılarak Scapy pcap sağlayıcısı (`scapy.conf.use_pcap`) kontrol edilir.
2. Sürücü kurulu değilse sistem çökmez; durumunu `SENSOR_UNAVAILABLE` olarak raporlar ve API tüketicilerine/dashboard'a açıklayıcı kurulum talimatı iletir.
3. Kullanıcı yetkileri yetersiz olduğunda `CAPTURE_PERMISSION_DENIED`, geçersiz ağ arayüzü seçildiğinde `INVALID_INTERFACE` hata kodları üretilir.

### 2.2. Offline PCAP İşleme Desteği
Npcap sürücüsünün bulunmadığı veya kullanıcı haklarının kısıtlı olduğu laboratuvar ortamlarında, `process_pcap_file` fonksiyonu `scapy.PcapReader` üzerinden offline `.pcap`/`.pcapng` dosyalarını okuyarak aynı akış rekonstrüksiyon hattından geçirir. Bu mimari jüri sunumunda ve altın standart (golden PCAP) testlerinde deterministik doğrulama sağlar.

---

## 3. İki Yönlü Akış Rekonstrüksiyonu (Bidirectional Flow Reconstruction)

CICFlowMeter metodolojisiyle uyumlu olarak, tek bir ağ iletişimi bağımsız tek yönlü paket dizileri yerine istemci-sunucu arasındaki iki yönlü bir konuşma (conversation) olarak ele alınır.

### 3.1. Kanonik Konuşma Anahtarı (`FlowKey`)
Akış anahtarı IPv4 5'li demetinden (`src_ip`, `src_port`, `dst_ip`, `dst_port`, `protocol`) türetilir. İki yönlü konuşmanın tekil bir tablo girdisi olabilmesi için uç noktalar kanonik olarak sıralanır:

$$\text{Endpoint}_A = (\text{src\_ip}, \text{src\_port})$$
$$\text{Endpoint}_B = (\text{dst\_ip}, \text{dst\_port})$$
$$\text{Canonical ID} = (\min(\text{Endpoint}_A, \text{Endpoint}_B), \max(\text{Endpoint}_A, \text{Endpoint}_B), \text{Protocol})$$

Böylece $A \to B$ ve $B \to A$ paketleri bellekte aynı `BidirectionalFlow` nesnesine yönlendirilir.

### 3.2. Yön Belirleme (Forward vs Backward)
Akışta ilk gözlemlenen paketin kaynağı **Başlatıcı (Initiator)** olarak atanır.
- Başlatıcıdan çıkan paketler $\to$ `FORWARD`
- Karşı uçtan başlatıcıya dönen paketler $\to$ `BACKWARD`

---

## 4. Akış Yaşam Döngüsü ve Kapanma Kriterleri (Flow Lifecycle)

Kısmi veya henüz tamamlanmamış akışların ML modeline gönderilmesi engellenmiştir. Bir akış yalnızca aşağıdaki koşullardan biri sağlandığında sonlandırılır:

1. **TCP Sıfırlama (RST):** Tek taraflı acil bağlantı koparma bayrağı görüldüğünde akış derhal sonlandırılır (`TCP_RST`).
2. **TCP Karşılıklı Kapanma (FIN Handshake):** Her iki uç noktanın da FIN bayrağı gönderdiği doğrulandığında (`fin_count >= 2`), bağlantı normal kapanma kabul edilerek derhal sonlandırılır (`TCP_FIN`).
3. **Etkinsizlik Zaman Aşımı (Inactivity Timeout):** UDP akışları ve oturum bayrağı göndermeden sessiz kalan TCP akışları için arka planda çalışan temizlik iş parçacığı (`_sweep_worker`), `NETSENTRY_FLOW_TIMEOUT_MS` (varsayılan 30-60 saniye) süresince yeni paket almayan akışları zaman aşımı ile kapatır (`TIMEOUT`).
4. **Kapasite Tahliyesi (Capacity Eviction):** Bellek güvenliği için `NETSENTRY_MAX_ACTIVE_FLOWS` (varsayılan 10,000) aşıldığında en eski aktif akış güvenli şekilde sonlandırılır (`CAPACITY_EVICTION`).

---

## 5. Kanonik 77-Öznitelik Çıkarım Motoru

Model sözleşmesi olan `feature-schema-v1` tam olarak 77 sayısal öznitelik bekler. Çıkarım motoru bu özellikleri aşağıdaki kurallara göre hesaplar:

| Kategori | Özellikler | Birim / Kural |
|---|---|---|
| **Zaman ve Süre** | `flow_duration`, IAT istatistikleri | Mikrosaniye ($\mu s$) cinsindendir ($1 s = 10^6 \mu s$). |
| **Paket ve Bayt Hacmi** | `total_fwd_packets`, `total_bwd_packets`, `total_fwd_bytes`, `total_bwd_bytes` | Tamsayı / Float bayt toplamları. |
| **Paket Boyutu İstatistikleri** | Min, Max, Mean, Std, Varyans | Wire length üzerinden hesaplanır. Tek pakette Std = 0.0'dır. |
| **Akış Oranları** | `flow_bytes_per_sec`, `flow_packets_per_sec` | Saniye başına hacim. Süre sıfır ise sıfıra bölme engellenir ve 0.0 atanır. |
| **TCP Bayrak Sayaçları** | `fin_flag_count`, `syn_flag_count`, `rst_flag_count`, `psh_flag_count`, `ack_flag_count` vb. | Gözlemlenen bayrakların iki yönlü toplam sayısı. |
| **Pencere Boyutları** | `init_win_bytes_fwd`, `init_win_bytes_bwd` | İleri ve geri yönde görülen ilk TCP pencere boyutu. |
| **Aktif / Boşta Süreleri** | `active_mean`, `idle_mean`, `active_std`, `idle_std` vb. | Paketler arası bekleme 5.0 saniyeyi ($5 \times 10^6 \mu s$) aştığında `idle` olarak izlenir. |

### 5.1. Veri Kalitesi Güvencesi (Zero NaN / Inf Guarantee)
Öznitelik vektörü oluşturulduktan sonra `FeatureSchemaValidator` devresine girer:
- 77 özniteliğin tam ve eksiksiz varlığı kontrol edilir.
- `float("nan")`, `float("inf")` ve `-float("inf")` değerleri kontrol edilir.
- Doğrulanamayan hiçbir akış Redis akışına yazılmaz; `feature_extraction_errors` sayacı artırılarak güvenli hata kaydı tutulur.

---

## 6. Deneysel Başarım ve Benchmark Sonuçları

`apps/ml/scripts/benchmark_sensor.py` çalıştırılarak Windows ortamında yerel Npcap/Scapy akış işleme hattı test edilmiş ve gerçek ölçüm sonuçları `apps/ml/reports/phase6_benchmark.json` dosyasına kaydedilmiştir:

```text
======================================================================
   NETSENTRY AI — PHASE 6 LIVE SENSOR BENCHMARK SUITE
======================================================================
[*] Test PCAP: 700 Paket, 100 İki Yönlü TCP Konuşması

1. AKIŞ REKONSTRÜKSİYONU VE ÖZNİTELİK ÇIKARIMI:
   - Paket İşleme Verimi (Throughput):       17,207.9 paket / saniye
   - Akış Rekonstrüksiyon Verimi:            2,458.3 akış / saniye
   - Öznitelik Çıkarım Gecikmesi (Ortalama):  0.1593 ms (159.3 µs)
   - Öznitelik Çıkarım Gecikmesi (P50):       0.1437 ms (143.7 µs)
   - Öznitelik Çıkarım Gecikmesi (P95):       0.2480 ms (248.0 µs)
   - Öznitelik Çıkarım Gecikmesi (P99):       0.3582 ms (358.2 µs)

2. UÇTAN UCA AKIŞ GECİKMESİ (Sensör -> Redis -> ML Inference):
   - Uçtan Uca Gecikme (Ortalama):            39.64 ms
   - Uçtan Uca Gecikme (P50):                 36.09 ms
   - Uçtan Uca Gecikme (P95):                 43.46 ms
   - Uçtan Uca Gecikme (P99):                104.15 ms
======================================================================
```

Bu sonuçlar, öznitelik çıkarım motorunun akış başına ortalama 159 mikrosaniyede tamamlandığını ve uçtan uca tespit hattının 40 ms civarında bir gecikmeyle gerçek zamanlı SOC operasyonuna olanak sağladığını kanıtlamaktadır.

---

## 7. Model Uyumluluğu ve Altın Standart (Golden PCAP) Doğrulaması

`apps/ml/tests/test_sensor.py` içerisindeki 10 adet test modülü ile doğrulama gerçekleştirilmiştir:
1. **Golden PCAP Parite Testi:** Bilinen analitik parametrelere sahip kontrollü bir PCAP üretilmiş; çıkarılan 77 öznitelik analitik referans değerlerle (paket sayıları, bayraklar, pencere büyüklükleri, akış süresi toleransı) karşılaştırılarak %100 uyum doğrulanmıştır.
2. **Model Kabul Testi:** Gerçek çıkarılmış 77 öznitelik vektörü `InferenceService.predict()` metoduna iletilmiş, LightGBM sınıflandırıcısı, Isolation Forest anomali skoru ve TreeSHAP yerel açıklama motoru sıfır hata ve sahte fallback olmadan geçerli sonuçlar üretmiştir.
3. **Redis Entegrasyon Testi:** Tamamlanan canlı akışın `source: "live"` etiketiyle `netsentry:flows` stream'ine yazıldığı, ML Stream Worker tarafından tüketilerek `netsentry:detections` stream'ine ve Pub/Sub olayına aktarıldığı doğrulanmıştır.

---

## 8. Güvenlik, Gizlilik ve Erişim Kontrolü

1. **Sıfır Paket Yükü Saklama (Zero Payload Retention):** Sensör modülü hiçbir zaman paket yükünü (HTTP gövdeleri, parolalar, çerezler, veritabanı sorguları) bellekte tutmaz veya veritabanına kaydetmez. Sadece paket boyutu, taşıma başlığı uzunluğu ve TCP bayrakları işlenir.
2. **Rol Tabanlı Erişim Kontrolü (RBAC):** Sensörü başlatma (`POST /api/v1/sensor/start`) ve durdurma (`POST /api/v1/sensor/stop`) yalnızca `ADMIN` rolüne açıktır. `ANALYST` rolü yalnızca izleme (`GET /api/v1/sensor/status`) yapabilir.
3. **Denetim İzi (Audit Logging):** Her sensör başlatma, durdurma ve PCAP işleme eylemi PostgreSQL üzerindeki `AuditLog` tablosuna kullanıcı kimliği ve parametreleriyle kaydedilir.
4. **Saldırı Üretimi Yasağı:** Sensör bileşeni kesinlikle paket enjeksiyonu, tarama, DoS veya saldırı simülasyonu yapmaz; sadece pasif dinleme (passive sniffer) gerçekleştirir.
