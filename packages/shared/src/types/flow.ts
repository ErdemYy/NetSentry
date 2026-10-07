export type NetworkProtocol = 'TCP' | 'UDP' | 'ICMP' | 'OTHER';
export type FlowSource = 'replay' | 'live';

export interface NetworkFlow {
  id: string;
  timestamp: string; // ISO 8601
  sourceIp: string;
  destinationIp: string;
  sourcePort: number;
  destinationPort: number;
  protocol: NetworkProtocol;
  durationMs: number;
  totalFwdPackets: number;
  totalBwdPackets: number;
  totalFwdBytes: number;
  totalBwdBytes: number;
  fwdPacketLengthMean: number;
  bwdPacketLengthMean: number;
  flowBytesPerSec: number;
  flowPacketsPerSec: number;
  synFlagCount: number;
  finFlagCount: number;
  rstFlagCount: number;
  pshFlagCount: number;
  ackFlagCount: number;
  source?: FlowSource;
}
