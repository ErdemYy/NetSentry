# AKADEMİK JÜRİ SORU-CEVAP REHBERİ (JURY_QA.md)

NetSentry AI bitirme tezi savunmasında jüri üyeleri tarafından yöneltilmesi muhtemel 20 kritik soru ve bu soruların bilimsel, metodolojik ve mühendislik temelli yanıtları aşağıda sunulmuştur.

---

### 1. Neden CIC-IDS2017 Veri Setini Tercih Ettiniz?
**Cevap:**  
CIC-IDS2017 (Canadian Institute for Cybersecurity), modern saldırı senaryolarını (DDoS, PortScan, Brute Force, Web Saldırıları, Botnet, Infiltration, Heartbleed) ve gerçekçi arka plan meşru trafiğini (HTTP, HTTPS, SSH, FTP, DNS) pcap seviyesinde barındıran, akademik literatürde standart kabul edilen bir kıyaslama (benchmark) veri setidir. KDD99 ve NSL-KDD gibi 25 yıllık demode veri setleri modern taşıma katmanı dinamiklerini temsil edememektedir. CIC-IDS2017, CICFlowMeter ile çıkarılmış 80'den fazla çift yönlü akış özniteliği sunarak ağ intrusion detection araştırmaları için endüstri standardı gerçekçilik sağlar.

---

### 2. Neden LightGBM Algoritmasını Seçtiniz? (Derin Öğrenme veya XGBoost Yerine)
**Cevap:**  
Üç temel nedenden dolayı:
1. **Çıkarım Hızı ve Düşük Bellek Tüketimi:** Histogram tabanlı karar ağacı bölme algoritması ve yaprak odaklı (leaf-wise) büyüme stratejisi sayesinde LightGBM, XGBoost'a kıyasla 8 ila 10 kat daha hızlı eğitilmekte ve çıkarım yapmaktadır.
2. **Tabüler Veri Üstünlüğü:** Ağ akış verisi gibi tabüler yapılarda ağaç tabanlı gradyan artırma yöntemleri (GBDT), çok katmanlı yapay sinir ağlarından (MLP/CNN) daha yüksek genelleme başarımı göstermektedir.
3. **Milisaniye Seviyesinde Gecikme:** Modelimizin tek bir akış için saf çıkarım süresi ~2.6 milisaniyedir. Bu hız, gerçek zamanlı hat hızı denetimi için zorunludur.

---

### 3. Neden Isolation Forest Algoritmasını Seçtiniz?
**Cevap:**  
Isolation Forest, yoğunluk tabanlı (DBSCAN) veya mesafe tabanlı (k-NN, LOF) anomali tespit yöntemlerinin aksine $O(n \log n)$ zaman karmaşıklığına sahiptir. Veri uzayındaki normallik modelini kurmak yerine anomalileri "izole etmenin ne kadar kolay olduğuna" odaklanır. Çok boyutlu (77 boyutlu) ağ akış uzayında boyutsallık lanetine (curse of dimensionality) karşı dirençlidir ve gerçek zamanlı akış puanlamasında (~12 ms) son derece verimlidir.

---

### 4. Neden Hibrit Bir Mimari? (Supervised + Unsupervised)
**Cevap:**  
Siber güvenlikte tek bir paradigma tek başına yeterli değildir:
- **Gözetimli Model (LightGBM):** Bilinen saldırı sınıflarını (DDoS, PortScan vb.) %99.85 doğrulukla ve yüksek güvenle tanır; ancak eğitim kümesinde yer almayan yeni bir saldırı türü geldiğinde bunu çaresizce bildiği sınıflardan birine veya BENIGN sınıfına yüksek güvenle atar.
- **Gözetimsiz Model (Isolation Forest):** Yalnızca meşru trafik üzerinde öğrenilmiş sınırların dışına çıkan sapmaları tespit eder; ancak saldırının hangi sınıfa ait olduğunu veya adını söyleyemez.
**Sentez:** Sistemimiz iki modelin çıktısını deterministik kural motorunda birleştirir: Hem sınıfı bilinen hem anomali eşiğini aşan akışlar `HIGH_RISK`, sınıfı bilinmeyen ancak anomali eşiğini aşan akışlar ise `UNKNOWN_ANOMALOUS` olarak işaretlenir.

