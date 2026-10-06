# BÖLÜM 5: MAKİNE ÖĞRENMESİ METODOLOJİSİ (MACHINE_LEARNING_METHODOLOGY.md)

## 1. Hibrit Yapay Zeka Tasarım Felsefesi
Siber güvenlik operasyonlarında tek bir model paradigması tüm gereksinimleri karşılayamaz. NetSentry AI, iki bağımsız yapay zeka modelinin güçlü yönlerini birleştiren **Çift Katmanlı Hibrit Mimari** geliştirmiştir:

1. **Gözetimli Model (LightGBM):** Bilinen saldırı türlerinin taksonomik sınıflandırması ve yüksek güvenilirlik.
2. **Gözetimsiz Model (Isolation Forest):** Bilinmeyen/sıfırıncı gün trafik anomalilerinin tespiti.
3. **Deterministik Hibrit Karar Sentezi:** İki modelin çıktısını tutarlı bir operasyonel karara dönüştüren kural motoru.
4. **TreeSHAP:** Her kararın altında yatan matematiksel nedenleri analiste açıklayan yorumlanabilirlik motoru.

---

## 2. Gözetimli Saldırı Sınıflandırıcı: LightGBM
LightGBM (Light Gradient Boosting Machine), histogram tabanlı karar ağaçları ve yaprak bazlı (leaf-wise) büyüme stratejisi sayesinde hem çok düşük çıkarım gecikmesine (ortalama 2.6 ms) hem de yüksek doğruluğa sahiptir.

### Model Parametreleri ve Konfigürasyonu
- `objective`: `multiclass` (num_class: 9)
- `boosting_type`: `gbdt` (Gradient Boosted Decision Trees)
- `n_estimators`: 200
- `learning_rate`: 0.05
- `num_leaves`: 63
- `class_weight`: `balanced` (Azınlık saldırı vektörlerine daha yüksek ceza katsayısı)

---

## 3. Gözetimsiz Anomali Dedektörü: Isolation Forest
Gözetimsiz model, **yalnızca temiz (BENIGN) eğitim verisi üzerinde** eğitilmiştir. Model, meşru ağ trafiğinin istatistiksel taban çizgisini (baseline) öğrenir.

Bir $x$ akışı için normallikten sapma anomali skoru şu formülle hesaplanır:
$$s(x) = -\text{score\_samples}(x)$$

Bu formülasyon ile normallik 0.0'a yaklaşırken, anomali 1.0'a doğru yükselir.

### Metodolojik Karar Eşiği Belirleme ($\tau^*$)
Akademik savunulabilirlik için karar eşiği rastgele seçilmemiştir. Eşik taraması (threshold sweep), **Doğrulama (Validation) kümesindeki 51.257 akış** üzerinde 40 farklı yüzdelik dilim test edilerek gerçekleştirilmiştir:
- Doğrulama kümesindeki F1 skorunu maksimize eden ve Yanlış Pozitif Oranını (FPR) %10 altında tutan optimal eşik değeri:
$$\tau^* = 0.49540$$
olarak tespit edilmiştir. Test kümesi asla eşik belirleme sürecine dahil edilmemiştir.

---

## 4. Deterministik Hibrit Karar Matrisi
İki modelin çıktıları aşağıdaki kurallara göre sentezlenir:

| Gözetimli Sınıflandırma ($C$) | Model Güveni ($P$) | Anomali Skoru ($s(x)$) | Nihai Tehdit Kararı (Verdict) | Önem Derecesi (Severity) |
| :--- | :--- | :--- | :--- | :--- |
| `BENIGN` | Herhangi | $s(x) < \tau^*$ (Normal) | **NORMAL** | `LOW` |
| `BENIGN` | Herhangi | $s(x) \ge \tau^*$ (Anomalous) | **UNKNOWN_ANOMALOUS** | `MEDIUM` |
| Saldırı Sınıfı | $P \ge 0.80$ | $s(x) \ge \tau^*$ (Anomalous) | **HIGH_RISK** | `CRITICAL` / `HIGH` |
| Saldırı Sınıfı | $P \ge 0.80$ | $s(x) < \tau^*$ (Normal) | **KNOWN_ATTACK** | `HIGH` / `MEDIUM` |
| Saldırı Sınıfı | $P < 0.80$ | Herhangi | **ANOMALOUS** | `MEDIUM` |

Bu sentez sayesinde:
- Sistem, tanıdığı bir saldırıyı yüksek güven ve anomali teyidiyle görürse `HIGH_RISK` üretir.
- Normal etiketli ancak istatistiksel olarak aşırı sapan bir sıfırıncı gün akışı gelirse `UNKNOWN_ANOMALOUS` ile analisti uyarır.

---

## 5. Açıklanabilir Yapay Zeka: TreeSHAP
Ağaç tabanlı modeller için oyun teorisindeki Shapley değerlerini tam olarak hesaplayan **TreeSHAP** algoritması kullanılmıştır.

Her $i$ özniteliği için hesaplanan marjinal katkı $\phi_i(x)$:
- $\phi_i(x) > 0$: İlgili öznitelik riski artırmış (`INCREASED RISK`), modeli saldırı sınıfına doğru itmiştir.
- $\phi_i(x) < 0$: İlgili öznitelik riski azaltmış (`DECREASED RISK`), akışın meşru profile yakın olduğunu göstermiştir.

En yüksek mutlak değere sahip ilk 5 öznitelik sıralanarak ve risk yönü etiketlenerek analiste sunulur:
Örnek:
- `min_seg_size_fwd` (+3.0437) $\rightarrow$ Artan Risk
- `init_win_bytes_bwd` (+2.0940) $\rightarrow$ Artan Risk
- `destination_port` (-0.6859) $\rightarrow$ Azalan Risk
