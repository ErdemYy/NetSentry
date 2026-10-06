import { NetworkFlow } from './flow.js';
import { DetectionResult } from './detection.js';
import { SecurityIncident } from './incident.js';

export interface ThreatFeedEvent {
  eventId: string;
  timestamp: string;
  flow: NetworkFlow;
  detection: DetectionResult;
}

export interface IncidentUpdatedEvent {
  incident: SecurityIncident;
  updatedBy: string;
}

export interface MetricSnapshotEvent {
  timestamp: string;
  eventsPerSecond: number;
  threatsPerSecond: number;
  activeIncidentsCount: number;
  anomalyRate: number;
}
