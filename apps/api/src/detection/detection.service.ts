import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import {
  DetectionResult,
  NetworkFlow,
  ThreatFeedEvent,
  AttackCategory,
  SeverityLevel,
  ThreatVerdict,
  NetworkProtocol,
} from '@netsentry/shared';

@Injectable()
export class DetectionService {
  private readonly logger = new Logger(DetectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  /**
   * Idempotently persists Flow and DetectionResult entities,
   * creates Incident if threshold is reached, and broadcasts to WebSocket.
   */
  async processDetection(
    detectionData: DetectionResult,
    flowData?: NetworkFlow,
    eventData?: ThreatFeedEvent,
  ): Promise<{ flowId: string; detectionId: string; isDuplicate: boolean }> {
    const detectionId = detectionData.id;
    const flowId = detectionData.flowId;

    // Check idempotency for Detection
    const existingDetection = await this.prisma.detection.findUnique({
      where: { id: detectionId },
    });

    if (existingDetection) {
      this.logger.debug(`Detection ${detectionId} already exists in database (Idempotent skip).`);
      return { flowId, detectionId, isDuplicate: true };
    }

    // 1. Idempotently persist Flow
    const flowTimestamp = flowData?.timestamp ? new Date(flowData.timestamp) : new Date(detectionData.timestamp);
    const protocol: NetworkProtocol = flowData?.protocol || 'TCP';

    await this.prisma.flow.upsert({
      where: { id: flowId },
      create: {
        id: flowId,
        timestamp: flowTimestamp,
        sourceIp: flowData?.sourceIp || '192.168.10.15',
        destinationIp: flowData?.destinationIp || '192.168.10.50',
        sourcePort: flowData?.sourcePort ?? 49152,
        destinationPort: flowData?.destinationPort ?? 80,
        protocol: protocol as any,
        durationMs: flowData?.durationMs ?? 0.0,
        totalFwdPackets: flowData?.totalFwdPackets ?? 1,
        totalBwdPackets: flowData?.totalBwdPackets ?? 0,
        totalFwdBytes: flowData?.totalFwdBytes ?? 0.0,
        totalBwdBytes: flowData?.totalBwdBytes ?? 0.0,
        fwdPacketLengthMean: flowData?.fwdPacketLengthMean ?? 0.0,
        bwdPacketLengthMean: flowData?.bwdPacketLengthMean ?? 0.0,
        flowBytesPerSec: flowData?.flowBytesPerSec ?? 0.0,
        flowPacketsPerSec: flowData?.flowPacketsPerSec ?? 0.0,
        synFlagCount: flowData?.synFlagCount ?? 0,
        finFlagCount: flowData?.finFlagCount ?? 0,
        rstFlagCount: flowData?.rstFlagCount ?? 0,
        pshFlagCount: flowData?.pshFlagCount ?? 0,
        ackFlagCount: flowData?.ackFlagCount ?? 0,
      },
      update: {},
    });

    // 2. Persist Detection
    const detectionTimestamp = new Date(detectionData.timestamp);
    const attackCategory = detectionData.attackCategory as AttackCategory;
    const severity = detectionData.severity as SeverityLevel;
    const verdict = detectionData.verdict as ThreatVerdict;

    const savedDetection = await this.prisma.detection.create({
      data: {
        id: detectionId,
        flowId: flowId,
        timestamp: detectionTimestamp,
        verdict: verdict as any,
        attackCategory: attackCategory as any,
        supervisedConfidence: detectionData.supervisedConfidence,
        unsupervisedAnomalyScore: detectionData.unsupervisedAnomalyScore,
        isAnomalous: detectionData.isAnomalous,
        severity: severity as any,
        topFeatures: detectionData.topFeatures as any,
        explanation: detectionData.explanation,
        modelVersionSupervised: detectionData.modelVersionSupervised,
        modelVersionUnsupervised: detectionData.modelVersionUnsupervised,
      },
    });

    // 3. Automatically create Incident if HIGH or CRITICAL severity threat
    if (severity === 'HIGH' || severity === 'CRITICAL' || verdict === 'HIGH_RISK') {
      const srcIp = flowData?.sourceIp || '192.168.10.15';
      const dstIp = flowData?.destinationIp || '192.168.10.50';
      const dstPort = flowData?.destinationPort ?? 80;

      await this.prisma.incident.upsert({
        where: { detectionId: detectionId },
        create: {
          title: `${attackCategory} detected against ${dstIp}:${dstPort}`,
          severity: severity as any,
          attackCategory: attackCategory as any,
          sourceIp: srcIp,
          destinationIp: dstIp,
          firstSeen: detectionTimestamp,
          lastSeen: detectionTimestamp,
          eventCount: 1,
          detectionId: detectionId,
          status: 'NEW',
        },
        update: {},
      });
    }

    // 4. WebSocket Broadcast
    if (eventData) {
      this.eventsGateway.broadcastThreat(eventData);
    } else {
      this.eventsGateway.broadcastDetection(detectionData);
    }

    this.logger.log(
      `Processed detection ${detectionId} [${attackCategory} / ${verdict}] ` +
      `Severity: ${severity}, Latency: ${detectionData.inferenceLatencyMs ?? 'N/A'}ms`,
    );

    return { flowId, detectionId, isDuplicate: false };
  }
}
