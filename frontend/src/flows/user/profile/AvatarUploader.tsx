import React, { useRef, useState, type ChangeEvent } from 'react';
import type { Me } from '@/app/authentication/login/Auth.api';
import { Avatar } from '@/components/Avatar';
import { deleteAvatar, uploadAvatar } from './api';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024;

type Props = {
  me: Me;
  onChange: (me: Me) => void;
  className: string;
};

export const AvatarUploader: React.FC<Props> = ({ me, onChange, className }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<Me>) => {
    setBusy(true);
    setError(null);
    try {
      onChange(await action());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only PNG, JPEG or WebP images are allowed.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Image must be 2 MB or smaller.');
      return;
    }
    void run(() => uploadAvatar(file));
  };

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="relative">
        <Avatar
          name={me.fullname}
          src={me.avatar_url}
          className={`${className} ${busy ? 'opacity-50' : ''}`}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label="Upload a new avatar"
          title="Upload a new avatar"
          className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-on-primary shadow ring-2 ring-surface-container-lowest hover:bg-primary-container disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">
            {busy ? 'hourglass_empty' : 'photo_camera'}
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          onChange={handleFile}
          className="hidden"
        />
      </div>

      {me.avatar_url && !busy && (
        <button
          type="button"
          onClick={() => void run(deleteAvatar)}
          className="text-[12px] text-on-surface-variant underline-offset-2 hover:text-error hover:underline"
        >
          Remove photo
        </button>
      )}
      {error && (
        <p role="alert" className="max-w-[16rem] text-[12px] text-error">
          {error}
        </p>
      )}
    </div>
  );
};

