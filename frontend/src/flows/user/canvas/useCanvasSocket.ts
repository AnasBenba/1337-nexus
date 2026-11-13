// CV-403: Collaborative Whiteboard UI - Socket.IO hook
// Connects to /canvas namespace, handles room join, delta relay, and awareness sync.

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { AwarenessPayload, RemotePeer, UseCanvasSocketReturn } from './types';

/**
 * Custom hook that manages a Socket.IO connection to the /canvas namespace.
 *
 * @param documentId - WorkspaceCanvasDocument UUID, or null to stay disconnected.
 * @param onUpdate   - Called with each incoming binary update from the server.
 */
export function useCanvasSocket(
  documentId: string | null,
  onUpdate?: (data: ArrayBuffer) => void,
): UseCanvasSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [peers, setPeers] = useState<Map<string, RemotePeer>>(new Map());

  // Keep latest onUpdate callback in a ref to avoid reconnecting on reference change
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!documentId) {
      setIsConnected(false);
      return;
    }

    const socket = io('/canvas', {
      path: '/socket.io',
      transports: ['websocket'],
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('canvas:join', { document_id: documentId }, (response: unknown) => {
        if (response && typeof response === 'object' && 'status' in response && response.status === 'ok') {
          setIsConnected(true);
        } else {
          setIsConnected(true);
        }
      });
    });

    socket.on('canvas:update', (data: ArrayBuffer) => {
      onUpdateRef.current?.(data);
    });

    socket.on('canvas:awareness', (payload: AwarenessPayload & { type?: string }) => {
      if (payload.type === 'leave' && payload.sid) {
        setPeers((prev) => {
          const next = new Map(prev);
          next.delete(payload.sid!);
          return next;
        });
        return;
      }

      if (payload.sid && payload.cursor) {
        setPeers((prev) => {
          const next = new Map(prev);
          next.set(payload.sid!, {
            sid: payload.sid!,
            user: payload.user || 'Collaborator',
            cursor: payload.cursor,
            color: payload.color || '#2563EB',
          });
          return next;
        });
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setPeers(new Map());
    };
  }, [documentId]);

  const sendUpdate = useCallback((update: Uint8Array) => {
    socketRef.current?.emit('canvas:update', update);
  }, []);

  const sendAwareness = useCallback((payload: AwarenessPayload) => {
    socketRef.current?.emit('canvas:awareness', {
      ...payload,
      sid: socketRef.current?.id,
    });
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    sendUpdate,
    sendAwareness,
    peers,
  };
}