---

### 5. Neden SHAP (TreeSHAP) Açıklanabilirlik Yöntemini Tercih Ettiniz?
**Cevap:**  
Geleneksel öznitelik önem metrikleri (Gini kirliliği veya gain) küreseldir ve spesifik bir akışın neden tehdit sayıldığını açıklayamaz. LIME gibi örnek tabanlı yöntemler ise yerel pertürbasyonlar kullandığı için yavaştır ve rastlantısaldır. **TreeSHAP**, oyun teorisindeki Shapley değerlerini ağaç tabanlı yapılar için polinomiyal zamanda ($O(T L D^2)$) kesin matematiksel doğrulukla hesaplar. Ekranımızdaki her Shapley barı, o akışın risk skoruna yapılan net marjinal katkıyı temsil eder.

---

### 6. Neden Yalnızca %99.85 Doğruluk (Accuracy) Yeterli Bir Başarı Kriteri Değildir?
**Cevap:**  
Siber güvenlik veri setleri doğal olarak aşırı dengesizdir (imbalanced). CIC-IDS2017'de trafiğin %80'inden fazlası meşru (BENIGN) akışlardır. Bir model hiçbir saldırıyı yakalamasa ve her şeye 'BENIGN' dese dahi %80 üzerinde doğruluk alacaktır. Bu sebeple tezimizde başarımızı **Makro F1 (%93.74)** ve **Makro Recall (%92.45)** ile savunuyoruz. Makro metrikler tüm sınıfları eşit ağırlıklandırdığı için azınlık saldırı sınıflarındaki en ufak başarısızlığı dahi cezalandırır.

---

### 7. Veri Sızıntısını (Data Leakage) Nasıl Engellediniz?
**Cevap:**  
Üç aşamalı katı sızıntı önleme protokolü uyguladık:
1. **Kimlik Özniteliklerinin İptali:** `Source IP`, `Destination IP`, `Source Port`, `Timestamp` ve `Flow ID` gibi alanlar eğitim kümesinden tamamen çıkarılmıştır. Aksi takdirde model saldırının paket özelliklerini değil, saldırganın IP'sini veya laboratuvar test yatağının portunu ezberleyecektir.
2. **Bölme Disiplini:** Veri tabakalı olarak Train (%70), Validation (%15) ve Test (%15) olarak ayrılmıştır.
3. **Ölçekleme İzolasyonu:** `RobustScaler` dönüşüm parametreleri (medyan ve IQR) **yalnızca Train kümesi** üzerinden hesaplanmış (`fit`), Validation ve Test kümelerine yalnızca uygulanmıştır (`transform`).

---

### 8. Isolation Forest Karar Eşiğini ($\tau^*$) Nasıl Belirlediniz?
**Cevap:**  
Eşik değeri keyfi olarak (örneğin varsayılan 0.50) seçilmemiştir. Model eğitildikten sonra, **Test kümesine hiçbir şekilde dokunulmadan**, Validation kümesi üzerinde $0.10$ ile $0.90$ aralığında 500 adımlı bir ROC/F1 ızgara araması yapılmıştır. Anomali F1 skorunu maksimize eden optimal nokta $\tau^* = 0.49540$ olarak hesaplanmış ve kalibre edilmiş eşik olarak dondurulmuştur.

---

### 9. Infiltration Saldırısında Recall Neden %33.3 Seviyesindedir?
**Cevap:**  
Bu durum bir model hatası değil, veri setinin fiziksel gerçekliğidir. 2.8 milyonluk CIC-IDS2017 ana veri setinde Infiltration sınıfına ait yalnızca 36 adet akış bulunmaktadır. Tabakalı test kümemize sadece 3 ila 4 örnek düşmektedir. Bir örneğin kaçırılması dahi recall oranını %33'e düşürmektedir. Akademik dürüstlük gereği bu sınıfı SMOTE gibi sentetik yöntemlerle yapay olarak şişirmedik ve istatistiksel belirsizliğiyle birlikte tez kısıtları bölümünde açıkça paylaştık.

---

