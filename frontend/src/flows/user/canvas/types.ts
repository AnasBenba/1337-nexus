// CV-403: Collaborative Whiteboard UI - Type Definitions

export type DrawingTool = 'pen' | 'rect' | 'circle' | 'arrow' | 'text' | 'eraser' | 'select';

export interface Point {
  x: number;
  y: number;
}

export interface CanvasShape {
  id: string;
  type: DrawingTool;
  color: string;
  strokeWidth: number;
  /** Freehand path points (pen / eraser) */
  points?: Point[];
  /** Bounding box (rect / circle / arrow / text) */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  /** Text content (text tool) */
  text?: string;
  /** Author info */
  userId?: string;
  createdAt?: number;
}

export interface RemotePeer {
  /** Socket.IO session id */
  sid: string;
  /** Display name */
  user: string;
  cursor: Point;
  /** Assigned highlight colour for this peer */
  color: string;
}

/** Payload sent/received on the 'canvas:awareness' event */
export interface AwarenessPayload {
  user: string;
  cursor: Point;
  color: string;
  /** sid is populated by the server on inbound awareness events */
  sid?: string;
}

/** Binary delta message shape (Yjs-compatible Uint8Array over the wire) */
export interface CanvasUpdateEvent {
  documentId: string;
  update: Uint8Array;
}

/** Return type of useCanvasSocket */
export interface UseCanvasSocketReturn {
  /** Raw socket reference — null until connected */
  socket: import('socket.io-client').Socket | null;
  /** Whether the socket is connected and has joined the room */
  isConnected: boolean;
  /** Send a binary Yjs update to the room */
  sendUpdate: (update: Uint8Array) => void;
  /** Broadcast cursor / awareness info */
  sendAwareness: (payload: AwarenessPayload) => void;
  /** Remote peer map keyed by sid */
  peers: Map<string, RemotePeer>;
}
