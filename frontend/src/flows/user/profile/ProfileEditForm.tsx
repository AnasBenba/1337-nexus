import React, { useState, type FormEvent } from 'react';
import type { ProfileUpdate } from './api';

const NAME_MAX = 100;
const BIO_MAX = 500;

type Props = {
  user: { fullname: string; bio?: string | null };
  save: (data: ProfileUpdate) => Promise<void>;
  onCancel: () => void;
  idPrefix?: string;
};

export const ProfileEditForm: React.FC<Props> = ({
  user,
  save,
  onCancel,
  idPrefix = 'profile',
}) => {
  const [fullname, setFullname] = useState(user.fullname);
  const [bio, setBio] = useState(user.bio ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const nameError = fullname.trim() === '' ? 'Display name is required.' : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (nameError) return;
    setSaving(true);
    setError(null);
    try {
      await save({ fullname: fullname.trim(), bio: bio.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile changes.');
    } finally {
      setSaving(false);
    }
  };

  const fieldClass =
    'w-full rounded-xl bg-surface-container-low px-4 py-2.5 text-on-surface outline-none ring-1 ring-outline-variant/40 focus:ring-primary-container';

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-space-md">
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idPrefix}-fullname`} className="font-label-md text-label-md font-bold">
          Display name
        </label>
        <input
          id={`${idPrefix}-fullname`}
          className={fieldClass}
          value={fullname}
          maxLength={NAME_MAX}
          required
          aria-invalid={nameError !== null}
          aria-describedby={nameError ? `${idPrefix}-fullname-error` : undefined}
          onChange={(e) => setFullname(e.target.value)}
        />
        {nameError && (
          <p id={`${idPrefix}-fullname-error`} className="text-[12px] text-error">
            {nameError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${idPrefix}-bio`} className="font-label-md text-label-md font-bold">
          Bio
        </label>
        <textarea
          id={`${idPrefix}-bio`}
          className={`${fieldClass} min-h-[110px] resize-y`}
          value={bio}
          maxLength={BIO_MAX}
          placeholder="What are you building? What stack do you enjoy?"
          aria-describedby={`${idPrefix}-bio-count`}
          onChange={(e) => setBio(e.target.value)}
        />
        <p id={`${idPrefix}-bio-count`} className="text-right text-[11px] text-on-surface-variant">
          {bio.length}/{BIO_MAX}
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-error-container px-4 py-2.5 text-[13px] text-on-error-container"
        >
          {error}
        </p>
      )}

      <div className="flex justify-end gap-space-sm">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-space-lg py-space-sm text-on-surface-variant hover:bg-surface-container"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || nameError !== null}
          className="rounded-full bg-primary px-space-lg py-space-sm font-bold text-on-primary disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
};