### 10. Dış Tehdit İstihbaratı (Threat Intel) Servisi Kesilirse Ne Olur?
**Cevap:**  
Mimari kuralımız gereği Threat Intelligence katmanı bir **bağımlılık değil, zenginleştirme (augmentation)** katmanıdır. AbuseIPDB servisi kapalıysa, API kotası dolduysa (`RATE_LIMITED`) veya internet bağlantısı yoksa (`UNAVAILABLE`):
- Temel ML çıkarımı (LightGBM, Isolation Forest ve TreeSHAP) **%100 çalışmaya devam eder**.
- Tehdit detayı sayfasında sahte puan üretilmez, analiste açıkça "Dış İstihbarat Yapılandırılmadı / Kullanılamıyor" uyarısı verilir.

---

### 11. Bu Sistem Sıfırıncı Gün (Zero-Day) Saldırılarını Tespit Edebilir mi?
**Cevap:**  
**Net ve dürüst bilimsel yanıt:** "Garantili sıfırıncı gün tespiti" siber güvenlik literatüründe ulaşılamaz bir vaattir. Ancak NetSentry AI, Isolation Forest gözetimsiz motoru sayesinde meşru ağ davranışının istatistiksel sınırlarının dışına çıkan hacimsel, zamansal veya bayrak kombinasyonu anomalilerini yakalar. Yeni bir saldırı gözetimli model tarafından `BENIGN` sanılsa bile, anomali skoru $\tau^*$ eşiğini aştığı anda sistem `UNKNOWN_ANOMALOUS` bayrağı kaldırarak analisti uyarır.

---

### 12. NetSentry AI Bir SIEM midir?
**Cevap:**  
Hayır, NetSentry AI tam kapsamlı bir kurumsal SIEM (Splunk, QRadar, Elastic Security vb.) ikamesi değildir. NetSentry AI; SIEM sistemlerinden ilham alan olay yükseltme, durum yönetimi, denetim günlüğü (audit trail) ve dış istihbarat yetenekleriyle donatılmış bir **Yapay Zeka Destekli Ağ İhlal Tespit ve İzleme Platformudur (AI-NIDS/NDR)**.

---

### 13. NIDS ile SIEM Arasındaki Temel Fark Nedir?
**Cevap:**  
- **NIDS (Network Intrusion Detection System):** Doğrudan ağ kablosundan geçen paketleri ve akışları (IPFIX/NetFlow) katman 3, 4 ve 7 seviyesinde gerçek zamanlı inceler.
- **SIEM (Security Information and Event Management):** Ağın yanı sıra işletim sistemi loglarını, güvenlik duvarı kurallarını, Active Directory girişlerini, uygulama günlüklerini toplar ve korelasyon kurallarıyla merkezi analiz yapar.
NetSentry AI, NIDS katmanında yapay zeka ile tespit üretir ve bu tespitleri SIEM'e standart CEF/Syslog veya REST/WebSocket ile besleyebilir.

---

### 14. Neden REST API Yerine Redis Streams Tercih Ettiniz?
**Cevap:**  
Yüksek hızlı ağ trafiğinde REST API (HTTP POST) kullanımı, TCP el sıkışma maliyetleri, HTTP başlık yükü ve senkron bekleme nedeniyle paket kayıplarına yol açar. Redis Streams; bellek içi çalışma hızı, tüketici grupları (Consumer Groups), mesaj onay mekanizması (`XACK`) ve Dead-Letter Queue (DLQ) yapısıyla en az bir kere teslim (at-least-once delivery) garantisi sunan endüstri standardı bir dağıtık akış omurgasıdır.

---

### 15. Neden PostgreSQL Tercih Edildi? (NoSQL / MongoDB Yerine)
**Cevap:**  
Siber güvenlik operasyonlarında veri bütünlüğü ve adli ilişkilendirme esastır:
Bir `Flow` $\to$ `DetectionResult` $\to$ `Incident` $\to$ `AuditLog` $\to$ `User` zincirinde yabancı anahtar (foreign key) kısıtları, ilişkisel tutarlılık ve ACID işlem garantisi zorunludur. PostgreSQL 16, Prisma ORM ile birlikte bu ilişkisel bütünlüğü ve indekslenmiş zaman serisi sorgularını milisaniyeler içinde sunmaktadır.

