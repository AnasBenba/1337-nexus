import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useCanvasSocket } from './useCanvasSocket';
import { Toolbar } from './Toolbar';
import { CanvasStage, getCanvasCoordinates } from './CanvasStage';
import { RemoteCursors } from './RemoteCursors';
import type { DrawingTool, CanvasShape, Point } from './types';

// Default document ID for general collaboration when no specific workspace is active
const DEFAULT_DOCUMENT_ID = '00000000-0000-0000-0000-000000000101';

export interface WhiteboardPageProps {
  embeddedDocumentId?: string;
  hideHeader?: boolean;
  onPeersChange?: (onlineLogins: string[]) => void;
}

export const WhiteboardPage: React.FC<WhiteboardPageProps> = ({
  embeddedDocumentId,
  hideHeader = false,
  onPeersChange,
}) => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  // 1. Document / Room ID resolution (?document_id=<uuid> or embeddedDocumentId)
  const documentId = embeddedDocumentId || searchParams.get('document_id') || DEFAULT_DOCUMENT_ID;

  // 2. Toolbar & Drawing State
  const [tool, setTool] = useState<DrawingTool>('pen');
  const [color, setColor] = useState<string>('#2563EB');
  const [strokeWidth, setStrokeWidth] = useState<number>(4);

  // 3. Canvas State & History
  const [shapes, setShapes] = useState<CanvasShape[]>([]);
  const [redoStack, setRedoStack] = useState<CanvasShape[]>([]);
  const [currentDrawing, setCurrentDrawing] = useState<CanvasShape | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef<boolean>(false);
  const startPointRef = useRef<Point>({ x: 0, y: 0 });
  const currentDrawingRef = useRef<CanvasShape | null>(null);

  // 4. Inbound binary delta update handler from /canvas WebSocket
  const handleRemoteUpdate = useCallback((data: ArrayBuffer) => {
    try {
      const text = new TextDecoder().decode(data);
      const msg = JSON.parse(text);

      if (msg.action === 'add_shape' && msg.shape) {
        setShapes((prev) => {
          if (prev.some((s) => s.id === msg.shape.id)) return prev;
          return [...prev, msg.shape];
        });
      } else if (msg.action === 'clear') {
        setShapes([]);
        setRedoStack([]);
      } else if (msg.action === 'undo' && msg.shapeId) {
        setShapes((prev) => prev.filter((s) => s.id !== msg.shapeId));
      }
    } catch {
      // Inbound binary might be arbitrary buffer or Yjs payload
    }
  }, []);

  // 5. Connect to Socket.IO /canvas namespace
  const canvasSocket = useCanvasSocket(documentId, handleRemoteUpdate);
  const { isConnected, sendAwareness, sendUpdate, peers } = canvasSocket;

  useEffect(() => {
    if (!onPeersChange) return;
    const logins: string[] = [];
    peers.forEach((state: any) => {
      if (state && typeof state.user === 'string') {
        logins.push(state.user);
      }
    });
    onPeersChange(logins);
  }, [peers, onPeersChange]);

  // 6. Broadcast local mouse cursor to peers for collaborative awareness
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const coords = getCanvasCoordinates(e, canvas);

    // Broadcast cursor position to room peers
    if (isConnected) {
      sendAwareness({
        user: user?.login || 'Anonymous',
        cursor: coords,
        color: color,
      });
    }

    if (!isDrawingRef.current || !currentDrawingRef.current) return;

    const current = currentDrawingRef.current;
    if (current.type === 'pen' || current.type === 'eraser') {
      current.points = [...(current.points || []), coords];
      setCurrentDrawing({ ...current });
    } else if (
      current.type === 'rect' ||
      current.type === 'circle' ||
      current.type === 'arrow'
    ) {
      current.width = coords.x - startPointRef.current.x;
      current.height = coords.y - startPointRef.current.y;
      setCurrentDrawing({ ...current });
    }
  };

  const commitShape = useCallback(
    (shape: CanvasShape) => {
      setShapes((prev) => [...prev, shape]);
      setRedoStack([]);

      // Send binary JSON update over Socket.IO to backend
      const payload = new TextEncoder().encode(
        JSON.stringify({
          action: 'add_shape',
          shape,
        })
      );
      sendUpdate(payload);
    },
    [sendUpdate]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (tool === 'select') return;

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    const coords = getCanvasCoordinates(e, canvas);
    isDrawingRef.current = true;
    startPointRef.current = coords;

    const shapeId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `shape_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (tool === 'text') {
      const textInput = prompt('Enter text note:');
      if (textInput && textInput.trim()) {
        const textShape: CanvasShape = {
          id: shapeId,
          type: 'text',
          color,
          strokeWidth,
          x: coords.x,
          y: coords.y,
          text: textInput.trim(),
          userId: user?.login || 'Anonymous',
          createdAt: Date.now(),
        };
        commitShape(textShape);
      }
      isDrawingRef.current = false;
      return;
    }

    const newShape: CanvasShape =
      tool === 'pen' || tool === 'eraser'
        ? {
            id: shapeId,
            type: tool,
            color: tool === 'eraser' ? '#FFFFFF' : color,
            strokeWidth: tool === 'eraser' ? strokeWidth * 3 : strokeWidth,
            points: [coords],
            userId: user?.login || 'Anonymous',
            createdAt: Date.now(),
          }
        : {
            id: shapeId,
            type: tool,
            color,
            strokeWidth,
            x: coords.x,
            y: coords.y,
            width: 0,
            height: 0,
            userId: user?.login || 'Anonymous',
            createdAt: Date.now(),
          };

    currentDrawingRef.current = newShape;
    setCurrentDrawing(newShape);
  };

  const handlePointerUp = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (e && canvasRef.current) {
      try {
        canvasRef.current.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
    }

    if (!isDrawingRef.current || !currentDrawingRef.current) {
      isDrawingRef.current = false;
      currentDrawingRef.current = null;
      setCurrentDrawing(null);
      return;
    }
    isDrawingRef.current = false;
    const finalShape = currentDrawingRef.current;
    currentDrawingRef.current = null;
    setCurrentDrawing(null);

    commitShape(finalShape);
  };

  const handleClear = () => {
    setShapes([]);
    setRedoStack([]);
    const payload = new TextEncoder().encode(
      JSON.stringify({
        action: 'clear',
      })
    );
    sendUpdate(payload);
  };

  const handleUndo = () => {
    if (shapes.length === 0) return;
    const last = shapes[shapes.length - 1];
    setShapes((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, last]);

    const payload = new TextEncoder().encode(
      JSON.stringify({
        action: 'undo',
        shapeId: last.id,
      })
    );
    sendUpdate(payload);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    commitShape(next);
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

  // 7. Render shapes and active drawing onto 2D Canvas context
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const drawShape = (s: CanvasShape) => {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = s.strokeWidth;
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;

      if ((s.type === 'pen' || s.type === 'eraser') && s.points && s.points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) {
          ctx.lineTo(s.points[i].x, s.points[i].y);
        }
        ctx.stroke();
      } else if (
        s.type === 'rect' &&
        s.x !== undefined &&
        s.y !== undefined &&
        s.width !== undefined &&
        s.height !== undefined
      ) {
        ctx.strokeRect(s.x, s.y, s.width, s.height);
      } else if (
        s.type === 'circle' &&
        s.x !== undefined &&
        s.y !== undefined &&
        s.width !== undefined &&
        s.height !== undefined
      ) {
        const radiusX = Math.abs(s.width) / 2;
        const radiusY = Math.abs(s.height) / 2;
        const centerX = s.x + s.width / 2;
        const centerY = s.y + s.height / 2;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, Math.max(1, radiusX), Math.max(1, radiusY), 0, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (
        s.type === 'arrow' &&
        s.x !== undefined &&
        s.y !== undefined &&
        s.width !== undefined &&
        s.height !== undefined
      ) {
        const fromX = s.x;
        const fromY = s.y;
        const toX = s.x + s.width;
        const toY = s.y + s.height;
        const headlen = 12;
        const angle = Math.atan2(toY - fromY, toX - fromX);

        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(
          toX - headlen * Math.cos(angle - Math.PI / 6),
          toY - headlen * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(toX, toY);
        ctx.lineTo(
          toX - headlen * Math.cos(angle + Math.PI / 6),
          toY - headlen * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
      } else if (s.type === 'text' && s.text && s.x !== undefined && s.y !== undefined) {
        ctx.font = `${Math.max(16, s.strokeWidth * 4)}px sans-serif`;
        ctx.fillText(s.text, s.x, s.y);
      }
      ctx.restore();
    };

    for (const shape of shapes) {
      drawShape(shape);
    }

    if (currentDrawing) {
      drawShape(currentDrawing);
    }
  }, [shapes, currentDrawing]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  return (
    <div className={`flex flex-col ${hideHeader ? 'h-full space-y-2.5' : 'h-[calc(100vh-6rem)] space-y-4'}`}>
      {/* Top Header */}
      {!hideHeader && (
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
            Real-time multi-user shared canvas synchronized with PostgreSQL & Socket.IO.
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
      )}

      {/* Toolbar */}
      <Toolbar
        currentTool={tool}
        onSelectTool={setTool}
        currentColor={color}
        onSelectColor={setColor}
        currentStrokeWidth={strokeWidth}
        onSelectStrokeWidth={setStrokeWidth}
        onClear={handleClear}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onExport={handleExportPNG}
        canUndo={shapes.length > 0}
        canRedo={redoStack.length > 0}
      />

      {/* Drawing Stage Area */}
      <CanvasStage
        canvasRef={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onResize={redrawCanvas}
      >
        <RemoteCursors peers={peers} />
      </CanvasStage>
    </div>
  );
};
