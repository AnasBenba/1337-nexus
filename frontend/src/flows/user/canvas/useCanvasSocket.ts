import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  AwarenessPayload,
  RemotePeer,
  UseCanvasSocketReturn,
} from './types';

export interface UseCanvasSocketOptions {
  documentId: string;
  onRemoteUpdate?: (data: Uint8Array) => void;
}

const PEER_COLORS = [
  '#2563EB',
  '#DC2626',
  '#16A34A',
  '#9333EA',
  '#EA580C',
  '#0891B2',
  '#D97706',
  '#DB2777',
];

function getPeerColor(sid: string): string {
  let hash = 0;
  for (let i = 0; i < sid.length; i++) {
    hash = sid.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PEER_COLORS[Math.abs(hash) % PEER_COLORS.length];
}

export function useCanvasSocket({
  documentId,
  onRemoteUpdate,
}: UseCanvasSocketOptions): UseCanvasSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [peers, setPeers] = useState<Map<string, RemotePeer>>(new Map());
  const onRemoteUpdateRef = useRef(onRemoteUpdate);

  useEffect(() => {
    onRemoteUpdateRef.current = onRemoteUpdate;
  }, [onRemoteUpdate]);

  useEffect(() => {
    if (!documentId) return;

    const socket = io('/canvas', {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      withCredentials: true,
      forceNew: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('canvas:join', { document_id: documentId }, (ack: { status?: string }) => {
        if (ack && ack.status === 'ok') {
          setIsConnected(true);
        } else {
          setIsConnected(true);
        }
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setPeers(new Map());
    });

    socket.on('canvas:update', (rawData: ArrayBuffer | Uint8Array | { data?: ArrayBuffer | number[] }) => {
      let bytes: Uint8Array | null = null;
      if (rawData instanceof Uint8Array) {
        bytes = rawData;
      } else if (rawData instanceof ArrayBuffer) {
        bytes = new Uint8Array(rawData);
      } else if (rawData && typeof rawData === 'object' && 'data' in rawData) {
        if (rawData.data instanceof ArrayBuffer) {
          bytes = new Uint8Array(rawData.data);
        } else if (Array.isArray(rawData.data)) {
          bytes = new Uint8Array(rawData.data);
        }
      }
      if (bytes && onRemoteUpdateRef.current) {
        onRemoteUpdateRef.current(bytes);
      }
    });

    socket.on('canvas:awareness', (data: AwarenessPayload & { type?: string; sid?: string }) => {
      if (!data) return;

      if (data.type === 'leave' && data.sid) {
        setPeers((prev) => {
          const next = new Map(prev);
          next.delete(data.sid!);
          return next;
        });
        return;
      }

      if (!data.sid || !data.cursor) return;

      const sid = data.sid;
      setPeers((prev) => {
        const next = new Map(prev);
        next.set(sid, {
          sid,
          user: data.user || 'Peer',
          cursor: data.cursor,
          color: data.color || getPeerColor(sid),
        });
        return next;
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [documentId]);

  const sendUpdate = useCallback(
    (update: Uint8Array) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) return;
      socket.emit('canvas:update', {
        document_id: documentId,
        data: update,
      });
    },
    [documentId]
  );

  const sendAwareness = useCallback((payload: AwarenessPayload) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;
    socket.emit('canvas:awareness', payload);
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    sendUpdate,
    sendAwareness,
    peers,
  };
}
