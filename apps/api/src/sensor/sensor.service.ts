import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';

export interface StartSensorDto {
  interface?: string;
  filter?: string;
}

export interface ProcessPcapDto {
  filename?: string;
  filepath?: string;
}

@Injectable()
export class SensorService {
  private readonly logger = new Logger(SensorService.name);
  private readonly mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
  private readonly internalServiceToken = process.env.INTERNAL_SERVICE_TOKEN || '';

  constructor(private readonly auditService: AuditService) {}

  private getAuthHeaders(contentTypeJson = false): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    if (contentTypeJson) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.internalServiceToken) {
      headers['Authorization'] = `Bearer ${this.internalServiceToken}`;
      headers['X-Internal-Service-Token'] = this.internalServiceToken;
    }
    return headers;
  }

  async getStatus(): Promise<any> {
    try {
      const response = await fetch(`${this.mlServiceUrl}/api/v1/sensor/status`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      if (!response.ok) {
        throw new HttpException(`Sensor status error: ${response.statusText}`, response.status);
      }
      return await response.json();
    } catch (err: any) {
      this.logger.warn(`Failed to connect to ML Sensor engine at ${this.mlServiceUrl}: ${err.message}`);
      return {
        sensor_enabled: false,
        capture_state: 'SENSOR_UNAVAILABLE',
        capture_interface: 'NONE',
        capture_filter: 'ip and (tcp or udp)',
        npcap_installed: false,
        packets_observed: 0,
        flows_active: 0,
        flows_completed: 0,
        flows_expired: 0,
        flows_dropped: 0,
        feature_extraction_errors: 0,
        last_packet_at: 'NONE',
        last_flow_at: 'NONE',
        error_message: `ML Sensor engine unreachable at ${this.mlServiceUrl}: ${err.message}`,
      };
    }
  }

  async getInterfaces(): Promise<any> {
    try {
      const response = await fetch(`${this.mlServiceUrl}/api/v1/sensor/interfaces`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      if (!response.ok) {
        throw new HttpException(`Sensor interfaces error: ${response.statusText}`, response.status);
      }
      return await response.json();
    } catch (err: any) {
      this.logger.warn(`Failed to query interfaces from ML Sensor engine: ${err.message}`);
      return {
        npcap_installed: false,
        default_interface: null,
        interfaces_count: 0,
        interfaces: [],
        error: `ML Sensor engine unreachable at ${this.mlServiceUrl}: ${err.message}`,
      };
    }
  }

  async startCapture(dto?: StartSensorDto, userId?: string): Promise<any> {
    let result: any;
    try {
      const response = await fetch(`${this.mlServiceUrl}/api/v1/sensor/start`, {
        method: 'POST',
        headers: this.getAuthHeaders(true),
        body: JSON.stringify({
          interface: dto?.interface || null,
          filter: dto?.filter || 'ip and (tcp or udp)',
        }),
      });
      result = await response.json();
    } catch (err: any) {
      result = {
        success: false,
        status: 'SENSOR_UNAVAILABLE',
        error: `ML Sensor engine unreachable at ${this.mlServiceUrl}: ${err.message}`,
      };
    }

    // Record audit event
    await this.auditService.createLog({
      userId,
      action: 'SENSOR_STARTED',
      targetResource: 'LiveSensor',
      details: {
        interface: dto?.interface || 'DEFAULT',
        filter: dto?.filter || 'ip and (tcp or udp)',
        success: result.success ?? false,
        status: result.status,
      },
    });

    return result;
  }

  async stopCapture(userId?: string): Promise<any> {
    let result: any;
    try {
      const response = await fetch(`${this.mlServiceUrl}/api/v1/sensor/stop`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });
      result = await response.json();
    } catch (err: any) {
      result = {
        success: false,
        error: `ML Sensor engine unreachable at ${this.mlServiceUrl}: ${err.message}`,
      };
    }

    // Record audit event
    await this.auditService.createLog({
      userId,
      action: 'SENSOR_STOPPED',
      targetResource: 'LiveSensor',
      details: result,
    });

    return result;
  }

  async processPcap(dto: ProcessPcapDto, userId?: string): Promise<any> {
    const targetFile = dto?.filename || dto?.filepath;
    if (!targetFile) {
      throw new HttpException('Missing filename or filepath parameter', HttpStatus.BAD_REQUEST);
    }

    let result: any;
    try {
      const response = await fetch(`${this.mlServiceUrl}/api/v1/sensor/process-pcap`, {
        method: 'POST',
        headers: this.getAuthHeaders(true),
        body: JSON.stringify({
          filename: dto?.filename || targetFile,
          filepath: dto?.filepath || targetFile,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new HttpException(`PCAP processing failed: ${errorText}`, response.status);
      }
      result = await response.json();
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(`Failed to communicate with sensor engine: ${err.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // Record audit event with sanitized filename (never full filesystem path)
    const sanitizedFilename = result.filename || targetFile.replace(/^.*[\\/]/, '');
    await this.auditService.createLog({
      userId,
      action: 'SENSOR_PCAP_PROCESSED',
      targetResource: 'LiveSensor',
      details: {
        filename: sanitizedFilename,
        packets_processed: result.packets_processed,
        flows_extracted: result.flows_extracted,
        elapsed_seconds: result.elapsed_seconds,
      },
    });

    return result;
  }
}
