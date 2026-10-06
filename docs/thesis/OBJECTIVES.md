# BÖLÜM 2: PROJENİN AMAÇ VE KAPSAMI (OBJECTIVES.md)

## 1. Temel Amaç
Bu bitirme çalışmasının temel amacı; kurumsal düzeyde akademik ve endüstriyel gereksinimleri karşılayan, bilimsel olarak doğrulanabilir, açıklanabilir, dağıtık ve uçtan uca çalışan bir **Ağ Güvenliği ve Tehdit İstihbarat Platformu (NetSentry AI)** tasarlamak, geliştirmek ve doğrulamaktır.

## 2. Alt Hedefler ve Kapsam

### 2.1 Veri Seti ve Ön İşleme Hedefleri
- Saygın ve literatürde kabul görmüş **CIC-IDS2017** veri setinin uçtan uca analiz edilmesi.
- Veri sızıntısını (data leakage) engellemek amacıyla IP adresleri, portlar, akış kimlikleri ve zaman damgalarının eğitim özniteliklerinden mutlak olarak ayrıştırılması.
- Sonsuz (Infinity) ve eksik (NaN) değerlerin elenmesi, 15 ham etiketin 9 standart siber güvenlik kategorisine (BENIGN, DoS, DDoS, PortScan, BruteForce, Botnet, Infiltration, WebAttack, Heartbleed) normalize edilmesi.
- Azınlık saldırı vektörlerinin (Heartbleed, Infiltration) %100 oranında korunduğu tabakalı (stratified) 341.713 akışlık dengeli bir veri mimarisi oluşturulması.

### 2.2 Makine Öğrenmesi ve Hibrit Karar Motoru Hedefleri
- **Gözetimli Sınıflandırıcı:** Düşük gecikmeli ve yüksek doğruluklu LightGBM modelinin eğitilmesi; makro F1 skorunun en az %90 seviyesine çıkarılması.
- **Gözetimsiz Anomali Tespiti:** Yalnızca temiz (BENIGN) trafik üzerinde eğitilen Isolation Forest ile normallikten sapma skoru ($s(x)$) üretilmesi; karar eşiğinin ($\tau^*$) doğrulama kümesi üzerinde nesnel F1-optimizasyonu ile belirlenmesi.
- **Hibrit Karar Sentezi:** Modellerin sonuçlarını deterministik kurallarla birleştirerek akışları `NORMAL`, `KNOWN_ATTACK`, `ANOMALOUS`, `HIGH_RISK` veya `UNKNOWN_ANOMALOUS` olarak sınıflandırmak.
- **Açıklanabilirlik (XAI):** Her bir akış için TreeSHAP algoritması ile öznitelik etki değerlerinin (+/- Shapley katkıları) gerçek zamanlı olarak hesaplanması.

### 2.3 Dağıtık ve Gerçek Zamanlı Akış Mimarisi Hedefleri
- Akış yakalama/yeniden oynatma ile çıkarım süreçlerini Redis Streams (`netsentry:flows`, `netsentry:detections`) ile asenkron biçimde ayrıştırmak.
- Tüketici grupları (`ml-inference`, `netsentry-api-group`), onaylama (`XACK`) ve hata kuyrukları (`DLQ`) ile sıfır paket kaybı garantisi sağlamak.
- Ortalama çıkarım gecikmesini 50 ms altında tutmak.

### 2.4 SOC Operasyon Arayüzü ve Kullanıcı Deneyimi Hedefleri
- Erdem Tasarım Sistemi ilkelerine uygun (karanlık mod, minimal, editoryal, yüksek bilgi yoğunluğu) bir operasyonel gösterge paneli (SOC Dashboard) geliştirmek.
- Kesin Sahte Veri Yasağı (Strict Zero-Mock Policy): Tüm göstergelerin, tabloların ve grafiklerin NestJS Core API, PostgreSQL ve WebSocket'ten beslenmesi.
- Tehdit detayında "MODEL BU AKIŞI NEDEN İŞARETLEDİ?" bölümüyle analiste şeffaf karar gerekçesi sunmak.

### 2.5 Güvenlik Sıkılaştırma ve Tehdit İstihbaratı Hedefleri
- JWT ve HTTP-only cookie tabanlı güvenli kimlik doğrulama, Rol Tabanlı Erişim Kontrolü (RBAC: `ANALYST`, `ADMIN`).
- SSRF korumalı harici Tehdit İstihbaratı (AbuseIPDB) entegrasyonu ve Redis önbellekleme mekanizması.
- SHA-256 kriptografik model bütünlük doğrulaması ve şema versiyon kontrolü (`feature-schema-v1`).
- Denetim günlüğü (Audit Trail) ve jüri sunumuna özel kontrollü durum sıfırlama (Demo Reset) kabiliyeti.
