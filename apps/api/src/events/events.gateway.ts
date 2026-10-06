import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ThreatFeedEvent, MetricSnapshotEvent, DetectionResult } from '@netsentry/shared';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/events',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe_threat_feed')
  handleSubscribeThreatFeed(
    @ConnectedSocket() client: Socket,
    @MessageBody() _data: unknown,
  ) {
    client.join('threat_feed');
    return { status: 'subscribed', channel: 'threat_feed' };
  }

  broadcastThreat(event: ThreatFeedEvent) {
    if (this.server) {
      this.server.to('threat_feed').emit('threat_alert', event);
      this.server.emit('detection.created', event.detection);
    }
  }

  broadcastDetection(detection: DetectionResult) {
    if (this.server) {
      this.server.emit('detection.created', detection);
    }
  }

  broadcastMetricSnapshot(metrics: MetricSnapshotEvent) {
    if (this.server) {
      this.server.emit('metrics_snapshot', metrics);
    }
  }

}

