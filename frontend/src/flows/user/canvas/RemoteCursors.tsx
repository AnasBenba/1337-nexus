import React, { useRef, useState, useEffect } from 'react';
import type { RemotePeer, Point } from './types';

export interface RemoteCursorsProps {
  peers: Map<string, RemotePeer>;
  pan?: Point;
}

export const RemoteCursors: React.FC<RemoteCursorsProps> = ({
  peers,
  pan = { x: 0, y: 0 },
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });

  // Measure the visible whiteboard box size
  useEffect(() => {
    const updateBounds = () => {
      if (containerRef.current) {
        setBounds({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateBounds();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      observer = new ResizeObserver(updateBounds);
      observer.observe(containerRef.current);
    }

    window.addEventListener('resize', updateBounds);
    return () => {
      window.removeEventListener('resize', updateBounds);
      observer?.disconnect();
    };
  }, [peers.size]);

  if (peers.size === 0) return null;

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 overflow-hidden z-20"
    >
      {Array.from(peers.entries()).map(([sid, peer]) => {
        const screenX = peer.cursor.x + pan.x;
        const screenY = peer.cursor.y + pan.y;

        const { width, height } = bounds;
        const isOffScreen =
          width > 0 &&
          height > 0 &&
          (screenX < 0 || screenX > width || screenY < 0 || screenY > height);

        if (!isOffScreen) {
          return (
            <div
              key={sid}
              className="absolute flex items-start gap-1 transition-transform duration-75 ease-out"
              style={{
                transform: `translate(${screenX}px, ${screenY}px)`,
              }}
            >
              {/* Custom SVG pointer cursor */}
              <svg
                className="w-5 h-5 drop-shadow-md"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M3 3L10.07 19.97L12.58 12.58L19.97 10.07L3 3Z"
                  fill={peer.color || '#2563EB'}
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>

              {/* User Display Name Tag */}
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-md select-none whitespace-nowrap"
                style={{ backgroundColor: peer.color || '#2563EB' }}
              >
                {peer.user}
              </span>
            </div>
          );
        }

        // Off-screen tldraw-style edge direction indicator
        const padX = 72;
        const padY = 28;
        const clampedX = Math.max(12, Math.min(width - padX, screenX));
        const clampedY = Math.max(12, Math.min(height - padY, screenY));
        const angleDeg =
          (Math.atan2(screenY - clampedY, screenX - clampedX) * 180) / Math.PI;

        return (
          <div
            key={sid}
            className="absolute flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-lg select-none whitespace-nowrap transition-transform duration-75 ease-out"
            style={{
              transform: `translate(${clampedX}px, ${clampedY}px)`,
              backgroundColor: peer.color || '#2563EB',
            }}
          >
            <span
              className="inline-block text-[11px] leading-none"
              style={{ transform: `rotate(${angleDeg}deg)` }}
            >
              ➔
            </span>
            <span>{peer.user}</span>
          </div>
        );
      })}
    </div>
  );
};
