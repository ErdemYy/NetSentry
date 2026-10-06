# BÖLÜM 7: TEHDİT İSTİHBARATI VE SSRF GÜVENLİĞİ (THREAT_INTELLIGENCE.md)

## 1. Tehdit İstihbaratı Entegrasyon Prensibi
Modern siber operasyonlarda, yerel ağda tespit edilen bir saldırgan IP adresinin global itibarının (reputation) bilinmesi, saldırının bir botnet düğümü mü yoksa bilinen bir kötü amaçlı tarayıcı mı olduğunu anlamada kritik bir zenginleştirme (enrichment) sağlar.

Ancak temel mimari prensip:
> **"Harici Tehdit İstihbaratı bir Zenginleştirmedir (Augmentation); Yerel Tespitin Bağımlılığı Değildir."**

Harici servis (örn. AbuseIPDB veya VirusTotal) kapalı, erişilemez veya kota aşımına uğramış olsa dahi, NetSentry AI'ın çekirdek LightGBM + Isolation Forest + TreeSHAP tespit hattı kesintisiz çalışmaya devam eder.

---

## 2. SSRF (Server-Side Request Forgery) Koruması
Kullanıcı veya ağ akışından gelen herhangi bir IP adresini sorgusuz sualsiz dış servislere göndermek ciddi bir SSRF açığı yaratır. Bir saldırgan, sistemin iç ağdaki hassas kaynaklarını (örn. `127.0.0.1`, `10.0.0.1`, bulut meta-veri uç noktası `169.254.169.254`) harici servisler üzerinden araştırmaya zorlayabilir.

NetSentry AI, `SsrfValidator` bileşeni ile dış istek yapılmadan önce IP adreslerini denetler:
- `127.0.0.0/8` (Yerel döngü - Loopback)
- `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (RFC 1918 Özel Ağ Aralıkları)
- `169.254.0.0/16` (Link-local)
- `100.64.0.0/10` (Carrier-grade NAT)
- `::1`, `fe80::/10`, `fc00::/7` (IPv6 yerel adresler)
- `localhost`, `metadata.google.internal` gibi iç alan adları

Bu aralıklara düşen tüm sorgular dış ağa çıkmadan durdurulur ve derhal `INVALID_TARGET` durumu ile yanıtlanır.

---

## 3. Sağlayıcı Soyutlaması (Provider Abstraction)
Sistem, `IThreatIntelProvider` arayüzü ile sağlayıcıdan bağımsız (vendor-agnostic) çalışır:

```typescript
export interface IThreatIntelProvider {
  readonly name: 'ABUSEIPDB' | 'VIRUSTOTAL';
  isConfigured(): boolean;
  lookupIp(ip: string): Promise<ThreatIntelReport>;
}
```

### AbuseIPDB Entegrasyonu (API v2)
- **Uç Nokta:** `https://api.abuseipdb.com/api/v2/check`
- **Parametreler:** `maxAgeInDays=90`, `verbose=true`
- **Zaman Aşımı:** 4000 ms (AbortController ile katı kural).
- **Dürüst Hata ve Durum Yönetimi:**
  - API anahtarı yoksa: `NOT_CONFIGURED`
  - Günlük sorgu kotası dolduysa (HTTP 429): `RATE_LIMITED`
  - Dış servis çöktüyse (HTTP 5xx / Timeout): `UNAVAILABLE`
  - Başarılıysa: `AVAILABLE` (Kötüye kullanım güven skoru, ülke kodu, ISS, toplam şikayet sayısı)

---

## 4. İki Kademeli Önbellekleme (Redis Cache)
Her akış tespitinde dış servislere tekrar tekrar istek yapmak kotaların hızla tükenmesine yol açar:
- **Önbellek Anahtarı:** `netsentry:threatintel:<provider>:<indicator>`
- **TTL (Time-To-Live):**
  - Başarılı yanıtlar: **24 saat (86.400 sn)**
  - Hata/Kota aşımları: **1 saat (3.600 sn)**
- **Veri Kökeni (Provenance):** Önbellekten dönen yanıtlarda `cached: true` meta-verisi saklanır, analist bilginin taze sorgu mu yoksa önbellek mi olduğunu net biçimde görür.