---

### 16. Saniyede 10.000 Akış (10,000 flows/sec) Gelse Sistem Ne Yapar?
**Cevap:**  
Mevcut deneylerimizde tek bir Python iş parçacığı ortalama 56.4 flows/sec işlemektedir. Kurumsal ölçekteki 10.000 flows/sec yükü için mimarimiz şu şekilde ölçeklenir:
1. **Yatay ML Worker Kümesi:** Redis Streams tüketici grubu (`ml-inference`) sayesinde aynı akış kuyruğunu 150-200 adet konteynerize Python worker eşzamanlı olarak paylaşır.
2. **Hızlı Yol (Fast-Path):** Meşru olduğu kesin olan (`supervisedConfidence > 0.99` ve `isAnomaly = False`) akışlarda SHAP hesaplaması atlanarak çıkarım süresi 26 ms'den 2 ms seviyesine indirilir.

---

### 17. Sistemin Temel Bilimsel ve Teknik Kısıtları Nelerdir?
**Cevap:**  
1. **Sentetik Test Yatağı Sınırlılığı:** CIC-IDS2017 kontrollü laboratuvar ortamında üretilmiştir; gerçek dünya kurumsal trafiğinin tüm karmaşıklığını ve gürültüsünü tam olarak yansıtmaz.
2. **Nadir Sınıf Temsili:** Infiltration ve Heartbleed sınıfları veri setinde çok az örneğe sahiptir.
3. **Gözetimsiz Yanlış Alarm Oranı:** Isolation Forest'ın FPR oranı %9.87'dir.
4. **Harici İstihbarat Bağımlılığı:** Dış API sağlayıcılarının kota ve erişilebilirlik limitleri vardır.
5. **Canlı Saldırı Yapılmaması:** Sistem canlı saldırı üretmez; yasal ve etik sınırlar içinde gerçek akışları yeniden oynatır.

---

### 18. Neden Canlı Ağ Üzerinde Gerçek Saldırı Gerçekleştirmediniz?
**Cevap:**  
Üniversite bilişim politikaları, siber suç mevzuatı ve akademik güvenlik etiği gereği kampüs veya kamu ağlarında izinsiz DoS/DDoS ve Brute Force saldırıları yürütmek yasa dışıdır. Ayrıca kontrollü bir veri setiyle çalışmak deneylerin deterministik, tekrarlanabilir ve hakemler/jüri tarafından doğrulanabilir olmasını sağlar.

---

### 19. Bu Sistemi Gerçek Bir Kurumda Nasıl Konumlandırırdınız?
**Cevap:**  
1. **Trafik Aynalama:** Omurga anahtarların (Core Switch) SPAN/TAP portundan ağ trafiği dinlenir.
2. **Akış Çıkarımı:** Zeek veya Suricata açık kaynak motorları pcap paketlerini IPFIX/NetFlow akış vektörlerine dönüştürür.
3. **Kuyruk Dağıtımı:** Akışlar Apache Kafka veya Redis Streams kümesine basılır.
4. **Dağıtık Çıkarım:** Docker/Kubernetes üzerinde çalışan NetSentry ML Worker havuzu tespitleri üretir.
5. **SOC ve SIEM Entegrasyonu:** Sonuçlar NestJS Core API üzerinden hem NetSentry SOC paneline hem de kurumsal SIEM sistemine aktarılır.

---

### 20. Arayüzde Neden Erdem Tasarım Sistemini Tercih Ettiniz?
**Cevap:**  
Siber güvenlik analistleri günde 8-10 saat boyunca yüksek dikkat gerektiren telemetri verilerini incelemektedir. Geleneksel "bilim-kurgu/neon/siberpunk" temalı arayüzler göz yorgunluğuna ve dikkat dağınıklığına yol açar. Erdem Tasarım Sistemi; `--color-ink` tabanlı koyu editoryal zemin, teknik verilerde `JetBrains Mono` monospaced tipografi, çift katmanlı erişilebilir tehdit etiketleri ve animasyon kısıtı (`prefers-reduced-motion`) ile gerçek bir Tier-2/Tier-3 analistin ihtiyaç duyduğu odaklanmış operasyonel netliği sağlar.
