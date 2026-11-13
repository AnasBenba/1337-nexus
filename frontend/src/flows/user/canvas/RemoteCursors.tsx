import React from 'react';
import type { RemotePeer } from './types';

export interface RemoteCursorsProps {
  peers: Map<string, RemotePeer>;
}

export const RemoteCursors: React.FC<RemoteCursorsProps> = ({ peers }) => {
  if (peers.size === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-20">
      {Array.from(peers.entries()).map(([sid, peer]) => (
        <div
          key={sid}
          className="absolute flex items-start gap-1 transition-transform duration-75 ease-out"
          style={{
            transform: `translate(${peer.cursor.x}px, ${peer.cursor.y}px)`,
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
      ))}
    </div>
  );
};

