import React, { useEffect, useRef } from 'react';
import type { Point } from './types';

export interface CanvasStageProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onPointerDown?: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove?: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp?: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerCancel?: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onWheel?: (e: React.WheelEvent<HTMLCanvasElement>) => void;
  onResize?: () => void;
  children?: React.ReactNode;
}

export const CanvasStage: React.FC<CanvasStageProps> = ({
  canvasRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onWheel,
  onResize,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-resize canvas buffer to match container with High-DPI support
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
      onResize?.();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [canvasRef, onResize]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[500px] flex-1 bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-inner overflow-hidden select-none touch-none"
    >
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onWheel={onWheel}
        className="absolute inset-0 cursor-crosshair w-full h-full"
      />
      {children}
    </div>
  );
};

/** Helper to convert browser pointer event to canvas world coordinates */
export function getCanvasCoordinates(
  event: React.PointerEvent<HTMLCanvasElement> | PointerEvent,
  canvas: HTMLCanvasElement,
  pan: Point = { x: 0, y: 0 },
  zoom: number = 1
): Point {
  const rect = canvas.getBoundingClientRect();
  const screenX = event.clientX - rect.left;
  const screenY = event.clientY - rect.top;

  return {
    x: (screenX - pan.x) / zoom,
    y: (screenY - pan.y) / zoom,
  };
}
