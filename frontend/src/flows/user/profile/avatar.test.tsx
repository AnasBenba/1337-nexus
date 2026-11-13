import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Me } from '@/app/authentication/login/Auth.api';
import { Avatar } from '@/components/Avatar';
import { AvatarUploader } from './AvatarUploader';
import { deleteAvatar, uploadAvatar } from './api';

const BASE_ME: Me = {
  id: 'a106e47d-3639-45a8-a9c4-132f4cbd5d4f',
  intra_id: null,
  login: 'zoubair',
  fullname: 'Zoubair Bakkas',
  email: 'zoubair@1337.ma',
  bio: null,
  avatar_url: null,
  role: 'user',
  permissions: ['profile:edit_own'],
};

describe('Avatar & AvatarUploader flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders initials when avatar_url is null and updates to <img src> after uploadAvatar resolves', async () => {
    // 1. Before upload: Avatar and AvatarUploader render initials 'ZB' without <img>
    const initialHeaderHtml = renderToStaticMarkup(
      <Avatar name={BASE_ME.fullname} src={BASE_ME.avatar_url} />,
    );
    const initialUploaderHtml = renderToStaticMarkup(
      <AvatarUploader me={BASE_ME} onChange={() => undefined} className="h-24 w-24" />,
    );

    expect(initialHeaderHtml).not.toContain('<img');
    expect(initialHeaderHtml).toContain('>ZB<');
    expect(initialUploaderHtml).not.toContain('Remove photo');

    // 2. Upload avatar via uploadAvatar(file)
    const uploadedUrl = '/media/avatars/a106e47d-3639-45a8-a9c4-132f4cbd5d4f-9329be95f2d5e9ec.webp';
    const updatedMe: Me = {
      ...BASE_ME,
      avatar_url: uploadedUrl,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => updatedMe,
    } as Response);

    const file = new File([new Uint8Array([137, 80, 78, 71])], 'avatar.png', {
      type: 'image/png',
    });
    const resultMe = await uploadAvatar(file);
    expect(resultMe.avatar_url).toBe(uploadedUrl);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/v1/users/me/avatar',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    );

    // 3. After upload: Avatar and AvatarUploader render <img src="/media/avatars/..."> and "Remove photo"
    const updatedHeaderHtml = renderToStaticMarkup(
      <Avatar name={resultMe.fullname} src={resultMe.avatar_url} />,
    );
    const updatedUploaderHtml = renderToStaticMarkup(
      <AvatarUploader me={resultMe} onChange={() => undefined} className="h-24 w-24" />,
    );

    expect(updatedHeaderHtml).toContain(`src="${uploadedUrl}"`);
    expect(updatedHeaderHtml).toContain('referrerPolicy="no-referrer"');
    expect(updatedUploaderHtml).toContain(`src="${uploadedUrl}"`);
    expect(updatedUploaderHtml).toContain('Remove photo');
  });

  it('reverts to initials avatar when deleteAvatar clears avatar_url', async () => {
    const clearedMe: Me = { ...BASE_ME, avatar_url: null };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => clearedMe,
    } as Response);

    const afterDelete = await deleteAvatar();
    expect(afterDelete.avatar_url).toBeNull();

    const html = renderToStaticMarkup(
      <Avatar name={afterDelete.fullname} src={afterDelete.avatar_url} />,
    );
    expect(html).not.toContain('<img');
    expect(html).toContain('>ZB<');
  });
});
