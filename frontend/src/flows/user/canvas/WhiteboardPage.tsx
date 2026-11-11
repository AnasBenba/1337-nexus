import React, { useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useCanvasSocket } from './useCanvasSocket';
import { Toolbar } from './Toolbar';
import { CanvasStage, getCanvasCoordinates } from './CanvasStage';
import { RemoteCursors } from './RemoteCursors';
import type { DrawingTool, CanvasShape } from './types';

// Default document ID for general collaboration when no specific workspace is active
const DEFAULT_DOCUMENT_ID = '00000000-0000-0000-0000-000000000101';

export const WhiteboardPage: React.FC = () => {
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const [searchParams] = useSearchParams();

  // 1. Document / Room ID resolution (?document_id=<uuid>)
  const documentId = searchParams.get('document_id') || DEFAULT_DOCUMENT_ID;

  // 2. Toolbar & Drawing State
  const [tool, setTool] = useState<DrawingTool>('pen');
  const [color, setColor] = useState<string>('#2563EB');
  const [strokeWidth, setStrokeWidth] = useState<number>(4);

  // 3. Shapes & History (ready for user's drawing engine or Yjs binding)
  const [shapes, setShapes] = useState<CanvasShape[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 4. Inbound binary delta update handler from /canvas WebSocket
  const handleRemoteUpdate = useCallback((data: ArrayBuffer) => {
    // User will decode incoming Yjs or binary delta updates here
    console.debug('Received canvas:update buffer:', data.byteLength, 'bytes');
  }, []);

  // 5. Connect to Socket.IO /canvas namespace
  // canvasSocket provides: isConnected, peers, sendAwareness, sendUpdate, and raw socket
  const canvasSocket = useCanvasSocket(documentId, handleRemoteUpdate);
  const { isConnected, sendAwareness, peers } = canvasSocket;

  // 6. Broadcast local mouse cursor to peers for collaborative awareness
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !isConnected) return;

    const coords = getCanvasCoordinates(e, canvas);

    // Broadcast cursor position to room peers
    sendAwareness({
      user: user?.login || 'Anonymous',
      cursor: coords,
      color: color,
    });

    // User will add their active drawing stroke rendering here
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!isAuthenticated) {
      openAuthModal();
      return;
    }

    const coords = getCanvasCoordinates(e, canvas);
    console.debug('Pointer down at:', coords, 'using tool:', tool);
    // User will start recording a new stroke / shape here
  };

  const handlePointerUp = () => {
    // User will finalize the stroke and send delta via canvasSocket.sendUpdate(binaryBytes) here
  };

  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const image = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `1337-nexus-whiteboard-${documentId.slice(0, 8)}.png`;
    link.href = image;
    link.click();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[26px]">draw</span>
            <h1 className="text-xl font-bold tracking-tight text-on-surface">
              Collaborative Whiteboard
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary-fixed text-on-primary-fixed">
              [CV-403]
            </span>
          </div>
          <p className="text-xs text-on-surface-variant">
            Real-time multi-user shared canvas powered by Socket.IO & Yjs CRDT synchronization.
          </p>
        </div>

        {/* Room Info & Connection Status */}
        <div className="flex items-center gap-2">
          {/* Active Collaborators count */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-surface-container text-xs font-semibold text-on-surface">
            <span className="material-symbols-outlined text-[16px] text-primary">group</span>
            <span>{peers.size + 1} online</span>
          </div>

          {/* Connection Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-surface-container text-xs font-semibold">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="text-[11px] text-on-surface-variant">
              {isConnected ? 'Connected' : 'Connecting...'}
            </span>
          </div>

          {/* Document ID badge */}
          <button
            type="button"
            title="Click to copy Room ID"
            onClick={() => navigator.clipboard.writeText(documentId)}
            className="flex items-center gap-1 px-3 py-1 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-xs font-mono text-on-surface-variant transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px]">content_copy</span>
            <span>Room: {documentId.slice(0, 8)}...</span>
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <Toolbar
        currentTool={tool}
        onSelectTool={setTool}
        currentColor={color}
        onSelectColor={setColor}
        currentStrokeWidth={strokeWidth}
        onSelectStrokeWidth={setStrokeWidth}
        onClear={() => setShapes([])}
        onExport={handleExportPNG}
        canUndo={shapes.length > 0}
        canRedo={false}
      />

      {/* Drawing Stage Area */}
      <CanvasStage
        canvasRef={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <RemoteCursors peers={peers} />
      </CanvasStage>
    </div>
  );
};
