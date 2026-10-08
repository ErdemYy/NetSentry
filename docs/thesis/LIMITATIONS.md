# BÖLÜM 10: BİLİMSEL KISITLAR VE GELECEK ÇALIŞMALAR (LIMITATIONS.md)

## 1. Bilimsel Dürüstlük İlkesi
Bir mühendislik bitirme çalışmasının akademik değeri, yalnızca başarılarını öne çıkarmasında değil; sistemin sınırlarını, kısıtlarını ve varsayımlarını şeffaf biçimde tanımlayabilmesinde yatar. NetSentry AI, jüri karşısında savunulabilir ve gerçekçi bir çerçeve çizmek adına aşağıdaki kısıtları açıkça beyan eder.

---

## 2. Mevcut Sistemin Bilimsel Kısıtları

### 2.1 Veri Seti Temsiliyeti (CIC-IDS2017)
- CIC-IDS2017 veri seti, modern ağ trafiğini başarıyla yansıtsa da, 2017 yılına ait test laboratuvarı koşullarında üretilmiştir. Günümüzdeki QUIC protokolü, TLS 1.3 şifreli trafiği ve modern fidye yazılımı (ransomware) tünellemelerinin tüm varyantlarını kapsamaz.
- Sistem bu kısıt nedeniyle gerçek dünya trafiğinde yeniden eğitime (retraining) ihtiyaç duyabilir.

### 2.2 Uç Azınlık Sınıflarının Temsil Güçlüğü
- Ham veri setinde **Infiltration** sınıfı yalnızca 36 örneğe, **Heartbleed** ise 11 örneğe sahiptir. %15'lik tabakalı test kümesinde sırasıyla 6 ve 1 örnek yer almaktadır.
- Tabakalı örnekleme ile bu akışların tamamı korunmuş olsa dahi, 6 örnekli bir sınıfta kaçırılan her örnek duyarlılığı (Recall) %16.67 düşürmekte olup testte yakalanan 2 örnek neticesinde recall %33.33 olarak gerçekleşmiştir. Infiltration gibi hedefli sızma saldırılarının ağ akış seviyesinde tespiti için ek ana bilgisayar (host-based) telemetrisine ihtiyaç vardır.

### 2.3 Gözetimsiz Modelin Performans Tavanı
- Isolation Forest'ın elde ettiği F1 skoru (%52.36) ve ROC-AUC (%73.35), gözetimli modelin (%93.74) gerisindedir. Gözetimsiz modellerin genel doğası gereği, karmaşık meşru trafik desenlerini %100 doğrulukla izole etmek mümkün değildir. Bu nedenle model tek başına değil, hibrit sentezin bir bileşeni olarak konumlandırılmıştır.

### 2.4 Harici İstihbarat Servis Bağımlılığı
- Harici Tehdit İstihbaratı sağlayıcıları (AbuseIPDB, VirusTotal), üçüncü taraf API kotası (günlük istek sınırları), ağ gecikmesi ve servis erişilebilirliği ile sınırlıdır. Bu kısıt, 24 saatlik Redis önbelleği ve SSRF koruması ile hafifletilmiştir.

### 2.5 Donanım ve Tek İşçi (Single-Worker) Verimi
- Geliştirme ortamında çalışan tek iş parçacıklı Python ML Worker yaklaşık saniyede 57 akış işlemektedir. Kurumsal gigabit omurga hatlarındaki (10 Gbps+) milyonlarca eşzamanlı akış için Kubernetes üzerinde çoklu worker kümelemesi (horizontal autoscaling) gereklidir.

### 2.6 Aktif Savunma ve Gerçek Dış Saldırı İddiası Yasağı
- NetSentry AI, akademik etik kuralları ve yasal çerçeveler gereği internet üzerinden gerçek kurumlara saldırı yapmaz veya canlı saldırı trafiği simüle ediyormuş gibi sahte iddialarda bulunmaz. Tüm testler doğrulanmış CIC-IDS2017 akışlarının kontrollü yeniden oynatımı ile gerçekleştirilmiştir.

---

## 3. Gelecek Çalışmalar
1. **Şifreli Trafik Analizi:** Paket yükü yerine yalnızca paket boyutu ve varış aralıklarına dayalı derin öğrenme modelleri (CNN / Transformer tabanlı NIDS).
2. **Aktif Ağ Engelleme (IPS Entegrasyonu):** Kritik olaylarda Linux `iptables` / eBPF düzeyinde otomatik paket düşürme politikası.
3. **Uçtan Uca STIX/TAXII Entegrasyonu:** Tehdit istihbaratını standart açık formatlarda otomatik paylaşma kabiliyeti.
