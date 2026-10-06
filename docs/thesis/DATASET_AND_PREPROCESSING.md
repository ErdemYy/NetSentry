# BÖLÜM 4: VERİ SETİ, TABAKALAMA VE ÖN İŞLEME (DATASET_AND_PREPROCESSING.md)

## 1. CIC-IDS2017 Veri Seti Analizi
Çalışmada, New Brunswick Üniversitesi Kanada Siber Güvenlik Enstitüsü (CIC) tarafından geliştirilen ve modern ağ trafiği karakteristiklerini yansıtan **CIC-IDS2017** veri seti kullanılmıştır. Veri seti, 5 günlük çalışma haftasında (Pazartesi-Cuma) üretilen gerçekçi arka plan trafiği ile güncel saldırı senaryolarını (DDoS, DoS, PortScan, BruteForce, Web Attacks, Botnet, Infiltration, Heartbleed) içermektedir.

Ham veri seti toplam **2.830.743** akış ve 85 sütundan oluşmaktadır.

## 2. Veri Temizleme ve Sızıntı (Data Leakage) Önleme Disiplini

### 2.1 Doğrudan Bilgi Sızıntısı Yaratan Alanların Ayrıştırılması
Akademik NIDS literatüründeki yaygın bir metodolojik hata; `Source IP`, `Destination IP`, `Source Port`, `Destination Port`, `Timestamp` ve `Flow ID` gibi alanların doğrudan eğitim özniteliği olarak verilmesidir. Bu durum, modelin saldırının yapısal trafik dinamiğini (paket boyutları, bayraklar, akışlar arası süreler) öğrenmek yerine, yalnızca test ortamındaki saldırgan IP adresini (örn. `172.16.0.1`) ezberlemesine yol açar.

NetSentry AI, model eğitiminde bu alanları kesinlikle girdi matrisine dahil etmemiştir. Bu alanlar yalnızca adli bilişim (forensics) ve SOC görselleştirmesi için meta-veri olarak saklanmıştır.

### 2.2 Veri Temizleme Adımları
1. **Sonsuzluk ve Boş Değerler:** `Flow Bytes/s` ve `Flow Packets/s` gibi alanlardaki `+Infinity`, `-Infinity` ve `NaN` değerleri temizlenmiştir.
2. **Sabit ve Varyansı Sıfır Sütunlar:** Hiçbir bilgi taşımayan sabit değerli sütunlar (örn. `Bwd PSH Flags`, `Fwd URG Flags`, `Bwd URG Flags` gibi bazı dosyalardaki sabit alanlar) ayıklanmıştır.
3. **Kanonik 77-Öznitelik:** Temizleme sonucunda her bir akış, tam 77 sayısal ağ dinamiği özniteliği ile temsil edilmiştir.

## 3. Etiket Normalizasyonu (15 Ham Sınıftan 9 Standart Aileye)
Ham veri setindeki 15 parça etiket, semantik olarak tutarlı 9 ana saldırı ailesine dönüştürülmüştür:

| Normalize Sınıf | Kapsanan Ham Etiketler |
| :--- | :--- |
| **BENIGN** | Meşru / Normal Trafik |
| **DoS** | DoS Hulk, DoS GoldenEye, DoS slowloris, DoS Slowhttptest |
| **DDoS** | DDoS LOIC |
| **PortScan** | PortScan |
| **BruteForce** | FTP-Patator, SSH-Patator |
| **WebAttack** | Web Attack – Brute Force, Web Attack – XSS, Web Attack – Sql Injection |
| **Botnet** | Bot |
| **Infiltration** | Infiltration |
| **Heartbleed** | Heartbleed |

## 4. Tabakalı Örnekleme (Stratified Sampling) ve Azınlık Koruma Kuralı
2.8 milyon satırlık ham verinin tamamının bellek üzerinde işlenmesi gereksiz donanım tıkanmalarına neden olurken, rastgele örnekleme (random downsampling) nadir saldırı sınıflarını (örneğin yalnızca 11 örneği bulunan Heartbleed veya 36 örneği bulunan Infiltration) tamamen yok etme riski taşır.

Bu nedenle NetSentry AI, **%100 Azınlık Korumalı Tabakalı Örnekleme** uygulamıştır:
- **Nadir Sınıflar:** Heartbleed (11), Infiltration (36), Web Attack (2.180), Botnet (1.966) akışlarının **%100'ü eksiksiz korunmuştur**.
- **Hacimli Sınıflar:** Aşırı kalabalık BENIGN ve DoS/DDoS sınıfları istatistiksel dağılımı temsil edecek şekilde dengelenmiştir.
- **Nihai Temsili Veri Seti:** Toplam **341.713** akış (`clean_flows.parquet`).
  - BENIGN: 238.427 akış (%69.8)
  - SALDIRI: 103.286 akış (%30.2)

## 5. Bölümleme ve Ölçekleme (Train / Validation / Test)
- **Train Kümesi (%70):** 239.199 akış (Model ağırlıklarının öğrenilmesi).
- **Validation Kümesi (%15):** 51.257 akış (Hiperparametre optimizasyonu ve anomali eşiği $\tau^*$ taraması).
- **Test Kümesi (%15):** 51.257 akış (Yalnızca nihai akademik başarı ölçümü, asla eşik ayarında kullanılmamıştır).

**Ölçekleme:** Aşırı uç değerlere (outliers) karşı dirençli olan **RobustScaler** kullanılmıştır. Aykırı değerlerin medyan ve çeyrekler arası aralık (IQR) kullanılarak normalize edilmesi, ağ trafiğinde sıkça görülen ani paket patlamalarının model parametrelerini bozmasını engellemiştir.
