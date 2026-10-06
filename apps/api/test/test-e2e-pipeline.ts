import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { DetectionService } from '../src/detection/detection.service';
import { DetectionResult, NetworkFlow, ThreatFeedEvent } from '@netsentry/shared';

async function runE2ETest() {
  console.log('--- STARTING PHASE 2 E2E INTEGRATION TEST ---');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'error', 'warn'] });

  const prisma = app.get(PrismaService);
  const detectionService = app.get(DetectionService);

  try {
    const testFlowId = `flow-e2e-${Date.now()}`;
    const testDetectionId = `det-e2e-${Date.now()}`;
    const timestampStr = new Date().toISOString();

    const sampleFlow: NetworkFlow = {
      id: testFlowId,
      timestamp: timestampStr,
      sourceIp: '172.16.0.45',
      destinationIp: '192.168.10.50',
      sourcePort: 54321,
      destinationPort: 80,
      protocol: 'TCP',
      durationMs: 1450.5,
      totalFwdPackets: 12,
      totalBwdPackets: 8,
      totalFwdBytes: 4500.0,
      totalBwdBytes: 9800.0,
      fwdPacketLengthMean: 375.0,
      bwdPacketLengthMean: 1225.0,
      flowBytesPerSec: 9858.6,
      flowPacketsPerSec: 13.78,
      synFlagCount: 1,
      finFlagCount: 1,
      rstFlagCount: 0,
      pshFlagCount: 2,
      ackFlagCount: 19,
    };

    const sampleDetection: DetectionResult = {
      id: testDetectionId,
      flowId: testFlowId,
      timestamp: timestampStr,
      verdict: 'HIGH_RISK',
      attackCategory: 'DDOS',
      supervisedConfidence: 0.9998,
      unsupervisedAnomalyScore: 0.5842,
      anomalyThreshold: 0.4954,
      isAnomalous: true,
      severity: 'CRITICAL',
      topFeatures: [
        {
          feature: 'bwd_packet_length_mean',
          value: 1225.0,
          contribution: 2.845,
          description: 'bwd_packet_length_mean increases risk for DDOS',
          direction: 'increases_risk',
        },
      ],
      explanation: "Primary decision factor: 'bwd_packet_length_mean' (+2.85 contribution).",
      modelVersionSupervised: 'LightGBM-1.0.0',
      modelVersionUnsupervised: 'IsolationForest-1.0.0',
      inferenceLatencyMs: 24.5,
      classProbabilities: {
        DDOS: 0.9998,
        BENIGN: 0.0001,
        DOS: 0.0001,
      },
    };

    const sampleEvent: ThreatFeedEvent = {
      eventId: `evt-e2e-${Date.now()}`,
      timestamp: timestampStr,
      flow: sampleFlow,
      detection: sampleDetection,
    };

    console.log(`1. Testing initial persistence of detection ${testDetectionId}...`);
    const result1 = await detectionService.processDetection(sampleDetection, sampleFlow, sampleEvent);
    if (result1.isDuplicate) {
      throw new Error('Expected initial insertion not to be marked as duplicate');
    }

    // Verify PostgreSQL records
    const savedFlow = await prisma.flow.findUnique({ where: { id: testFlowId } });
    if (!savedFlow) {
      throw new Error(`Flow ${testFlowId} was not found in PostgreSQL!`);
    }
    console.log(`   [PASS] Flow found in PostgreSQL: ${savedFlow.id} (${savedFlow.sourceIp} -> ${savedFlow.destinationIp})`);

    const savedDetection = await prisma.detection.findUnique({ where: { id: testDetectionId } });
    if (!savedDetection) {
      throw new Error(`Detection ${testDetectionId} was not found in PostgreSQL!`);
    }
    console.log(
      `   [PASS] Detection found in PostgreSQL: ${savedDetection.id} [${savedDetection.attackCategory} | ${savedDetection.verdict} | Severity: ${savedDetection.severity}]`,
    );

    const savedIncident = await prisma.incident.findUnique({ where: { detectionId: testDetectionId } });
    if (!savedIncident) {
      throw new Error(`Expected Incident for CRITICAL alert was not created in PostgreSQL!`);
    }
    console.log(`   [PASS] Incident automatically created: ${savedIncident.id} [Title: "${savedIncident.title}"]`);

    // 2. Testing IDEMPOTENCY
    console.log('2. Testing IDEMPOTENCY (processing the exact same detection payload twice)...');
    const detectionCountBefore = await prisma.detection.count();
    const result2 = await detectionService.processDetection(sampleDetection, sampleFlow, sampleEvent);
    const detectionCountAfter = await prisma.detection.count();

    if (!result2.isDuplicate) {
      throw new Error('Expected second submission to be detected as duplicate');
    }
    if (detectionCountBefore !== detectionCountAfter) {
      throw new Error(`Detection count increased from ${detectionCountBefore} to ${detectionCountAfter}! Duplicate created!`);
    }
    console.log(`   [PASS] Idempotency verified: Duplicate was rejected without creating duplicate DB records.`);

    console.log('--- ALL E2E PERSISTENCE & IDEMPOTENCY TESTS PASSED! ---');
  } catch (err) {
    console.error('E2E TEST FAILURE:', err);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

runE2ETest();
