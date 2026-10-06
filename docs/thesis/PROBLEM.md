# BÖLÜM 1: PROBLEM TANIMI VE MOTİVASYON (PROBLEM.md)

## 1. Giriş ve Sektörel Arka Plan
Günümüz kurumsal ağları, bulut bilişim, mikroservis mimarileri ve Nesnelerin İnterneti (IoT) cihazlarının yaygınlaşmasıyla birlikte benzeri görülmemiş hacim ve karmaşıklıkta veri trafiğine maruz kalmaktadır. Bu yüksek hacimli trafik akışı içerisinde gelişmiş kalıcı tehditler (APT - Advanced Persistent Threats), dağıtık hizmet engelleme saldırıları (DDoS), port taramaları (PortScan) ve kaba kuvvet (BruteForce) denemeleri gibi kötü niyetli hareketlerin tespit edilmesi kritik bir gerekliliktir.

## 2. Geleneksel Çözümlerin Temel Kısıtları

### 2.1 İmza Tabanlı NIDS Kısıtları
Snort, Suricata ve benzeri kural tabanlı sistemler yalnızca önceden bilinen ve imza veritabanında tanımlanmış saldırı desenlerini yakalayabilir:
- **Sıfırıncı Gün Savunmasızlığı:** Yeni türeyen veya polimorfik tekniklerle değiştirilen saldırılar imzalarla eşleşmez.
- **Yüksek Bakım Maliyeti:** Her yeni saldırı varyantı için uzman analistlerce manuel kural yazılması gerekir.
- **Yüksek Trafik Altında Tıkanma:** Derin paket incelemesi (DPI - Deep Packet Inspection), gigabit hızlarındaki hatlarda paket düşürmelerine yol açar.

### 2.2 Salt Gözetimli Yapay Zeka Modellerinin Çıkmazı
Gözetimli makine öğrenmesi (Supervised Learning) modelleri, bilinen saldırı sınıfları üzerinde yüksek doğruluk elde edebilse de:
- **Aşırı Güvenli Yanlış Teşhis (Overconfident Misclassification):** Model daha önce hiç görmediği sıfırıncı gün bir saldırı akışı ile karşılaştığında, eğitim kümesindeki sınıflardan birine (çoğu zaman çoğunluk sınıfı olan BENIGN veya rastgele bir sınıfa) %99 güvenle yanlış atama yapabilir.
- **Veri Sızıntısı (Data Leakage) Yanılsaması:** Literatürdeki birçok çalışma, IP ve port numaralarını modele besleyerek yapay olarak %100 doğruluk elde etmekte; ancak model yeni bir IP aralığına taşındığında tamamen başarısız olmaktadır.

### 2.3 Salt Gözetimsiz Anomali Tespiti Çıkmazı
Isolation Forest, One-Class SVM veya Autoencoder gibi modeller yalnızca normallikten sapmaları arar:
- **Yüksek Yanlış Alarm Oranı (High False Positive Rate):** Olağan dışı ancak meşru olan büyük dosya transferleri, yedekleme işlemleri veya yoğun yazılım güncellemeleri doğrudan "saldırı" olarak işaretlenir.
- **Saldırı Tipi Belirsizliği:** Model akışın anormal olduğunu söyler ancak saldırının DDoS mu, BruteForce mu yoksa PortScan mi olduğunu belirtemez.

### 2.4 Kara Kutu (Black-Box) ve Açıklanabilirlik Eksikliği
Derin öğrenme ve karmaşık ağaç toplulukları (ensemble models), SOC analistine yalnızca bir olasılık puanı verir. Analist şu kritik soruya yanıt bulamaz:
> *"Yapay zeka modeli bu meşru görünen akışı neden 'CRITICAL DDoS' olarak işaretledi? Hangi öznitelik veya bayrak bu karara yol açtı?"*

Açıklanabilirlik (Explainability) eksikliği, güvenlik operasyonlarında yapay zekaya duyulan güveni temelden sarsmaktadır.

## 3. NetSentry AI Motivasyonu
NetSentry AI, yukarıdaki kısıtları şu temel prensiplerle çözmeyi hedefler:
1. **Gözetimli + Gözetimsiz Hibrit Sentez:** Bilinen tehditleri sınıflandıran bir gözetimli model (LightGBM) ile sıfırıncı gün anomalilerini yakalayan bir gözetimsiz modelin (Isolation Forest) ortak karar mekanizması.
2. **Kriptografik ve Matematiksel Açıklanabilirlik:** TreeSHAP ile her tespitin nedenini şeffaf biçimde analiste sunmak.
3. **Gerçek Zamanlı Dağıtık Akış:** Asenkron Redis Streams ile paket kayıpsız, yüksek verimli mimari.
4. **Kesin Sahte Veri Yasağı (Strict Zero-Mock):** Akademik savunulabilirlik için arayüzde ve backend'de hiçbir sentetik/mock veri kullanmamak.
