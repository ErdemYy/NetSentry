import { AttackCategory, SeverityLevel } from './detection.js';

export type IncidentStatus =
  | 'NEW'
  | 'INVESTIGATING'
  | 'CONFIRMED_THREAT'
  | 'FALSE_POSITIVE'
  | 'RESOLVED';

export interface IncidentNote {
  id: string;
  incidentId: string;
  authorId: string;
  authorName: string;
  note: string;
  createdAt: string;
}

export interface SecurityIncident {
  id: string;
  title: string;
  status: IncidentStatus;
  severity: SeverityLevel;
  attackCategory: AttackCategory;
  sourceIp: string;
  destinationIp: string;
  firstSeen: string;
  lastSeen: string;
  eventCount: number;
  assignedTo?: string;
  detectionId: string;
  notes: IncidentNote[];
  mitigationActionTaken?: 'NONE' | 'IP_BLOCKED' | 'RATE_LIMITED' | 'ALERT_SENT';
  createdAt: string;
  updatedAt: string;
}
