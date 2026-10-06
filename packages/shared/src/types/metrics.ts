export interface ClassMetric {
  className: string;
  precision: number;
  recall: number;
  f1Score: number;
  support: number;
}

export interface ModelEvaluationReport {
  modelVersion: string;
  datasetName: string;
  datasetVersion: string;
  evaluationDate: string;
  overallAccuracy: number;
  macroF1: number;
  weightedF1: number;
  rocAucMacro?: number;
  classMetrics: ClassMetric[];
  confusionMatrix: {
    labels: string[];
    matrix: number[][];
  };
  trainSamplesCount: number;
  testSamplesCount: number;
}
