import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NetworkService {
  constructor(private readonly prisma: PrismaService) {}

  async getNetworkStats() {
    const totalFlows = await this.prisma.flow.count();

    // Protocol distribution
    const protocolsRaw = await this.prisma.flow.groupBy({
      by: ['protocol'],
      _count: { id: true },
    });
    const protocolDistribution = protocolsRaw.map((p) => ({
      protocol: p.protocol,
      count: p._count.id,
      percentage: totalFlows > 0 ? Number(((p._count.id / totalFlows) * 100).toFixed(1)) : 0,
    }));

    // Top destination ports
    const topPortsRaw = await this.prisma.flow.groupBy({
      by: ['destinationPort'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 8,
    });
    const portDistribution = topPortsRaw.map((p) => ({
      port: p.destinationPort,
      count: p._count.id,
      service: this.getPortServiceName(p.destinationPort),
    }));

    // Aggregate averages
    const aggregates = await this.prisma.flow.aggregate({
      _avg: {
        durationMs: true,
        totalFwdPackets: true,
        totalBwdPackets: true,
        totalFwdBytes: true,
        totalBwdBytes: true,
        flowBytesPerSec: true,
        flowPacketsPerSec: true,
      },
    });

    // Recent flows
    const recentFlows = await this.prisma.flow.findMany({
      take: 20,
      orderBy: { timestamp: 'desc' },
      include: {
        detections: {
          select: {
            id: true,
            attackCategory: true,
            verdict: true,
            severity: true,
          },
        },
      },
    });

    return {
      totalFlows,
      protocolDistribution,
      portDistribution,
      averages: {
        durationMs: Number((aggregates._avg.durationMs || 0).toFixed(2)),
        totalPackets: Number(((aggregates._avg.totalFwdPackets || 0) + (aggregates._avg.totalBwdPackets || 0)).toFixed(1)),
        totalBytes: Number(((aggregates._avg.totalFwdBytes || 0) + (aggregates._avg.totalBwdBytes || 0)).toFixed(1)),
        bytesPerSec: Number((aggregates._avg.flowBytesPerSec || 0).toFixed(2)),
        packetsPerSec: Number((aggregates._avg.flowPacketsPerSec || 0).toFixed(2)),
      },
      recentFlows,
    };
  }

  private getPortServiceName(port: number): string {
    const known: Record<number, string> = {
      80: 'HTTP',
      443: 'HTTPS',
      21: 'FTP',
      22: 'SSH',
      23: 'Telnet',
      25: 'SMTP',
      53: 'DNS',
      110: 'POP3',
      143: 'IMAP',
      445: 'SMB',
      3389: 'RDP',
      8080: 'HTTP-Alt',
    };
    return known[port] || 'Other';
  }
}
