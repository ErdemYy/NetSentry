# JÜRİ SUNUM SENARYOSU VE KONUŞMA METNİ (PRESENTATION_SCRIPT.md)

> **Hedef Süre:** 12–15 Dakika  
> **Gereksinimler:** Çalışan sistem (`localhost:3000` ve arka plandaki servisler), açık tarayıcı sekmesi, terminal pencereleri.

---

### 1. Giriş ve Problem Tanımı (Süre: ~1.5 dk)
> *"Sayın jüri üyeleri, hocalarım ve değerli katılımcılar; hoş geldiniz. Bugün sizlere bitirme projemiz olan **NetSentry AI: Yapay Zeka Destekli Dağıtık Ağ Trafiği Anomali Tespiti ve Gerçek Zamanlı Tehdit İstihbarat Platformu**'nu sunmaktan mutluluk duyuyorum.*
>
> *Modern kurumsal ağlarda karşılaştığımız temel problem şudur: Ağ trafiği gigabit seviyelerine ulaştığında, geleneksel Snort veya Suricata gibi imza tabanlı sistemler bilinmeyen sıfırıncı gün saldırılarını yakalayamaz. Öte yandan, literatürdeki salt gözetimli yapay zeka modelleri bilmedikleri bir saldırı geldiğinde yüksek güvenle yanlış sınıflandırma yapmakta, gözetimsiz anomali modelleri ise kabul edilemez yanlış alarm oranlarına yol açmaktadır. Ayrıca analistler, yapay zekanın kararlarının arkasındaki mantığı görememektedir.*
>
> *NetSentry AI, bu üç temel kısıtı çözmek üzere geliştirilmiştir."*

---

### 2. Veri Seti ve Sızıntı Önleme Disiplini (Süre: ~1.5 dk)
> *"Projemizin bilimsel temelini saygın **CIC-IDS2017** veri seti oluşturmaktadır. Ham 2.8 milyon akışı doğrudan eğitmek yerine, literatürde sıkça yapılan metodolojik bir hatadan özellikle kaçındık: IP ve Port numaralarını eğitimden çıkardık. Çünkü bu alanlar verildiğinde model saldırının doğasını değil, saldırganın IP'sini ezberlemektedir.*
>
> *Sonsuzluk ve boş değerleri temizledikten sonra, nadir saldırı sınıflarını (Heartbleed ve Infiltration gibi) %100 oranında koruduğumuz tabakalı bir örnekleme ile **341.713 akışlık** dengeli ve temiz bir veri kümesi oluşturduk."*

---

### 3. Çift Katmanlı Hibrit Yapay Zeka (Süre: ~1.5 dk)
> *"Sistemimizde tek bir model değil, iki bağımsız yapay zeka paradigması birlikte çalışır:*
>
> *1. **Gözetimli Modelimiz (LightGBM):** 9 saldırı sınıfını **%99.85 doğruluk** ve özellikle dengesiz sınıflarda kritik olan **%93.74 makro F1 skoruyla** sınıflandırmaktadır.*
> *2. **Gözetimsiz Modelimiz (Isolation Forest):** Yalnızca meşru trafik üzerinde eğitilmiş olup normallikten sapma skorunu hesaplar. Karar eşiğimiz ($\tau^* = 0.49540$), test verisine bakılmaksızın doğrulama kümesindeki F1 optimizasyonuyla nesnel olarak seçilmiştir.*
>
> *Deterministik kural motorumuz, bu iki çıktıyı sentezleyerek `NORMAL`, `KNOWN_ATTACK`, `HIGH_RISK` veya `UNKNOWN_ANOMALOUS` kararlarını üretir."*

---

### 4. Açıklanabilir Yapay Zeka: TreeSHAP (Süre: ~1.5 dk)
> *"NetSentry AI bir kara kutu değildir. Her bir çıkarım anında **TreeSHAP** algoritması çalışır. Modelin kararına etki eden 77 özniteliğin Shapley değerleri ve risk yönleri (+/-) hesaplanır.*
>
> *Böylece analist, 'Bu akış neden DDoS?' sorusunun yanıtını; örneğin 'İleri yönlü minimum segment boyutunun (+3.04) riski artırması' şeklinde açıkça görür."*

---

