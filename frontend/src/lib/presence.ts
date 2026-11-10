import { io, type Socket } from 'socket.io-client';
import { refreshSession } from '@/lib/http';

/** Sent by the backend to my friends when I come online / go offline. */
export type PresenceEvent = { user_id: number; online: boolean };

let socket: Socket | null = null;
const listeners = new Set<(event: PresenceEvent) => void>();

/** Open the app-wide presence connection. While it's open, my friends see me online. */
export function connectPresence(): void {
  if (socket) return;
  // Same origin: nginx (and the Vite dev proxy) forward /socket.io/ to the backend,
  // and the browser sends the login cookie with the handshake.
  const s = io('/presence', { withCredentials: true });
  socket = s;
  s.on('presence', (event: PresenceEvent) => listeners.forEach((listener) => listener(event)));

  // The handshake is refused when the access token has expired (e.g. reconnecting after a
  // backend restart). Refresh once and retry; give up if that still fails.
  let retried = false;
  s.on('connect', () => {
    retried = false;
  });
  s.on('connect_error', () => {
    if (retried) return;
    retried = true;
    void refreshSession().then((ok) => {
      if (ok && socket === s) s.connect();
    });
  });
}

export function disconnectPresence(): void {
  socket?.disconnect();
  socket = null;
}

/** Subscribe to friends' online/offline changes. Returns an unsubscribe function. */
export function onPresence(listener: (event: PresenceEvent) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
