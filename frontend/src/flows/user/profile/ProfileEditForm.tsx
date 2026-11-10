import React, { useState, type FormEvent } from 'react';
import type { ProfileUpdate } from './api';

const NAME_MAX = 100;
const BIO_MAX = 500;

type Props = {
  user: { fullname: string; bio: string | null };
  /** Saves the change (my profile or, for admins, someone else's). Throw to show an error. */
  save: (data: ProfileUpdate) => Promise<void>;
  onCancel: () => void;
  /** Keeps input ids unique if several forms exist on a page. */
  idPrefix?: string;
};

export const ProfileEditForm: React.FC<Props> = ({ user, save, onCancel, idPrefix = 'profile' }) => {
  const [fullname, setFullname] = useState(user.fullname);
  const [bio, setBio] = useState(user.bio ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Same rules as the backend's ProfileUpdate schema.
  const nameError = fullname.trim() === '' ? 'Name is required.' : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (nameError) return;
    setSaving(true);
    setError(null);
    try {
      await save({ fullname: fullname.trim(), bio: bio.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the profile.');
    } finally {
      setSaving(false);
    }
  };

  const fieldClass =
    'w-full rounded bg-surface-container-low px-space-md py-space-sm text-on-surface outline-none ring-1 ring-transparent focus:ring-primary-container';

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
          placeholder="What are you building? What stack do you like?"
          aria-describedby={`${idPrefix}-bio-count`}
          onChange={(e) => setBio(e.target.value)}
        />
        <p id={`${idPrefix}-bio-count`} className="text-right text-[11px] text-on-surface-variant">
          {bio.length}/{BIO_MAX}
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded bg-error-container px-space-md py-space-sm text-[13px] text-on-error-container">
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
