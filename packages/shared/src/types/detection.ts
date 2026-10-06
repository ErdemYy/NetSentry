export type AttackCategory =
  | 'BENIGN'
  | 'DOS'
  | 'DDOS'
  | 'PORT_SCAN'
  | 'BRUTE_FORCE'
  | 'WEB_ATTACK'
  | 'BOTNET'
  | 'INFILTRATION'
  | 'UNKNOWN_ANOMALY';

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ThreatVerdict =
  | 'NORMAL'
  | 'KNOWN_ATTACK'
  | 'ANOMALOUS'
  | 'HIGH_RISK'
  | 'UNKNOWN_ANOMALOUS';

export interface ShapFeatureContribution {
  feature: string;
  value: number;
  contribution: number; // positive increases attack probability, negative decreases
  description: string;
}

export interface DetectionResult {
  id: string;
  flowId: string;
  timestamp: string;
  verdict: ThreatVerdict;
  attackCategory: AttackCategory;
  supervisedConfidence: number; // 0.0 - 1.0
  unsupervisedAnomalyScore: number; // e.g. 0.0 - 1.0, distance from normal baseline
  isAnomalous: boolean;
  severity: SeverityLevel;
  topFeatures: ShapFeatureContribution[];
  explanation: string;
  modelVersionSupervised: string;
  modelVersionUnsupervised: string;
}
