import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import type { LayoutContext } from '@/components/Layout';
import type { CanvasShape, DrawingTool, Point } from './types';
import { useCanvasSocket } from './useCanvasSocket';
import { Toolbar } from './Toolbar';
import { CanvasStage, getCanvasCoordinates } from './CanvasStage';
import { RemoteCursors } from './RemoteCursors';

const DEFAULT_DOCUMENT_ID = '00000000-0000-0000-0000-000000000403';

function encodeShapes(shapes: CanvasShape[]): Uint8Array {
  const json = JSON.stringify(shapes);
  return new TextEncoder().encode(json);
}

function decodeShapes(data: Uint8Array): CanvasShape[] | null {
  try {
    const json = new TextDecoder().decode(data);
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

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
  const [searchParams] = useSearchParams();
  const outletCtx = useOutletContext<LayoutContext | undefined>();
  const currentUser = outletCtx?.me ?? null;
  const documentId = embeddedDocumentId || searchParams.get('doc') || DEFAULT_DOCUMENT_ID;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shapes, setShapes] = useState<CanvasShape[]>([]);
  const [redoStack, setRedoStack] = useState<CanvasShape[]>([]);
  const [currentTool, setCurrentTool] = useState<DrawingTool>('pen');
  const [currentColor, setCurrentColor] = useState<string>('#2563EB');
  const [currentStrokeWidth, setCurrentStrokeWidth] = useState<number>(4);

  const [isDrawing, setIsDrawing] = useState(false);
  const [activeShape, setActiveShape] = useState<CanvasShape | null>(null);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState<Point | null>(null);

  const [textModalOpen, setTextModalOpen] = useState(false);
  const [pendingTextPos, setPendingTextPos] = useState<Point | null>(null);
  const [textInputVal, setTextInputVal] = useState('');

  const handleRemoteUpdate = useCallback((bytes: Uint8Array) => {
    const remoteShapes = decodeShapes(bytes);
    if (remoteShapes) {
      setShapes(remoteShapes);
    }
  }, []);

  const { isConnected, sendUpdate, sendAwareness, peers } = useCanvasSocket({
    documentId,
    onRemoteUpdate: handleRemoteUpdate,
  });

  useEffect(() => {
    if (onPeersChange) {
      const logins = Array.from(peers.values()).map((p) => p.user);
      if (currentUser?.login) {
        logins.push(currentUser.login);
      }
      onPeersChange(Array.from(new Set(logins)));
    }
  }, [peers, currentUser, onPeersChange]);

  const drawShape = useCallback((ctx: CanvasRenderingContext2D, shape: CanvasShape) => {
    ctx.save();
    ctx.strokeStyle = shape.type === 'eraser' ? '#FFFFFF' : shape.color;
    ctx.fillStyle = shape.color;
    ctx.lineWidth = shape.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if ((shape.type === 'pen' || shape.type === 'eraser') && shape.points && shape.points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(shape.points[0].x, shape.points[0].y);
      for (let i = 1; i < shape.points.length; i++) {
        ctx.lineTo(shape.points[i].x, shape.points[i].y);
      }
      ctx.stroke();
    } else if (
      shape.type === 'rect' &&
      shape.x !== undefined &&
      shape.y !== undefined &&
      shape.width !== undefined &&
      shape.height !== undefined
    ) {
      ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
    } else if (
      shape.type === 'circle' &&
      shape.x !== undefined &&
      shape.y !== undefined &&
      shape.width !== undefined &&
      shape.height !== undefined
    ) {
      const rx = Math.abs(shape.width) / 2;
      const ry = Math.abs(shape.height) / 2;
      const cx = shape.x + shape.width / 2;
      const cy = shape.y + shape.height / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (
      shape.type === 'arrow' &&
      shape.x !== undefined &&
      shape.y !== undefined &&
      shape.width !== undefined &&
      shape.height !== undefined
    ) {
      const x1 = shape.x;
      const y1 = shape.y;
      const x2 = shape.x + shape.width;
      const y2 = shape.y + shape.height;
      const headLen = 12;
      const angle = Math.atan2(y2 - y1, x2 - x1);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    } else if (shape.type === 'text' && shape.x !== undefined && shape.y !== undefined && shape.text) {
      ctx.font = `bold ${Math.max(14, shape.strokeWidth * 3)}px sans-serif`;
      ctx.fillText(shape.text, shape.x, shape.y);
    }

    ctx.restore();
  }, []);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.save();
    ctx.translate(pan.x, pan.y);

    // Subtle dot grid
    const gridSize = 24;
    ctx.fillStyle = 'rgba(148, 163, 184, 0.3)';
    for (let gx = -pan.x % gridSize; gx < rect.width - pan.x; gx += gridSize) {
      for (let gy = -pan.y % gridSize; gy < rect.height - pan.y; gy += gridSize) {
        ctx.fillRect(gx, gy, 1.5, 1.5);
      }
    }

    for (const s of shapes) {
      drawShape(ctx, s);
    }
    if (activeShape) {
      drawShape(ctx, activeShape);
    }

    ctx.restore();
  }, [shapes, activeShape, pan, drawShape]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const addShape = (newShape: CanvasShape) => {
    setShapes((prev) => {
      const updated = [...prev, newShape];
      sendUpdate(encodeShapes(updated));
      return updated;
    });
    setRedoStack([]);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    if (currentTool === 'select') {
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    const pt = getCanvasCoordinates(e, canvas, pan);

    if (currentTool === 'text') {
      setPendingTextPos(pt);
      setTextInputVal('');
      setTextModalOpen(true);
      return;
    }

    setIsDrawing(true);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    if (currentTool === 'pen' || currentTool === 'eraser') {
      setActiveShape({
        id,
        type: currentTool,
        color: currentColor,
        strokeWidth: currentTool === 'eraser' ? currentStrokeWidth * 3 : currentStrokeWidth,
        points: [pt],
        createdAt: Date.now(),
      });
    } else {
      setActiveShape({
        id,
        type: currentTool,
        color: currentColor,
        strokeWidth: currentStrokeWidth,
        x: pt.x,
        y: pt.y,
        width: 0,
        height: 0,
        createdAt: Date.now(),
      });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const screenRect = canvas.getBoundingClientRect();
    sendAwareness({
      user: currentUser?.login || 'Student',
      cursor: {
        x: e.clientX - screenRect.left,
        y: e.clientY - screenRect.top,
      },
      color: currentColor,
    });

    if (panStart) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (!isDrawing || !activeShape) return;
    const pt = getCanvasCoordinates(e, canvas, pan);

    if (activeShape.type === 'pen' || activeShape.type === 'eraser') {
      setActiveShape((prev) =>
        prev
          ? {
              ...prev,
              points: [...(prev.points || []), pt],
            }
          : null
      );
    } else if (activeShape.x !== undefined && activeShape.y !== undefined) {
      setActiveShape((prev) =>
        prev
          ? {
              ...prev,
              width: pt.x - (prev.x ?? 0),
              height: pt.y - (prev.y ?? 0),
            }
          : null
      );
    }
  };

  const handlePointerUp = () => {
    if (panStart) {
      setPanStart(null);
      return;
    }
    if (isDrawing && activeShape) {
      addShape(activeShape);
      setActiveShape(null);
      setIsDrawing(false);
    }
  };

  const handleConfirmText = (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingTextPos && textInputVal.trim()) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      addShape({
        id,
        type: 'text',
        color: currentColor,
        strokeWidth: currentStrokeWidth,
        x: pendingTextPos.x,
        y: pendingTextPos.y,
        text: textInputVal.trim(),
        createdAt: Date.now(),
      });
    }
    setTextModalOpen(false);
    setPendingTextPos(null);
    setTextInputVal('');
  };

  const handleUndo = () => {
    setShapes((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      const next = prev.slice(0, -1);
      setRedoStack((r) => [...r, last]);
      sendUpdate(encodeShapes(next));
      return next;
    });
  };

  const handleRedo = () => {
    setRedoStack((prevRedo) => {
      if (prevRedo.length === 0) return prevRedo;
      const restored = prevRedo[prevRedo.length - 1];
      const nextRedo = prevRedo.slice(0, -1);
      setShapes((prevShapes) => {
        const updated = [...prevShapes, restored];
        sendUpdate(encodeShapes(updated));
        return updated;
      });
      return nextRedo;
    });
  };

  const handleClear = () => {
    setShapes([]);
    setRedoStack([]);
    sendUpdate(encodeShapes([]));
  };

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `whiteboard-${documentId.slice(0, 8)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-8rem)] gap-4">
      {/* Header Bar */}
      {!hideHeader && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-on-surface tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[28px]">draw</span>
              Collaborative Whiteboard
            </h1>
            <p className="text-xs text-on-surface-variant">
              Real-time team architecture canvas, flowcharts &amp; design notes
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Active Peers Count */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container text-xs font-medium text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px]">group</span>
              <span>{peers.size + 1} active</span>
            </div>

            {/* Connection Status Badge */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                isConnected
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              {isConnected ? 'Live Sync' : 'Local Mode'}
            </div>
          </div>
        </div>
      )}

      {/* Drawing Toolbar */}
      <Toolbar
        currentTool={currentTool}
        onSelectTool={setCurrentTool}
        currentColor={currentColor}
        onSelectColor={setCurrentColor}
        currentStrokeWidth={currentStrokeWidth}
        onSelectStrokeWidth={setCurrentStrokeWidth}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
        onExport={handleExport}
        canUndo={shapes.length > 0}
        canRedo={redoStack.length > 0}
      />

      {/* Interactive Canvas Stage */}
      <CanvasStage
        canvasRef={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onResize={renderCanvas}
      >
        <RemoteCursors peers={peers} />
      </CanvasStage>

      {/* Custom Text Input Modal */}
      {textModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={() => setTextModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-surface-container-lowest border border-outline-variant p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-on-surface mb-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">text_fields</span>
              Add Text Note
            </h3>
            <p className="text-xs text-on-surface-variant mb-4">
              Type the label or note to place on the canvas.
            </p>
            <form onSubmit={handleConfirmText} className="space-y-4">
              <input
                id="whiteboard-text-note-input"
                name="whiteboard-text-note"
                type="text"
                autoFocus
                value={textInputVal}
                onChange={(e) => setTextInputVal(e.target.value)}
                placeholder="Enter text..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-sm text-on-surface focus:outline-none focus:border-primary"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTextModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!textInputVal.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-on-primary hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer"
                >
                  Place Text
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
