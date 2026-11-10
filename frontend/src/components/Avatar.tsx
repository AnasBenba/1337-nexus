import React, { useEffect, useState } from 'react';

function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

type AvatarProps = {
  name: string;
  /** Uploaded image URL; null/undefined shows the default avatar (initials). */
  src?: string | null;
  /** Show a green (online) or grey (offline) dot. Leave undefined for no dot. */
  online?: boolean;
  /** Size, ring, margins etc. Defaults to a 36px circle. */
  className?: string;
};

export const Avatar: React.FC<AvatarProps> = ({ name, src, online, className = 'w-9 h-9 text-[12px]' }) => {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);

  const base = `rounded-full shrink-0 select-none ${className}`;

  const face =
    src && !broken ? (
      <img src={src} alt={name} title={name} onError={() => setBroken(true)} className={`${base} object-cover`} />
    ) : (
      <div
        role="img"
        aria-label={name}
        title={name}
        className={`${base} bg-primary text-on-primary flex items-center justify-center font-bold`}
      >
        {initialsOf(name)}
      </div>
    );

  if (online === undefined) return face;

  return (
    <span className="relative inline-flex shrink-0 rounded-full">
      {face}
      <span
        aria-hidden="true"
        className={`absolute bottom-[4%] right-[4%] h-[26%] w-[26%] min-h-[10px] min-w-[10px] rounded-full ring-2 ring-surface-container-lowest ${
          online ? 'bg-green-500' : 'bg-outline'
        }`}
      />
      <span className="sr-only">{online ? 'Online' : 'Offline'}</span>
    </span>
  );
};
