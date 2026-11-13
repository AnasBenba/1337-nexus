import React, { useState } from 'react';
import { addFriend, removeFriend, type FriendStatus } from './api';

type Props = {
  login: string;
  status: FriendStatus;
  onChange: (status: FriendStatus) => void;
};

const primary =
  'flex items-center gap-1 rounded-full bg-primary px-space-md py-space-xs font-label-md text-label-md font-bold text-on-primary hover:bg-primary-container disabled:opacity-50';
const secondary =
  'flex items-center gap-1 rounded-full bg-surface-container px-space-md py-space-xs font-label-md text-label-md text-on-surface hover:bg-surface-container-high disabled:opacity-50';

const Icon = ({ name }: { name: string }) => (
  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
    {name}
  </span>
);

/** The right action(s) for my relationship with `login`. */
export const FriendButton: React.FC<Props> = ({ login, status, onChange }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: (login: string) => Promise<FriendStatus>) => {
    setBusy(true);
    setError(null);
    try {
      onChange(await action(login));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (window.confirm(`Remove @${login} from your friends?`)) void run(removeFriend);
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-space-xs">
        {status === 'none' && (
          <button type="button" className={primary} disabled={busy} onClick={() => void run(addFriend)}>
            <Icon name="person_add" /> Add friend
          </button>
        )}
        {status === 'outgoing' && (
          <button type="button" className={secondary} disabled={busy} onClick={() => void run(removeFriend)}>
            <Icon name="schedule" /> Requested · Cancel
          </button>
        )}
        {status === 'incoming' && (
          <>
            <button type="button" className={primary} disabled={busy} onClick={() => void run(addFriend)}>
              <Icon name="check" /> Accept
            </button>
            <button type="button" className={secondary} disabled={busy} onClick={() => void run(removeFriend)}>
              Decline
            </button>
          </>
        )}
        {status === 'friends' && (
          <>
            <span className="flex items-center gap-1 font-label-md text-label-md text-primary">
              <Icon name="how_to_reg" /> Friends
            </span>
            <button type="button" className={secondary} disabled={busy} onClick={remove}>
              Remove
            </button>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="text-[12px] text-error">
          {error}
        </p>
      )}
    </div>
  );
};
