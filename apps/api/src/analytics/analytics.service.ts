import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAnalyticsStats() {
    const totalDetections = await this.prisma.detection.count();

    if (totalDetections === 0) {
      return {
        totalDetections: 0,
        anomalyRate: 0,
        averageConfidence: 0,
        averageAnomalyScore: 0,
        attackCategoryDistribution: [],
        severityDistribution: [],
        verdictDistribution: [],
        confidenceDistribution: [],
      };
    }

    // 1. Attack Category Breakdown
    const categoryRaw = await this.prisma.detection.groupBy({
      by: ['attackCategory'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });
    const attackCategoryDistribution = categoryRaw.map((c) => ({
      category: c.attackCategory,
      count: c._count.id,
      percentage: Number(((c._count.id / totalDetections) * 100).toFixed(1)),
    }));

    // 2. Severity Breakdown
    const severityRaw = await this.prisma.detection.groupBy({
      by: ['severity'],
      _count: { id: true },
    });
    const severityDistribution = severityRaw.map((s) => ({
      severity: s.severity,
      count: s._count.id,
      percentage: Number(((s._count.id / totalDetections) * 100).toFixed(1)),
    }));

    // 3. Verdict Breakdown
    const verdictRaw = await this.prisma.detection.groupBy({
      by: ['verdict'],
      _count: { id: true },
    });
    const verdictDistribution = verdictRaw.map((v) => ({
      verdict: v.verdict,
      count: v._count.id,
      percentage: Number(((v._count.id / totalDetections) * 100).toFixed(1)),
    }));

    // 4. Anomaly metrics
    const anomalousCount = await this.prisma.detection.count({
      where: { isAnomalous: true },
    });
    const anomalyRate = Number(((anomalousCount / totalDetections) * 100).toFixed(1));

    // 5. Averages
    const avgStats = await this.prisma.detection.aggregate({
      _avg: {
        supervisedConfidence: true,
        unsupervisedAnomalyScore: true,
      },
    });

    // 6. Confidence Buckets
    const [under50, b50to80, b80to95, over95] = await Promise.all([
      this.prisma.detection.count({ where: { supervisedConfidence: { lt: 0.5 } } }),
      this.prisma.detection.count({ where: { supervisedConfidence: { gte: 0.5, lt: 0.8 } } }),
      this.prisma.detection.count({ where: { supervisedConfidence: { gte: 0.8, lt: 0.95 } } }),
      this.prisma.detection.count({ where: { supervisedConfidence: { gte: 0.95 } } }),
    ]);

    const confidenceDistribution = [
      { range: '< 50%', count: under50 },
      { range: '50% - 79%', count: b50to80 },
      { range: '80% - 94%', count: b80to95 },
      { range: '≥ 95%', count: over95 },
    ];

    return {
      totalDetections,
      anomalousCount,
      anomalyRate,
      averageConfidence: Number((avgStats._avg.supervisedConfidence || 0).toFixed(4)),
      averageAnomalyScore: Number((avgStats._avg.unsupervisedAnomalyScore || 0).toFixed(4)),
      attackCategoryDistribution,
      severityDistribution,
      verdictDistribution,
      confidenceDistribution,
    };
  }
}
