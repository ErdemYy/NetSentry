import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ModelsService {
  private benchmarkData: any = null;
  private metadata: any = null;

  constructor() {
    this.loadArtifacts();
  }

  private loadArtifacts() {
    try {
      const benchmarkPath = path.resolve(__dirname, '../../../../ml/reports/phase2_benchmark.json');
      if (fs.existsSync(benchmarkPath)) {
        this.benchmarkData = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));
      }
    } catch {
      this.benchmarkData = null;
    }

    try {
      const metadataPath = path.resolve(__dirname, '../../../../ml/models/metadata.json');
      if (fs.existsSync(metadataPath)) {
        this.metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      }
    } catch {
      this.metadata = null;
    }
  }

  getModelMetrics() {
    return {
      supervised: {
        modelName: 'LightGBM Multi-Class Classifier',
        algorithm: 'LightGBM (Gradient Boosted Trees)',
        version: this.metadata?.model_version || '1.0.0',
        dataset: 'CIC-IDS2017 Cleaned Dataset',
        samplesTrained: 239199,
        samplesTested: 51257,
        featureCount: this.metadata?.feature_count || 77,
        classesCount: 9,
        metrics: {
          accuracy: 0.9985,
          macroPrecision: 0.9878,
          macroRecall: 0.9245,
          macroF1: 0.9374,
          weightedF1: 0.9985,
        },
        classBreakdown: [
          { className: 'BENIGN', precision: 0.9998, recall: 0.9983, f1: 0.9990, support: 35764 },
          { className: 'DDoS', precision: 0.9993, recall: 1.0000, f1: 0.9997, support: 4500 },
          { className: 'PortScan', precision: 0.9958, recall: 0.9991, f1: 0.9975, support: 4500 },
          { className: 'DoS', precision: 0.9976, recall: 0.9996, f1: 0.9986, support: 4500 },
          { className: 'BruteForce', precision: 1.0000, recall: 1.0000, f1: 1.0000, support: 1373 },
          { className: 'WebAttack', precision: 1.0000, recall: 0.9938, f1: 0.9969, support: 321 },
          { className: 'Botnet', precision: 0.8982, recall: 0.9966, f1: 0.9448, support: 292 },
          { className: 'Infiltration', precision: 1.0000, recall: 0.3333, f1: 0.5000, support: 6 },
          { className: 'Heartbleed', precision: 1.0000, recall: 1.0000, f1: 1.0000, support: 1 },
        ],
      },
      unsupervised: {
        modelName: 'Isolation Forest Anomaly Baseline',
        algorithm: 'Isolation Forest (Ensemble Outlier Detection)',
        version: '1.0.0',
        trainingBaseline: 'Pure Benign Traffic (166,899 flows)',
        optimalThresholdTau: this.metadata?.anomaly_threshold || 0.4954,
        metrics: {
          precision: 0.6565,
          recall: 0.4354,
          f1: 0.5236,
          rocAuc: 0.7335,
          falsePositiveRate: 0.0987,
        },
      },
      explainability: {
        method: 'TreeSHAP (TreeExplainer)',
        scope: 'Local & Global Feature Attribution',
        featureCount: 77,
        meanAttributionLatencyMs: this.benchmarkData?.latency_profile_ms?.shap_explanation?.mean_ms || 6.794,
        topGlobalFeatures: [
          'destination_port',
          'bwd_packet_length_min',
          'flow_packets_per_sec',
          'min_seg_size_fwd',
          'psh_flag_count',
          'fwd_iat_min',
        ],
      },
      latencyBenchmark: this.benchmarkData?.latency_profile_ms || {
        total_with_shap: { mean_ms: 24.865, p50_ms: 23.401, p95_ms: 31.645, p99_ms: 64.169 },
        total_without_shap: { mean_ms: 20.260, p50_ms: 19.649, p95_ms: 26.680, p99_ms: 40.399 },
        shap_explanation: { mean_ms: 6.794, p50_ms: 6.338, p95_ms: 8.561 },
        supervised_prediction: { mean_ms: 2.616, p50_ms: 2.192, p95_ms: 3.785 },
        anomaly_scoring: { mean_ms: 12.879, p50_ms: 12.016, p95_ms: 17.246 },
        preprocessing_scaling: { mean_ms: 2.163, p50_ms: 1.981, p95_ms: 2.895 },
      },
      comparison: [
        { metric: 'Precision', supervised: '98.78%', unsupervised: '65.65%', role: 'Supervised minimizes false alarms on known vectors' },
        { metric: 'Recall', supervised: '92.45%', unsupervised: '43.54%', role: 'Supervised captures recognized threat taxonomy' },
        { metric: 'Macro F1', supervised: '93.74%', unsupervised: '52.36%', role: 'Supervised leads on classified categories' },
        { metric: 'ROC-AUC', supervised: '—', unsupervised: '73.35%', role: 'Unsupervised flags zero-day deviations without labels' },
        { metric: 'FPR', supervised: '0.15%', unsupervised: '9.87%', role: 'Unsupervised trades higher FPR for novelty detection' },
      ],
    };
  }
}
