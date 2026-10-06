# BÖLÜM 8: GÜVENLİK MİMARİSİ VE SIKILAŞTIRMA (SECURITY_ARCHITECTURE.md)

## 1. Güvenlik Tasarım Felsefesi
Bir siber güvenlik ürünü, doğası gereği en yüksek güvenlik standartlarını kendi bünyesinde barındırmalıdır. NetSentry AI; sıfır güven (Zero-Trust) ilkelerine, savunma derinliği (defense-in-depth) stratejisine ve en az ayrıcalık (least privilege) kuralına uygun olarak sıkılaştırılmıştır.

---

## 2. Kimlik Doğrulama ve Oturum Yönetimi
- **Mekanizma:** JSON Web Token (JWT) + Güvenli HTTP-Only Cookie (`netsentry_token`).
- **Neden HTTP-Only Cookie?** Token'ın tarayıcının `localStorage` veya `sessionStorage` alanında saklanması, istemci tarafındaki olası Siteler Arası Betik Çalıştırma (XSS) saldırılarında çalınmasına yol açar. HTTP-only bayrağı, JavaScript'in token'a doğrudan erişmesini engelleyerek XSS riskini bertaraf eder.
- **Parola Güvenliği:** Parolalar veritabanında asla düz metin (plain text) olarak saklanmaz. Endüstri standardı **bcrypt** (salt turları: 10) ile tek yönlü olarak hash'lenir.
- **Oturum Süresi:** 24 saat geçerlilik süresi.

---

## 3. Rol Tabanlı Erişim Kontrolü (RBAC)
Sistemde backend muhafızları (`RolesGuard`, `JwtAuthGuard`) tarafından denetlenen iki operasyonel rol tanımlanmıştır:

| Yetki / Eylem | ANALYST (Analist) | ADMIN (Yönetici) |
| :--- | :---: | :---: |
| Canlı Tehditleri Görüntüleme (`/threats`) |  İzinli |  İzinli |
| SHAP Açıklamalarını İnceleme (`/threats/:id`) |  İzinli |  İzinli |
| Olayları İnceleme ve Durum Güncelleme (`/incidents`) |  İzinli |  İzinli |
| Ağ ve Analitik Grafikleri Görüntüleme |  İzinli |  İzinli |
| Model Akademik Metriklerini Görüntüleme |  İzinli |  İzinli |
| Tehdit İstihbaratı Sorgulama |  İzinli |  İzinli |
| Güvenlik Denetim Günlüklerine Erişim (`/api/v1/audit/logs`) |  YASAK (403) |  İzinli |
| Sistem Konfigürasyonu Değiştirme |  YASAK (403) |  İzinli |
| Jüri Demo Durumunu Sıfırlama (`/api/v1/demo/reset`) |  YASAK (403) |  İzinli |

Yetkilendirme yalnızca arayüzdeki butonları gizleyerek değil; NestJS `@Roles('ADMIN')` reflektörleri ve HTTP 403 Forbidden kontrolleriyle API seviyesinde zorunlu kılınmıştır.

---

## 4. API Güvenliği, Hız Sınırlama ve Başlıklar
1. **Hız Sınırlama (Rate Limiting):** `@nestjs/throttler` ile hassas uç noktalarda (Kimlik doğrulama, tahmin, harici sorgular) IP başına dakikada maksimum istek sınırları uygulanmıştır.
2. **Güvenlik Başlıkları (Helmet):** `X-Frame-Options` (Clickjacking önleme), `X-Content-Type-Options: nosniff` (MIME sniffing önleme) ve HSTS yapılandırılmıştır.
3. **Yapılandırılmış Hata Yönetimi (GlobalExceptionFilter):** Üretim ortamında ham SQL sorgu hataları, dosya sistemi yolları veya yığın izleri (stack traces) asla istemciye dönülmez; standart ve sızıntısız bir JSON yanıtı üretilir.

---

## 5. Güvenlik Denetim Günlüğü (Audit Trail)
Sistemdeki tüm kritik operasyonlar `AuditLog` tablosuna kalıcı olarak yazılır:
- `AUTH_LOGIN_SUCCESS` / `AUTH_LOGIN_FAILURE` / `AUTH_LOGOUT`
- `INCIDENT_STATUS_CHANGE` (Önceki ve yeni durum, işlem yapan analist)
- `THREAT_INTEL_LOOKUP` (Sorgulanan IP, sağlayıcı, skor)
- `DEMO_RESET` (Sıfırlama zamanı ve temizlenen tablolar)
- İstemci IP adresi ve işlem ayrıntıları eksiksiz kayıt altına alınır.

---

## 6. Model Bütünlüğü ve Şema Koruması
- **SHA-256 Doğrulaması:** Başlatma sırasında 5 model dosyasının (`supervised_lightgbm.joblib`, `isolation_forest.joblib`, vb.) kriptografik hash'leri kontrol edilir. Değiştirilmiş veya bozulmuş dosya tespit edildiğinde sistem başlatılmayıp `MODEL INTEGRITY CHECK FAILED` hatası üretir.
- **Şema Versiyonlama:** `feature-schema-v1` sözleşmesi ile modelin beklediği 77 öznitelik katı şekilde denetlenir.
