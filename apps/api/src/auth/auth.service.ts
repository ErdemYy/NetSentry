import { Injectable, Logger, UnauthorizedException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

export interface UserSessionPayload {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret =
    process.env.JWT_SECRET ||
    (process.env.NODE_ENV === 'production'
      ? (() => {
          throw new Error('FATAL: JWT_SECRET must be explicitly defined in production environment');
        })()
      : 'netsentry_dev_secret_development_only');
  private readonly jwtExpiresIn = '24h';

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    await this.seedInitialSecurityState();
  }

  private async seedInitialSecurityState() {
    try {
      // 1. Ensure Roles exist
      const adminRole = await this.prisma.role.upsert({
        where: { type: 'ADMIN' },
        update: {},
        create: {
          type: 'ADMIN',
          name: 'Security Administrator',
          description: 'Full SOC administration, system configuration, audit access, and user management',
        },
      });

      const analystRole = await this.prisma.role.upsert({
        where: { type: 'ANALYST' },
        update: {},
        create: {
          type: 'ANALYST',
          name: 'SOC Analyst',
          description: 'Operational threat investigation, incident management, and telemetry analytics',
        },
      });

      // 2. Ensure Default Admin User exists
      const adminCount = await this.prisma.user.count({ where: { email: 'admin@netsentry.ai' } });
      const envAdminPassword = process.env.ADMIN_INITIAL_PASSWORD;
      if (adminCount === 0 && envAdminPassword) {
        const adminPassHash = await bcrypt.hash(envAdminPassword, 10);
        await this.prisma.user.create({
          data: {
            email: 'admin@netsentry.ai',
            passwordHash: adminPassHash,
            fullName: 'NetSentry Lead Admin',
            roleId: adminRole.id,
          },
        });
        this.logger.log('Seeded default admin user from environment configuration: admin@netsentry.ai');
      } else if (adminCount === 0 && !envAdminPassword) {
        this.logger.warn('ADMIN_INITIAL_PASSWORD is not set in environment. Skipping default admin user seed.');
      }

      // 3. Ensure Default Analyst User exists
      const analystCount = await this.prisma.user.count({ where: { email: 'analyst@netsentry.ai' } });
      const envAnalystPassword = process.env.ANALYST_INITIAL_PASSWORD;
      if (analystCount === 0 && envAnalystPassword) {
        const analystPassHash = await bcrypt.hash(envAnalystPassword, 10);
        await this.prisma.user.create({
          data: {
            email: 'analyst@netsentry.ai',
            passwordHash: analystPassHash,
            fullName: 'NetSentry Tier-2 Analyst',
            roleId: analystRole.id,
          },
        });
        this.logger.log('Seeded default analyst user from environment configuration: analyst@netsentry.ai');
      } else if (analystCount === 0 && !envAnalystPassword) {
        this.logger.warn('ANALYST_INITIAL_PASSWORD is not set in environment. Skipping default analyst user seed.');
      }
    } catch (err: any) {
      this.logger.error(`Error during initial security state seeding: ${err.message}`);
    }
  }

  async login(email: string, pass: string, ipAddress?: string): Promise<{ token: string; user: UserSessionPayload }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!user) {
      await this.auditService.createLog({
        action: 'AUTH_LOGIN_FAILURE',
        targetResource: 'User',
        ipAddress,
        details: { email, reason: 'User not found' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (!isMatch) {
      await this.auditService.createLog({
        userId: user.id,
        action: 'AUTH_LOGIN_FAILURE',
        targetResource: 'User',
        targetId: user.id,
        ipAddress,
        details: { email, reason: 'Invalid password' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: UserSessionPayload = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role.type,
    };

    const token = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
    });

    await this.auditService.createLog({
      userId: user.id,
      action: 'AUTH_LOGIN_SUCCESS',
      targetResource: 'User',
      targetId: user.id,
      ipAddress,
      details: { email, role: user.role.type },
    });

    return { token, user: payload };
  }

  async logout(user?: UserSessionPayload, ipAddress?: string) {
    if (user) {
      await this.auditService.createLog({
        userId: user.id,
        action: 'AUTH_LOGOUT',
        targetResource: 'User',
        targetId: user.id,
        ipAddress,
      });
    }
    return { status: 'LOGGED_OUT' };
  }

  verifyToken(token: string): UserSessionPayload {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as UserSessionPayload;
      return decoded;
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired authentication session');
    }
  }
}
