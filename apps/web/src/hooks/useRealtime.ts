'use client';

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../lib/api';

export type ConnectionStatus = 'LIVE' | 'RECONNECTING' | 'DISCONNECTED';

export interface RealtimeState {
  status: ConnectionStatus;
  lastEventAt: string | null;
  liveEventCount: number;
  recentAlerts: any[];
}

export function useRealtime() {
  const [status, setStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const [liveEventCount, setLiveEventCount] = useState<number>(0);
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socketUrl = `${API_BASE_URL}/events`;
    const socket: Socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('LIVE');
      socket.emit('subscribe_threat_feed', {});
    });

    socket.on('disconnect', () => {
      setStatus('DISCONNECTED');
    });

    socket.on('connect_error', () => {
      setStatus('RECONNECTING');
    });

    socket.on('reconnect_attempt', () => {
      setStatus('RECONNECTING');
    });

    socket.on('threat_alert', (eventData: any) => {
      const now = new Date().toISOString();
      setLastEventAt(now);
      setLiveEventCount((prev) => prev + 1);

      const detection = eventData?.detection || eventData;
      const flow = eventData?.flow;

      const fullItem = {
        ...detection,
        flow: flow || detection.flow,
      };

      setRecentAlerts((prev) => {
        // Prevent duplicate IDs in the live feed
        const exists = prev.some((item) => item.id === fullItem.id);
        if (exists) return prev;
        return [fullItem, ...prev].slice(0, 50);
      });
    });

    socket.on('detection.created', (detection: any) => {
      const now = new Date().toISOString();
      setLastEventAt(now);
      setLiveEventCount((prev) => prev + 1);

      setRecentAlerts((prev) => {
        const exists = prev.some((item) => item.id === detection.id);
        if (exists) return prev;
        return [detection, ...prev].slice(0, 50);
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return {
    status,
    lastEventAt,
    liveEventCount,
    recentAlerts,
  };
}
