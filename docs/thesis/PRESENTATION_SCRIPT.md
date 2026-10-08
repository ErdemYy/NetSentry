# JÜRİ SUNUM SENARYOSU VE KONUŞMA METNİ (PRESENTATION_SCRIPT.md)

> **Hedef Süre:** 12–15 Dakika  
> **Konuşmacı Rolü:** Sistem Mimarı ve Makine Öğrenmesi Mühendisi  
> **Gereksinimler:** Çalışan NetSentry AI Platformu (`http://localhost:3000`), NestJS Core API (`:3001`), ML Servisi (`:8000`), PostgreSQL (`:5433`), Redis (`:6380`).

---

## 1. Sunum Girişi & Bilimsel Motivasyon (Süre: 00:00 - 02:00)

> *"Sayın jüri başkanım, kıymetli jüri üyeleri ve hocalarım; hoş geldiniz.*
>
> *Bugün sizlere bitirme projemiz olan **NetSentry AI: Yapay Zeka Destekli Dağıtık Ağ Trafiği Anomali Tespiti ve Gerçek Zamanlı Tehdit İstihbarat Platformu**'nu takdim etmekten onur duyuyorum.*
>
> *Modern siber güvenlik operasyon merkezlerinin (SOC) karşılaştığı en temel ikilem şudur:*
> 1. *Geleneksel imza tabanlı IDS sistemleri (Snort, Suricata vb.) yeni veya şekil değiştirmiş saldırılara karşı kör kalmaktadır.*
> 2. *Literatürdeki salt gözetimli derin öğrenme veya sınıflandırma modelleri, eğitimde görmedikleri sıfırıncı gün saldırılarını aşırı yüksek güvenle 'normal' olarak etiketlemekte veya yanlış sınıfa atamaktadır.*
> 3. *Gözetimsiz anomali modelleri ise bilinmeyeni sezebilmekte fakat yüksek yanlış alarm oranları üreterek analistleri boğmaktadır.*
> 4. *En önemlisi, mevcut yapay zeka modelleri birer 'kara kutu' (black-box) olarak çalışmakta; bir akışın neden tehdit sayıldığını analiste açıklayamamaktadır.*
>
> *NetSentry AI; **çift motorlu hibrit yapay zeka (LightGBM + Isolation Forest)**, **TreeSHAP açıklanabilirlik motoru**, **asenkron Redis Streams boru hattı** ve **Erdem Tasarım Sistemi'ne dayalı gerçek zamanlı operasyon paneli** ile bu sorunları akademik disiplinle çözen uçtan uca bir mühendislik projesidir."*

---

## 2. Canlı Jüri Demosu: 16 Adımlı Operasyonel Akış (Süre: 02:00 - 11:00)

*(Tarayıcıda `http://localhost:3000` ekranı yansıtılır.)*

### Adım 1: Güvenli Oturum Açma (Login as ADMIN)
> *"Sistemimiz Phase 4 ile birlikte açık SOC modundan çıkarılmış, JWT ve HTTP-only güvenli çerez altyapısıyla sıkılaştırılmıştır.*
> *Ekranın sağ üstündeki oturum anahtarından sistem yöneticisi (`admin@netsentry.ai`) olarak giriş yapıyorum. Rol tabanlı erişim kontrolümüz (RBAC) arka planda Analist ve Yönetici yetkilerini katı bir biçimde ayırmaktadır."*

### Adım 2: Genel Bakış Paneli (Dashboard Overview)
> *"Gördüğünüz bu arayüz Erdem Tasarım Sistemi'nin bilgi-yoğun ve editoryal tasarım dilini yansıtmaktadır. Ekranın üst kısmında 4 temel KPI yer almaktadır: Aktif Tehditler, Olaylar (Incidents), Saniye Başına İşlenen Olay ve Toplam Analiz Edilen Akış Sayısı.*
> *En kritik kuralımız: **KESİNLİKLE SAHTE VEYA MOCK VERİ YOKTUR.** Ekrandaki her veri PostgreSQL ve canlı Redis omurgasından beslenmektedir."*