### 5. Dağıtık Akış Mimarisi: Redis Streams (Süre: ~1.5 dk)
> *"Canlı ağ trafiğinde paket kayıplarını engellemek için HTTP yerine **Redis Streams** tabanlı asenkron bir omurga kurduk. Akışlar `netsentry:flows` kuyruğuna yazılır, bağımsız Python ML Worker'ımız bunu tüketir ve çıkarım sonuçlarını `netsentry:detections` kuyruğuna iletir.*
>
> *Ölçtüğümüz 500 akışlık canlı benchmark sonucunda, SHAP dahil tam çıkarım gecikmemiz **ortalama 24.8 ms**, hızlı yol çıkarımımız ise **20.2 ms** seviyesindedir. Tek bir iş parçacığımız saniyede 57 akış işleyebilmektedir."*

---

### 6. Canlı SOC Dashboard ve Erdem Tasarım Sistemi (Süre: ~2.5 dk)
> *(Tarayıcıda `http://localhost:3000` ekranı açılır ve jüriye gösterilir)*
>
> *"Şimdi karşınızda gördüğünüz operasyonel SOC gösterge paneli, Erdem Tasarım Sistemi'nin editoryal ve yüksek bilgi yoğunluklu standartlarıyla Next.js üzerinde geliştirilmiştir.*
>
> *En önemli kuralımız: **KESİNLİKLE SAHTE / MOCK DATA YOKTUR.** Ekrandaki her sayı, grafik ve akış, az önce bahsettiğimiz backend'den, PostgreSQL'den ve Socket.IO `/events` yayınından beslenmektedir.*
>
> *Şimdi terminalden 5 kanonik akışı (BENIGN, PortScan, DDoS, DoS, BruteForce) canlı olarak hatta veriyorum:*
> `python -m app.streaming.replay --mode MIXED --rate 5 --max 5`
>
> *Gördüğünüz gibi, sayfa yenilenmeden, arka plandaki modelin çıkarımları milisaniyeler içinde ekrana düşmektedir."*

---

### 7. Tehdit Detayı ve İstihbarat Zenginleştirmesi (Süre: ~2 dk)
> *(Gelen DDoS tespitine tıklanır, `/threats/[id]` ekranı açılır)*
>
> *"İşte bir analistin ekranı:*
> *Üstte LightGBM'in %100 güveni ve Isolation Forest'ın 0.5032 anomali teyidi ile `CRITICAL HIGH_RISK` kararı.*
>
> *Hemen altında projemizin en gurur duyduğumuz bölümü: **'MODEL BU AKIŞI NEDEN İŞARETLEDİ?'**.*
> *Burada TreeSHAP barlarını ve risk yönlerini görüyorsunuz.*
>
> *Onun altında ise harici **Tehdit İstihbaratı (AbuseIPDB)** katmanımız yer almaktadır. Sistemimiz SSRF korumalıdır; iç ağ IP'lerini dışarıya sorgulatmaz ve API kotalarını korumak için 24 saatlik Redis önbelleği kullanır."*

---

### 8. Olay Yönetimi ve Güvenlik Sıkılaştırma (Süre: ~1 dk)
> *(Açık olaylara geçilir `/incidents`)*
>
> *"Yüksek riskli tespitler otomatik olarak bir Güvenlik Olayına dönüştürülür. Durum geçişleri backend'de sonlu durum makinesi (state machine) ile denetlenir.*
>
> *Sistemimiz JWT ve HTTP-only güvenli cookie ile korunmaktadır. Rol Tabanlı Erişim Kontrolü (RBAC) ile analistlerin hassas sistem denetim günlüklerine veya ayarları değiştirmesine izin verilmez."*

---

### 9. Akademik Kanıt ve Metrik Ayrımı (Süre: ~1 dk)
> *(Modeller sayfasına geçilir `/models`)*
>
> *"Akademik şeffaflık adına modeller sayfamızda iki temel ayrım yaptık:*
> *Üstte eğitim deneyimizin (EXP-001) test kümesindeki 9 sınıflı sabit akademik metrikleri; altta ise bellek üzerindeki çalışma zamanı modelimizin **SHA-256 kriptografik bütünlük doğrulaması** ve canlı gecikme profili yer almaktadır.*
> *Böylece jürimiz, eğitim başarımı ile canlı sistem durumunu birbirinden net biçimde ayırt edebilmektedir."*

---

### 10. Sonuç ve Soru-Cevap (Süre: ~1 dk)
> *"Özetle NetSentry AI; sadece izole bir makine öğrenmesi kodu ya da sahte verilerle süslenmiş bir dashboard değil; veri setinden çıkarım motoruna, güvenlik sıkılaştırmasından operasyonel arayüze kadar uçtan uca çalışan, doğrulanmış ve savunulabilir bir akademik mühendislik platformudur.*
>
> *Beni dinlediğiniz için teşekkür ederim. Sorularınızı yanıtlamaktan memnuniyet duyarım."*
