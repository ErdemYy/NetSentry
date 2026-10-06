# ÖZET VE ABSTRACT (ABSTRACT.md)

## Türkçe Özet
Bu bitirme çalışmasında, modern bilgisayar ağlarındaki yüksek hacimli ve karmaşık siber saldırıları gerçek zamanlı olarak tespit edebilmek, sınıflandırmak ve açıklamak amacıyla geliştirilen **NetSentry AI: Yapay Zeka Destekli Dağıtık Ağ Trafiği Anomali Tespiti ve Gerçek Zamanlı Tehdit İstihbarat Platformu** sunulmaktadır. Geleneksel imza tabanlı Saldırı Tespit Sistemleri (NIDS), sıfırıncı gün (zero-day) açıklarını ve bilinmeyen anormal trafik kalıplarını yakalamakta yetersiz kalırken; salt gözetimli makine öğrenmesi modelleri bilinmeyen saldırılarda yüksek güvenle yanlış kararlar verebilmekte, gözetimsiz modeller ise yüksek yanlış pozitif (false positive) oranlarına yol açmaktadır. 

Bu kısıtları aşmak üzere NetSentry AI, çift katmanlı hibrit bir yapay zeka mimarisi üzerine inşa edilmiştir:
1. **Gözetimli Model (LightGBM):** Tanımlı 9 saldırı sınıfını (DDoS, DoS, PortScan, BruteForce, Botnet, Infiltration, WebAttack, Heartbleed ve BENIGN) %99.85 doğruluk (accuracy), %98.78 makro kesinlik (macro precision) ve %93.74 makro F1 skoruyla sınıflandırmaktadır.
2. **Gözetimsiz Model (Isolation Forest):** Temiz trafik taban çizgisi (baseline) üzerinden eğitilmiş olup, $\tau^* = 0.49540$ metodolojik karar eşiği ile bilinmeyen ve istatistiksel olarak sapan anomali kalıplarını (%73.35 ROC-AUC) tespit etmektedir.
3. **Açıklanabilir Yapay Zeka (TreeSHAP):** "Kara kutu" (black-box) ikilemini ortadan kaldırarak her bir tespit için 77 ağ özniteliğinin marjinal Shapley katkılarını ve risk yönlerini hesaplamaktadır.

Sistem, CIC-IDS2017 veri setinden temizlenmiş 341.713 akışı Redis Streams üzerinden asenkron olarak tüketmekte; NestJS Core API, PostgreSQL kalıcılığı ve Socket.IO aracılığıyla milisaniyeler mertebesinde (ortalama 27.04 ms) Erdem Tasarım Sistemi ilkelerine uygun, kesinlikle sahte/mock veri barındırmayan modern bir SOC (Security Operations Center) arayüzüne iletmektedir. Sistem ayrıca JWT/HTTP-only cookie tabanlı kimlik doğrulama, Rol Tabanlı Erişim Kontrolü (RBAC), SSRF korumalı harici Tehdit İstihbaratı (AbuseIPDB) soyutlaması ve SHA-256 model bütünlük doğrulaması ile sıkılaştırılmıştır.

---

## English Abstract
This graduation thesis presents **NetSentry AI: An AI-Powered Distributed Network Traffic Anomaly Detection and Real-Time Threat Intelligence Platform**, developed to detect, classify, and explain high-throughput cyber threats in real time. Traditional signature-based Network Intrusion Detection Systems (NIDS) fail to identify zero-day vulnerabilities, while purely supervised models suffer from overconfident misclassifications on unseen variants, and unsupervised anomaly detectors typically produce unacceptable false positive rates.

To address these limitations, NetSentry AI implements a scientifically validated hybrid AI pipeline:
1. **Supervised Classifier (LightGBM):** Classifies 9 canonical traffic categories with 99.85% accuracy, 98.78% macro precision, and 93.74% macro F1 score.
2. **Unsupervised Anomaly Detector (Isolation Forest):** Calibrated on pure benign traffic with an empirically swept threshold $\tau^* = 0.49540$, achieving 73.35% ROC-AUC for structural anomaly discovery.
3. **eXplainable Artificial Intelligence (TreeSHAP):** Resolves the black-box dilemma by calculating exact marginal Shapley feature attributions and risk directions across all 77 flow features.

The distributed streaming pipeline ingests authentic flows from the CIC-IDS2017 benchmark dataset via Redis Streams, evaluates them in a stateful Python ML Worker, and delivers alerts to an idempotent NestJS orchestrator, PostgreSQL repository, and real-time Socket.IO SOC Dashboard with an average inference latency of 27.04 ms. The system is hardened using JWT/HTTP-only authentication, Role-Based Access Control (RBAC), SSRF-guarded external Threat Intelligence enrichment (AbuseIPDB), and cryptographic SHA-256 model integrity validation, fully adhering to a strict Zero-Mock operational policy.