### Adım 3: Sistem Sağlığı Probları (System Health)
> *"Üst çubuktaki göstergelerimiz doğrudan `/api/v1/health/detailed` endpoint'i üzerinden Core API, ML Engine, Redis ve PostgreSQL bileşenlerimizin anlık çalışma durumunu ve Socket.IO `/events` canlı WebSocket bağlantısını doğrulamaktadır."*

### Adım 4: Kontrollü Veri Akışı Başlatma (Controlled Replay)
> *"Akademik güvenlik ilkeleri gereği sistemimiz harici ağlara gerçek saldırı paketleri atmaz. Bunun yerine CIC-IDS2017 veri setinden doğrulanmış `clean_flows.parquet` dosyasını kullanan kontrollü bir yeniden oynatma motorumuz vardır. Bu işlem tek komutluk `.\tools\final-demo.ps1 -Mode Replay` harness'ımız ile veya doğrudan replay modülümüz ile tetiklenebilir:*
> `python -m app.streaming.replay --mode MIXED --rate 5 --max 5`"

### Adım 5: Meşru Trafik Tespiti (BENIGN Flow)
> *"İlk akış meşru ağ trafiğidir (BENIGN). ML Worker akışı 24 ms içinde işlemiş, LightGBM %99.99 güvenle NORMAL verdict'ini vermiş, Isolation Forest anomali skoru ise 0.3226 ile belirlediğimiz 0.4954 eşiğinin oldukça altında kalmıştır. Düşük riskli olduğu için olay oluşturulmamıştır."*

### Adım 6: Keşif Saldırısı Tespiti (PortScan)
> *"İkinci akış PortScan keşif saldırısıdır. Gözetimli modelimiz bunu anında tespit etmiş, gözetimsiz model de sapmayı yakalamıştır. Tehdit seviyesi `HIGH` olarak işaretlenmiştir."*

### Adım 7: Hacimsel Saldırı Tespiti (DDoS)
> *"Üçüncü akış DDoS saldırısıdır. LightGBM %100 güvenle DDOS sınıfını belirlemiş, Isolation Forest anomali skoru 0.5032 ile eşiği aşmış ve `CRITICAL HIGH_RISK` kararı üretilmiştir."*

### Adım 8: Otomatik Olay Yükseltme (Incident Escalation)
> *"Kritik ve yüksek riskli tehditler backend tarafından otomatik olarak `/incidents` tablosuna bir Güvenlik Olayı olarak yükseltilmiştir. Sayfayı yenilemeden WebSocket üzerinden bildirim düşmüştür."*

### Adım 9: Tehdit Detay İncelemesi (Threat Detail - `/threats/[id]`)
> *(DDoS tehdidine tıklanır)*
> *"Tehdit detay sayfamız bir güvenlik analistinin adli bilişim incelemesi yapabileceği tüm taşıma ve akış telemetrisini (IP, Port, Bayraklar, Süre, Paket Boyutları) sergiler."*

### Adım 10: Çift Motorlu Karar Ayrımı (Dual Model Results)
> *"Burada iki modelin bağımsız kararlarını net biçimde görüyoruz: Solda LightGBM'in 9 sınıflı saldırı sınıflandırması (%100 DDoS), sağda ise Isolation Forest'ın normallikten sapma skoru ($s(x) = 0.5032 \ge \tau^* = 0.49540$)."*

### Adım 11: Açıklanabilir Yapay Zeka: TreeSHAP
> *"İşte NetSentry AI'ın en özgün akademik katkısı: **'MODEL BU AKIŞI NEDEN İŞARETLEDİ?'**.*
> *TreeSHAP motorumuz akıştaki 77 özniteliğin her birinin karar fonksiyonuna marjinal katkısını hesaplamıştır. Gördüğünüz gibi `min_seg_size_fwd` özniteliği +3.04 puanlık pozitif katkıyla riski artıran birincil faktör olmuştur. Yapay zekanın kararı tamamen matematiksel olarak açıklanabilir durumdadır."*

