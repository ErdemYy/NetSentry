# BİTİRME TEZİ SAVUNMA KONTROL LİSTESİ (DEFENSE_CHECKLIST.md)

Bu kontrol listesi, NetSentry AI bitirme projesi jüri sunumu ve canlı savunması öncesinde eksiksiz operasyonel hazırlık sağlamak amacıyla hazırlanmıştır.

---

## 1. Donanım ve Çalışma Ortamı Hazırlığı (T-30 Dakika)

- [ ] **Dizüstü Bilgisayar & Güç:** Şarj adaptörü takılı, yüksek performans güç modunda.
- [ ] **Ekran Paylaşımı & Çözünürlük:** 1920x1080 (Full HD) çözünürlük ayarlandı, tarayıcı yakınlaştırması %100.
- [ ] **Bildirimler:** İşletim sistemi bildirimleri ("Odaklanma Yardımı / Rahatsız Etmeyin") aktif.
- [ ] **İnternet Bağlantısı:** Wi-Fi veya Ethernet bağlı. (Dış tehdit istihbaratı AbuseIPDB sorgusu için internet varsa kullanılır, yoksa sistem `NOT_CONFIGURED`/`UNAVAILABLE` ile zarifçe çalışır).

---

## 2. Servislerin Başlatılması ve Doğrulanması (T-15 Dakika)

### Birincil Seçenek: Otomatikleştirilmiş Jüri Harness'ı (Tek Komut)
Tüm ortamı doğrulamak, servisleri ayağa kaldırmak ve sıfır sızıntılı test akışını çalıştırmak için:
```powershell
.\tools\final-demo.ps1 -Mode Replay -OpenBrowser
```
- [ ] 8 aşamanın tamamı yeşil (`PASS`) sonuçlandı.
- [ ] `reports/final-demo/latest.json` ve `latest.md` oluşturuldu.

### İkincil / Modüler Başlatma Yöntemi:
Servisleri ayrı terminallerde incelemek için:
- **Veri Tabanı & Redis:** `docker compose up -d postgres redis`
- **Core API:** `npm run start --prefix apps/api` (`http://localhost:3001/api/v1/health/detailed` -> 200)
- **ML Servisi:** `cd apps/ml; .venv/Scripts/python -m app.streaming.worker`
- **SOC Web:** `npm run start --prefix apps/web` (`http://localhost:3000`)
- [ ] Üst çubukta `API ●`, `ML ENGINE ●`, `REDIS ●`, `DATABASE ●` ve `LIVE ●` yeşil.

---

## 3. Kimlik Doğrulama Bilgileri (Credentials)

- [ ] **Admin Hesabı:** `admin@netsentry.ai`
  - Parola: Çevre değişkeninde (`ADMIN_INITIAL_PASSWORD`) tanımlı yönetici şifresi.
- [ ] **Analist Hesabı:** `analyst@netsentry.ai`
  - Parola: Çevre değişkeninde (`ANALYST_INITIAL_PASSWORD`) tanımlı analist şifresi.
- [ ] **Giriş Doğrulaması:** Sağ üstteki kilit ikonundan giriş yapıldı ve oturum çerezi (`netsentry_session`) alındı.

---

## 4. Canlı Demo Öncesi Temizlik (State Reset)

- [ ] Yönetici olarak `/settings` sayfasına gidildi.
- [ ] **"RESET DEMO STATE"** butonuna basılarak önceki testlerden kalan geçici akışlar ve alarmlar temizlendi. (Denetim günlüğü ve temel kullanıcılar korunur).
- [ ] Ana sayfada (`/`) göstergelerin temiz olduğu doğrulandı.

---

## 5. Canlı Demo Yürütme Sıralaması (Sunum Sırasında)

| Sıra | Aksiyon | Komut / Ekran | Beklenen Sonuç |
|---|---|---|---|
| **1** | Giriş | `http://localhost:3000` | Admin oturumu açıldı, boş ve temiz aktivite akışı |
| **2** | Sistem Sağlığı | Üst Bar | 4 servisin yeşil yandığı jüriye gösterildi |
| **3** | Replay Başlatma | `python -m app.streaming.replay --mode MIXED --rate 5 --max 5` | Terminal komutu jüriye açıklandı |
| **4** | Canlı Akış | `/` Dashboard | Sayfa yenilenmeden 5 akışın listeye aktığı görüldü |
| **5** | Olay İnceleme | `/incidents` | Yüksek riskli akışın (DDoS/PortScan) olaya dönüştüğü gösterildi |
| **6** | Tehdit Detayı | `/threats/[id]` | Telemetri tablosu, LightGBM ve Isolation Forest ayrımı gösterildi |
| **7** | **TreeSHAP** | "WHY DID THE MODEL FLAG THIS?" | Pozitif ve negatif Shapley katkı barları jüriye izah edildi |
| **8** | Tehdit İstihbaratı | AbuseIPDB Kartı | SSRF filtrelemesi ve önbellek mekanizması aktarıldı |
| **9** | Olay Yönetimi | `/incidents/[id]` | Durum `INVESTIGATING` ve `RESOLVED` olarak güncellendi |
| **10** | Model İncelemesi | `/models` | EXP-001 test metrikleri ile Çalışma Zamanı SHA-256 ayrımı vurgulandı |
| **11** | Denetim İzi | `/settings` | Yapılan tüm eylemlerin audit log tablosunda yer aldığı gösterildi |

---

## 6. Acil Durum / Yedek Planı (Fallback Procedures)

### Senaryo A: Port Çakışması veya Servis Kapanması
- Çözüm: Terminalde ilgili servisi yeniden başlat:
  - API: `node apps/api/dist/main`
  - ML: `apps/ml/.venv/Scripts/python -m app.streaming.worker`
  - Web: `apps/web/node_modules/.bin/next start apps/web -p 3000`

### Senaryo B: Redis Kuyruğu Kilitlenirse
- Çözüm: Docker konteynerini yeniden başlat:
  ```bash
  docker restart netsentry-redis
  ```

### Senaryo C: Dış İnternet Kesilirse
- Çözüm: Jüriye sistemin non-blocking yapısını açıkla: "Harici tehdit istihbaratı internet bağlantısı olmadığında `UNAVAILABLE` durumuna geçer, ancak yerel ML çıkarımı ve SHAP motoru tamamen yerel çalıştığı için tespitlerimiz sıfır gecikmeyle devam eder."
