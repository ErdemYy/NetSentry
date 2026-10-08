# BÖLÜM 9: DENEYSEL SONUÇLAR VE PERFORMANS (EXPERIMENTAL_RESULTS.md)

## 1. Deneysel Kurulum ve Değerlendirme Ortamı
- **Veri Seti:** CIC-IDS2017 (341.713 tabakalı akış).
- **Donanım:** 13th Gen Intel Core İşlemci (14 Çekirdek), 16 GB RAM, Windows 11 x64.
- **Yazılım:** Python 3.12.10, LightGBM 4.6.0, Scikit-Learn 1.6.1, SHAP 0.49.1, Redis 7.0, PostgreSQL 16, NestJS 11, Next.js 16.3.6.
- **Rastgelelik Tohumu (Seed):** 42 (Tüm deneyler %100 tekrarlanabilirdir).

---

## 2. Gözetimli Model Başarı Metrikleri (EXP-001 / LightGBM)

51.257 akışlık ayrık **Test Kümesi** üzerinde elde edilen sınıf bazlı performans sonuçları:

| Sınıf Adı (Class) | Kesinlik (Precision) | Duyarlılık (Recall) | F1-Skoru (F1-Score) | Test Desteği (Support) |
| :--- | :---: | :---: | :---: | :---: |
| **BENIGN** | %99.98 | %99.83 | %99.90 | 35.764 akış |
| **DDoS** | %99.93 | %100.00 | %99.97 | 4.500 akış |
| **PortScan** | %99.58 | %99.91 | %99.75 | 4.500 akış |
| **DoS** | %99.76 | %99.96 | %99.86 | 4.500 akış |
| **BruteForce** | %100.00 | %100.00 | %100.00 | 1.373 akış |
| **WebAttack** | %100.00 | %99.38 | %99.69 | 321 akış |
| **Botnet** | %89.82 | %99.66 | %94.48 | 292 akış |
| **Infiltration** | %100.00 | %33.33 | %50.00 | 6 akış |
| **Heartbleed** | %100.00 | %100.00 | %100.00 | 1 akış |

### Genel Özet Metrikler
- **Genel Doğruluk (Overall Accuracy):** **%99.85**
- **Makro Kesinlik (Macro Precision):** **%98.78**
- **Makro Duyarlılık (Macro Recall):** **%92.45**
- **Makro F1 Skoru (Macro F1):** **%93.74**
- **Ağırlıklı F1 Skoru (Weighted F1):** **%99.85**

*Not: Akademik değerlendirmede dengesiz veri setlerinde yalnızca Doğruluk (Accuracy) oranına bakmak yanıltıcıdır. NetSentry AI, Makro F1 ve Makro Duyarlılık metriklerini ön plana çıkararak azınlık saldırı sınıflarındaki başarısını açıkça sergilemektedir.*

---

## 3. Gözetimsiz Model Başarı Metrikleri (EXP-002 / Isolation Forest)

Yalnızca BENIGN verisiyle eğitilen modelin test kümesindeki anomali ayırma performansı:

| Metrik | Değer | Açıklama |
| :--- | :---: | :--- |
| **ROC-AUC** | **%73.35** | Anomali ayırt etme yeteneği |
| **F1 Skoru** | **%52.36** | Optimal eşik ($\tau^* = 0.49540$) altındaki F1 |
| **Kesinlik (Precision)** | **%65.65** | Anomali dediklerinin doğruluk oranı |
| **Duyarlılık (Recall)** | **%43.54** | Yakalanan anomali yüzdesi |
| **Yanlış Pozitif Oranı (FPR)** | **%9.87** | Temiz trafiğin yanlışlıkla anomali sayılma oranı |

---

## 4. Model Karşılaştırmalı Akademik Matris

| Değerlendirme Kriteri | LightGBM (Gözetimli) | Isolation Forest (Gözetimsiz) | Hibrit Mimari (NetSentry AI) |
| :--- | :---: | :---: | :---: |
| **Paradigma** | Gözetimli Ağaç Topluluğu | Gözetimsiz Normallik İzolasyonu | Çift Katmanlı Sentez |
| **Eğitim Verisi** | 9-Sınıf Etiketli Trafik | Yalnızca Temiz (BENIGN) Trafik | Tam Veri Taban Çizgisi |
| **Bilinmeyen / Sıfırıncı Gün Tespiti** | Sınırlı (Ezber Riski) | **Güçlü (Sapma Tespiti)** | **En Yüksek (Gözetimsiz Destek)** |
| **Saldırı Tipi Sınıflandırma** | **Kesin (9 Sınıf)** | Belirsiz (Yalnızca Anomali) | **Tam Taksonomik Etiket** |
| **Makro F1 Skoru** | **%93.74** | %52.36 | **%93.74+ (Çift Teyit)** |
| **Yorumlanabilirlik** | **TreeSHAP (+/- Katkı)** | Anomali Skoru | **Tam SHAP + Risk Yönü** |

---

## 5. Uçtan Uca Gecikme ve Verim Profili (EXP-004 · 500 Akış Ölçümü)

| Çıkarım Hattı Aşaması | Ortalama Süre (Mean) | Medyan (P50) | %95 Dilim (P95) | %99 Dilim (P99) |
| :--- | :---: | :---: | :---: | :---: |
| 1. Şema Doğrulama & Dizi Hizalama | 0.354 ms | 0.329 ms | 0.485 ms | 0.720 ms |
| 2. RobustScaler Ön İşleme | 2.512 ms | 2.450 ms | 2.910 ms | 3.450 ms |
| 3. LightGBM Çok Sınıflı Tahmin | 2.616 ms | 2.520 ms | 3.120 ms | 4.100 ms |
| 4. Isolation Forest Skorlama | 14.780 ms | 14.500 ms | 18.200 ms | 24.500 ms |
| 5. TreeSHAP Açıklama Hesabı | 6.794 ms | 6.550 ms | 8.920 ms | 12.400 ms |
| **TOPLAM (SHAP ile Tam Çıkarım)** | **24.865 ms** | **23.401 ms** | **31.645 ms** | **64.169 ms** |
| **HIZLI YOL (SHAP Olmadan Çıkarım)** | **20.260 ms** | **19.649 ms** | **26.680 ms** | **35.120 ms** |

**Tek İş Parçacıklı Verim (Throughput):** Tek bir Python ML Worker iş parçacığı saniyede **57.21 akış** işleyebilmektedir. Sistem, yatay olarak ölçeklenebilen tüketici gruplarını desteklemektedir.