### Adım 12: Dış Tehdit İstihbaratı Zenginleştirmesi (Threat Intelligence)
> *"Açıklama kartının hemen altında harici Tehdit İstihbaratı (AbuseIPDB) bölümümüz yer almaktadır. Sistemimiz SSRF korumalıdır: RFC 1918 özel IP blokları (`192.168.x.x`) için dış dünyaya sorgu atmaz ve `INVALID_TARGET` döner. Dış servis kapalı olsa dahi temel yapay zeka tespitimiz %100 kesintisiz çalışmaya devam eder (Non-blocking Augmentation)."*

### Adım 13: Olay Durum Yönetimi (Incident Investigation - `/incidents`)
> *"Olay yönetimi sayfamızda durumu `INVESTIGATE` ve ardından `RESOLVE` olarak güncelliyorum. Backend sonlu durum makinemiz geçersiz geçişleri (örneğin `RESOLVED -> NEW`) engeller ve her adımı denetim günlüğüne yazar."*

### Adım 14: Modeller ve Metrik Ayrımı Sayfası (`/models`)
> *"Modeller sayfamızda jüri üyelerimizin dikkatine sunmak istediğimiz hayati bir bilimsel ayrım vardır:*
> *Üstte **EXP-001 Eğitim Deneyimizin** sabit test metrikleri (LightGBM %99.85 doğruluk, %93.74 Makro F1) yer alırken; altta ise bellek üzerindeki **Çalışma Zamanı Modelimizin SHA-256 kriptografik bütünlük kontrolü** ve canlı gecikme profili yer alır. Kullanıcı eğitim başarımı ile anlık akış başarımını birbirine karıştıramaz."*

### Adım 15: Güvenlik Denetim Günlüğü (Audit Trail - `/settings`)
> *"Yönetici yetkisiyle girdiğimiz ayarlarda 'System Security Audit Trail' tablosunu inceliyoruz. Yapılan tüm girişler, rol kontrolleri, olay durum değişiklikleri ve istihbarat sorguları kimlik ve zaman damgasıyla kriptografik olarak kaydedilmiştir."*

### Adım 16: Mimarinin Özetlenmesi
> *"Böylece 16 adımlık canlı operasyon döngümüzü tamamlamış oluyoruz: Veri Seti $\to$ Redis Streams $\to$ ML Worker (LightGBM + Isolation Forest + SHAP) $\to$ NestJS Core API $\to$ PostgreSQL $\to$ WebSocket $\to$ SOC Dashboard $\to$ Analist Kararı."*

---

## 3. Bilimsel Savunma ve Kısıtlar (Süre: 11:00 - 13:00)

> *"Sunumumu tamamlarken iki kritik akademik dürüstlük ilkesini vurgulamak isterim:*
>
> 1. ***Yalnızca %99.85 Doğruluk (Accuracy) ile övünmüyoruz:** Sınıf dengesizliği nedeniyle asıl başarımız **%93.74 Makro F1** ve **%92.45 Makro Recall** skorlarımızdır. CIC-IDS2017'deki Infiltration sınıfı çok az örneğe sahip olduğu için recall değeri %33.3 çıkmıştır; bu sonucu yapay büyütmelerle makyajlamadık, olduğu gibi belgeledik.*
> 2. ***Sıfırıncı Gün ve SIEM İddialarımız Sınırlıdır:** Sistemimiz kurumsal bir SIEM'in tüm log korelasyonunun yerine geçmez; SIEM yetenekleriyle güçlendirilmiş bir NIDS platformudur. Gözetimsiz anomali motorumuz meşru davranıştan sapmaları yakalar, ancak bu 'garantili sıfırıncı gün tespiti' olarak adlandırılamaz.*
>
> *Dinlediğiniz için çok teşekkür ederim. Sorularınızı almaktan memnuniyet duyarım."*
