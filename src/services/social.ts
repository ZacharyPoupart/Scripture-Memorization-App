// The network side of friends and guilds: small JSON calls to /api/social/<action>. Everything is optional and fails
// quietly: with no connection (or no server set up) the app works exactly as before.
import type { Cheer, FriendCard, GuildView, Snapshot } from '../core/social.ts';

export type SocialErrorCode = 'offline' | 'not-configured' | 'forbidden' | 'not-found' | 'full' | 'own-code' | 'server';

export class SocialError extends Error {
  constructor(
    public code: SocialErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const WORDS: Record<SocialErrorCode, string> = {
  offline: 'No connection right now. Try again when you are online.',
  'not-configured': 'Friends are not switched on for this app yet.',
  forbidden: 'Something is out of date on this device. Try turning friends off and on again.',
  'not-found': 'That code did not work. It may have expired, so ask for a new one.',
  full: 'That group is full, or you are already in 3 groups.',
  'own-code': 'That is your own code. Send it to a friend instead.',
  server: 'Something went wrong. Please try again in a moment.',
};

export const socialMessage = (e: unknown): string => (e instanceof SocialError ? WORDS[e.code] : WORDS.server);

type Fetch = typeof fetch;

export async function socialCall<T>(action: string, body: object, fetchFn: Fetch = fetch): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12_000);
  let res: Response;
  try {
    res = await fetchFn(`/api/social/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
  } catch {
    throw new SocialError('offline', WORDS.offline);
  } finally {
    clearTimeout(timer);
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* not JSON: handled below */
  }
  if (res.ok) return data as T;
  const code: SocialErrorCode =
    res.status === 501 || (res.status === 404 && !data?.error)
      ? 'not-configured'
      : res.status === 403
        ? 'forbidden'
        : res.status === 404
          ? 'not-found'
          : res.status === 409
            ? 'full'
            : data?.error === 'own-code'
              ? 'own-code'
              : 'server';
  throw new SocialError(code, WORDS[code]);
}

export interface Auth {
  id: string;
  secret: string;
}

export const api = {
  profile: (a: Auth, name: string, snap: Snapshot) => socialCall<{ ok: true; changed: boolean }>('profile', { ...a, name, snap }),
  invite: (a: Auth) => socialCall<{ code: string; expiresAt: number }>('invite', a),
  inviteInfo: (code: string) => socialCall<{ name: string }>('invite-info', { code }),
  accept: (a: Auth, code: string) => socialCall<{ friend: FriendCard }>('accept', { ...a, code }),
  friends: (a: Auth) => socialCall<{ friends: FriendCard[]; cheers: Cheer[] }>('friends', a),
  cheer: (a: Auth, friendId: string) => socialCall<{ ok: true; already?: boolean }>('cheer', { ...a, friendId }),
  unfriend: (a: Auth, friendId: string) => socialCall<{ ok: true }>('unfriend', { ...a, friendId }),
  remove: (a: Auth) => socialCall<{ ok: true }>('delete', a),
  guilds: (a: Auth) => socialCall<{ guilds: GuildView[] }>('guilds', a),
  guildCreate: (a: Auth, name: string) => socialCall<{ gid: string }>('guild-create', { ...a, name }),
  guildInvite: (a: Auth, gid: string) => socialCall<{ code: string; expiresAt: number }>('guild-invite', { ...a, gid }),
  guildInfo: (code: string) => socialCall<{ name: string; members: number }>('guild-info', { code }),
  guildJoin: (a: Auth, code: string) => socialCall<{ gid: string }>('guild-join', { ...a, code }),
  guildBanner: (a: Auth, gid: string, banner: string) => socialCall<{ ok: true }>('guild-banner', { ...a, gid, banner }),
  guildRename: (a: Auth, gid: string, name: string) => socialCall<{ ok: true }>('guild-rename', { ...a, gid, name }),
  guildLeave: (a: Auth, gid: string) => socialCall<{ ok: true }>('guild-leave', { ...a, gid }),
};
