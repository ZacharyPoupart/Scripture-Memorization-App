import { useEffect, useState } from 'preact/hooks';
import { currentLook, defaultLook, GUILD_WIN_COINS, type Look } from '../core/avatar.ts';
import { cleanName, cheerLine, codeFrom, formatCode, guildLink, inviteLink, inviteMessage, MAX_GUILD_NAME, MAX_NAME, type FriendCard, type GuildView } from '../core/social.ts';
import { api, socialMessage } from '../services/social.ts';
import { navigate } from '../router.ts';
import {
  acceptFriend,
  createGuild,
  enableSharing,
  joinGuild,
  leaveGuild,
  makeGuildInvite,
  makeInvite,
  refreshSocial,
  cheerFriend,
  removeFriend,
  renameSharing,
  showToast,
  stopSharing,
  useApp,
} from '../store.ts';
import { AvatarFigure } from './AvatarFigure.tsx';
import { Coin, Confirm, Icon, Overlay, PILE_INFO } from './common.tsx';
import { PILES } from '../core/types.ts';

const faceLook = (look: Record<string, string>): Look => ({ ...defaultLook(), ...look });

/** Send a link with the phone's share sheet when there is one, otherwise copy it. */
async function shareOrCopy(text: string, link: string): Promise<void> {
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ text, url: link });
      return;
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return; // they closed the share sheet: nothing to say
  }
  try {
    await navigator.clipboard.writeText(link);
    showToast('Link copied. Paste it in a message.');
  } catch {
    showToast(link);
  }
}

function Face({ card, size = 48 }: { card: Pick<FriendCard, 'name' | 'snap'>; size?: number }) {
  return <AvatarFigure look={faceLook(card.snap.look)} size={size} view="face" title={`${card.name}'s knight`} />;
}

function Counts({ card }: { card: FriendCard }) {
  return (
    <span class="friend-counts" aria-label={PILES.map((p) => `${card.snap.counts[p]} ${PILE_INFO[p].label}`).join(', ')}>
      {PILES.map((p) => (
        <span key={p} class={`pile-${p}`}>
          <i aria-hidden="true" />
          {card.snap.counts[p]}
        </span>
      ))}
    </span>
  );
}

function FriendRow({ card, cheered, onCheer, onRemove }: { card: FriendCard; cheered: boolean; onCheer: () => void; onRemove: () => void }) {
  return (
    <li class="friend-row" data-testid="friend-row">
      <Face card={card} />
      <div class="friend-main">
        <div class="friend-name" data-testid="friend-name">
          {card.name}
        </div>
        <div class="muted small">
          <span class="friend-streak">
            <Icon name="flame" fill /> {card.snap.streak}
          </span>{' '}
          · {card.snap.week + (card.snap.extra ?? 0)} review{card.snap.week + (card.snap.extra ?? 0) === 1 ? '' : 's'} this week
        </div>
        <Counts card={card} />
      </div>
      <button class={`icon-btn cheer-btn ${cheered ? 'done' : ''}`} aria-label={cheered ? `You cheered ${card.name} today` : `Cheer ${card.name}`} disabled={cheered} onClick={onCheer} data-testid="friend-cheer">
        <span aria-hidden="true">👏</span>
      </button>
      <button class="icon-btn" aria-label={`Options for ${card.name}`} onClick={onRemove} data-testid="friend-menu">
        <Icon name="more" />
      </button>
    </li>
  );
}

/** The code of an invite, big and easy to read out, with ways to send it. */
function InviteSheet({ title, code, link, message, onClose }: { title: string; code: string; link: string; message: string; onClose: () => void }) {
  return (
    <Overlay onClose={onClose} label={title}>
      <div class="sheet stack scrolls" data-testid="invite-sheet">
        <h2>{title}</h2>
        <div class="invite-code" aria-label={`Code ${code.split('').join(' ')}`} data-testid="invite-code">
          {formatCode(code)}
        </div>
        <button class="btn primary block" onClick={() => void shareOrCopy(message, link)} data-testid="invite-share">
          Send the invite
        </button>
        <button
          class="btn block"
          onClick={() => {
            void navigator.clipboard?.writeText(link).then(
              () => showToast('Link copied.'),
              () => showToast(link),
            );
          }}
          data-testid="invite-copy"
        >
          Copy the link
        </button>
        <div class="hint-text">Good for a week.</div>
        <button class="btn ghost block" onClick={onClose}>
          Done
        </button>
      </div>
    </Overlay>
  );
}

function GuildCard({ g, me, onInvite, onLeave }: { g: GuildView; me: string; onInvite: () => void; onLeave: () => void }) {
  const pct = Math.min(100, Math.round((g.progress / Math.max(1, g.goal)) * 100));
  const done = g.progress >= g.goal;
  return (
    <div class="card stack" data-testid="guild-card">
      <div class="row spread">
        <h3 style={{ margin: 0 }} data-testid="guild-name">
          {g.name}
        </h3>
        <span class="muted small">{g.members.length} member{g.members.length === 1 ? '' : 's'}</span>
      </div>
      <div>
        <div class="bar" role="progressbar" aria-valuemin={0} aria-valuemax={g.goal} aria-valuenow={Math.min(g.progress, g.goal)} aria-label="This week's goal">
          <i style={{ width: `${pct}%` }} />
        </div>
        <div class="muted small" style={{ marginTop: '4px' }} data-testid="guild-progress">
          {done ? 'Goal reached this week!' : 'Together this week'}: {g.progress} of {g.goal} reviews
          {!done && g.members.length > 1 && (
            <>
              {' · '}
              <Coin /> {GUILD_WIN_COINS} at the goal
            </>
          )}
        </div>
      </div>
      <ul class="guild-members">
        {g.members.map((m) => (
          <li key={m.id}>
            <Face card={m} size={34} />
            <span class="guild-member-name">
              {m.name}
              {m.id === me ? ' (you)' : ''}
            </span>
            <span class="muted small">{m.snap.weekStart === g.weekStart ? m.snap.week + (m.snap.extra ?? 0) : 0}</span>
          </li>
        ))}
      </ul>
      <div class="row">
        <button class="btn grow" onClick={onInvite} data-testid="guild-invite">
          Invite someone
        </button>
        <button class="btn ghost" onClick={onLeave} data-testid="guild-leave">
          Leave
        </button>
      </div>
    </div>
  );
}

export function Friends({ joinCode = '', guildCode = '' }: { joinCode?: string; guildCode?: string }) {
  const { data, social } = useApp();
  const on = !!data.sharing?.on && !!data.social;
  const [name, setName] = useState(data.sharing?.name ?? '');
  const [editing, setEditing] = useState(false);
  const [invite, setInvite] = useState<{ title: string; code: string; link: string; message: string } | null>(null);
  const [typed, setTyped] = useState('');
  const [guildName, setGuildName] = useState('');
  const [guildTyped, setGuildTyped] = useState('');
  const [removing, setRemoving] = useState<FriendCard | null>(null);
  const [leaving, setLeaving] = useState<GuildView | null>(null);
  const [stopping, setStopping] = useState(false);
  const [localError, setLocalError] = useState('');
  const friendCode = codeFrom(joinCode);
  const inviteGuild = codeFrom(guildCode);
  const [invitedBy, setInvitedBy] = useState('');
  const [invitedGuild, setInvitedGuild] = useState('');
  const origin = location.origin;

  // when this page is opened from an invite link, say who it is from
  useEffect(() => {
    if (!friendCode) return;
    api.inviteInfo(friendCode).then(
      (r) => setInvitedBy(r.name),
      (e) => setLocalError(socialMessage(e)),
    );
  }, [friendCode]);
  useEffect(() => {
    if (!inviteGuild) return;
    api.guildInfo(inviteGuild).then(
      (r) => setInvitedGuild(r.name),
      (e) => setLocalError(socialMessage(e)),
    );
  }, [inviteGuild]);

  // load friends and guilds when the page opens
  useEffect(() => {
    if (on) void refreshSocial();
  }, [on]);

  const clearLink = () => navigate('/friends', true);

  const turnOn = async () => {
    setLocalError('');
    const ok = await enableSharing(name);
    if (!ok) return;
    if (friendCode && invitedBy) await addFriendNow();
    else if (inviteGuild && invitedGuild) await joinGuildNow();
  };

  const addFriendNow = async () => {
    if (!friendCode) return;
    const f = await acceptFriend(friendCode);
    if (f) {
      showToast(`You and ${f.name} are friends now.`);
      clearLink();
    }
  };
  const joinGuildNow = async () => {
    if (!inviteGuild) return;
    if (await joinGuild(inviteGuild)) {
      showToast(`You joined ${invitedGuild}.`);
      clearLink();
    }
  };

  const showInvite = async () => {
    const code = await makeInvite();
    if (!code) return;
    const link = inviteLink(origin, code);
    setInvite({ title: 'Invite a friend', code, link, message: inviteMessage(link, data.sharing?.name ?? '') });
  };
  const showGuildInvite = async (g: GuildView) => {
    const code = await makeGuildInvite(g.id);
    if (!code) return;
    const link = guildLink(origin, code);
    setInvite({ title: `Invite to ${g.name}`, code, link, message: `Join our group "${g.name}" on Memorize For Life, and let's learn Bible verses together: ${link}` });
  };

  const addTyped = async () => {
    const code = codeFrom(typed);
    if (!code) return setLocalError('That does not look like a code. It has 8 letters and numbers, like ABCD-EFGH.');
    setLocalError('');
    const f = await acceptFriend(code);
    if (f) {
      setTyped('');
      showToast(`You and ${f.name} are friends now.`);
    }
  };
  const joinTyped = async () => {
    const code = codeFrom(guildTyped);
    if (!code) return setLocalError('That does not look like a code. It has 8 letters and numbers, like ABCD-EFGH.');
    setLocalError('');
    if (await joinGuild(code)) {
      setGuildTyped('');
      showToast('You joined the group.');
    }
  };

  const error = localError || social.error;

  // ------------------------------------------------------------ not on yet
  if (!on) {
    return (
      <div class="scroll">
        <div class="narrow stack">
          <h1 style={{ margin: 0 }}>Friends</h1>
          {(invitedBy || invitedGuild) && (
            <div class="banner good" data-testid="invited-banner">
              {invitedBy ? `${invitedBy} invited you to be friends.` : `You are invited to join “${invitedGuild}”.`} Turn on friends below to say yes.
            </div>
          )}
          <div class="card stack">
            <div class="hero center">🤝</div>
            <h2 style={{ textAlign: 'center' }}>Learn together</h2>
            <p class="muted" style={{ margin: 0 }}>
              See how your friends’ knights and streaks are growing. Only people you invite can see your name, knight, streak and pile counts. Never your verses.
            </p>
            <label class="field">
              <span class="field-label">Your name</span>
              <input
                class="input"
                value={name}
                maxLength={MAX_NAME}
                placeholder="For example, Sam L."
                autocomplete="given-name"
                onInput={(e) => setName(e.currentTarget.value)}
                data-testid="friends-name"
              />
              <span class="hint-text">Your real name, so your friends know it is you. A first name and last initial is plenty. If you are a child, please ask a parent or guardian before turning this on.</span>
            </label>
            {error && (
              <div class="banner bad" role="alert" data-testid="friends-error">
                {error}
              </div>
            )}
            <button class="btn primary block" disabled={!cleanName(name) || social.busy} onClick={() => void turnOn()} data-testid="friends-on">
              {social.busy ? 'One moment…' : invitedBy ? `Turn on and add ${invitedBy}` : invitedGuild ? `Turn on and join ${invitedGuild}` : 'Turn on friends'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------ on
  const friends = social.friends;
  const guilds = social.guilds;
  return (
    <div class="scroll">
      <div class="narrow stack">
        <h1 style={{ margin: 0 }}>Friends</h1>

        {friendCode && invitedBy && (
          <div class="card stack" data-testid="join-card">
            <div>
              <strong>{invitedBy}</strong> invited you to be friends.
            </div>
            <div class="row">
              <button class="btn primary grow" disabled={social.busy} onClick={() => void addFriendNow()} data-testid="join-yes">
                Add {invitedBy}
              </button>
              <button class="btn ghost" onClick={clearLink}>
                Not now
              </button>
            </div>
          </div>
        )}
        {inviteGuild && invitedGuild && (
          <div class="card stack" data-testid="guild-join-card">
            <div>
              You are invited to join <strong>{invitedGuild}</strong>.
            </div>
            <div class="row">
              <button class="btn primary grow" disabled={social.busy} onClick={() => void joinGuildNow()} data-testid="guild-join-yes">
                Join
              </button>
              <button class="btn ghost" onClick={clearLink}>
                Not now
              </button>
            </div>
          </div>
        )}

        {error && (
          <div class="banner bad" role="alert" data-testid="friends-error">
            {error}{' '}
            <button class="btn small" onClick={() => (setLocalError(''), void refreshSocial())}>
              Try again
            </button>
          </div>
        )}

        {social.cheers.length > 0 && (
          <div class="banner good" data-testid="cheers">
            👏 {cheerLine(social.cheers.map((c) => c.name))}
          </div>
        )}

        <div class="card stack" data-testid="me-card">
          <div class="row" style={{ gap: '12px' }}>
            <AvatarFigure look={currentLook(data)} size={52} view="face" title="Your knight" />
            <div class="grow">
              {editing ? (
                <div class="row">
                  <input class="input grow" value={name} maxLength={MAX_NAME} onInput={(e) => setName(e.currentTarget.value)} aria-label="Your name" data-testid="friends-rename-input" />
                  <button
                    class="btn primary"
                    disabled={!cleanName(name)}
                    onClick={async () => {
                      if (await renameSharing(name)) setEditing(false);
                    }}
                    data-testid="friends-rename-save"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <>
                  <div class="friend-name" data-testid="my-name">
                    {data.sharing?.name}
                  </div>
                  <button class="link-btn" onClick={() => (setName(data.sharing?.name ?? ''), setEditing(true))} data-testid="friends-rename">
                    Change my name
                  </button>
                </>
              )}
            </div>
          </div>
          <button class="btn primary block" disabled={social.busy} onClick={() => void showInvite()} data-testid="friends-invite">
            Invite a friend
          </button>
        </div>

        <section class="stack" aria-label="Your friends">
          <h2 style={{ margin: 0 }}>Friends {friends ? `(${friends.length})` : ''}</h2>
          {friends === null ? (
            <div class="muted" data-testid="friends-loading">
              {social.busy ? 'Loading…' : 'Your friends will show up here.'}
            </div>
          ) : friends.length === 0 ? (
            <div class="card center stack" data-testid="friends-empty">
              <div class="hero">🌱</div>
              <div class="muted">No friends yet.</div>
            </div>
          ) : (
            <ul class="friend-list" data-testid="friend-list">
              {friends.map((f) => (
                <FriendRow key={f.id} card={f} cheered={social.cheered.includes(f.id)} onCheer={() => void cheerFriend(f.id).then((ok) => ok && showToast(`You cheered ${f.name}.`))} onRemove={() => setRemoving(f)} />
              ))}
            </ul>
          )}
          <div class="card stack">
            <label class="field">
              <span class="field-label">Got a code from a friend?</span>
              <div class="row">
                <input
                  class="input grow"
                  value={typed}
                  placeholder="ABCD-EFGH"
                  autocapitalize="characters"
                  autocomplete="off"
                  onInput={(e) => setTyped(e.currentTarget.value)}
                  data-testid="friends-code"
                />
                <button class="btn" disabled={!typed.trim() || social.busy} onClick={() => void addTyped()} data-testid="friends-add">
                  Add
                </button>
              </div>
            </label>
          </div>
        </section>

        <section class="stack" aria-label="Your guilds">
          <h2 style={{ margin: 0 }}>Groups</h2>
          <p class="muted small" style={{ margin: 0 }}>
            A small team with a weekly goal.
          </p>
          {(guilds ?? []).map((g) => (
            <GuildCard key={g.id} g={g} me={data.social!.id} onInvite={() => void showGuildInvite(g)} onLeave={() => setLeaving(g)} />
          ))}
          <div class="card stack">
            <label class="field">
              <span class="field-label">Start a group</span>
              <div class="row">
                <input
                  class="input grow"
                  value={guildName}
                  maxLength={MAX_GUILD_NAME}
                  placeholder="For example, Youth Group"
                  onInput={(e) => setGuildName(e.currentTarget.value)}
                  data-testid="guild-name-input"
                />
                <button
                  class="btn"
                  disabled={!cleanName(guildName, MAX_GUILD_NAME) || social.busy}
                  onClick={async () => {
                    if (await createGuild(guildName)) setGuildName('');
                  }}
                  data-testid="guild-create"
                >
                  Create
                </button>
              </div>
            </label>
            <label class="field">
              <span class="field-label">Join a group with a code</span>
              <div class="row">
                <input
                  class="input grow"
                  value={guildTyped}
                  placeholder="ABCD-EFGH"
                  autocapitalize="characters"
                  autocomplete="off"
                  onInput={(e) => setGuildTyped(e.currentTarget.value)}
                  data-testid="guild-code"
                />
                <button class="btn" disabled={!guildTyped.trim() || social.busy} onClick={() => void joinTyped()} data-testid="guild-join">
                  Join
                </button>
              </div>
            </label>
          </div>
        </section>

        <div class="card stack">
          <h3 style={{ margin: 0 }}>What your friends can see</h3>
          <p class="muted small" style={{ margin: 0 }}>
            Friends see your name, knight, streak, pile counts and this week’s reviews. Never your verses.
          </p>
          <button class="btn ghost" onClick={() => setStopping(true)} data-testid="friends-stop">
            Stop sharing…
          </button>
        </div>
      </div>

      {invite && <InviteSheet {...invite} onClose={() => setInvite(null)} />}
      {removing && (
        <Confirm
          title={`Remove ${removing.name}?`}
          body="You will no longer see each other’s progress."
          confirmLabel="Remove"
          danger
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const f = removing;
            setRemoving(null);
            void removeFriend(f.id).then((ok) => ok && showToast(`Removed ${f.name}.`));
          }}
        />
      )}
      {leaving && (
        <Confirm
          title={`Leave ${leaving.name}?`}
          body="You can join again later with a new invite."
          confirmLabel="Leave"
          danger
          onCancel={() => setLeaving(null)}
          onConfirm={() => {
            const g = leaving;
            setLeaving(null);
            void leaveGuild(g.id).then((ok) => ok && showToast(`You left ${g.name}.`));
          }}
        />
      )}
      {stopping && (
        <Overlay onClose={() => setStopping(false)} label="Stop sharing">
          <div class="sheet stack">
            <h2>Stop sharing?</h2>
            <p class="muted" style={{ margin: 0 }}>
              Friends stop seeing your progress.
            </p>
            <button
              class="btn block"
              onClick={async () => {
                setStopping(false);
                if (await stopSharing(false)) showToast('Sharing is off.');
              }}
              data-testid="friends-stop-keep"
            >
              Just stop sharing
            </button>
            <button
              class="btn block danger"
              onClick={async () => {
                setStopping(false);
                if (await stopSharing(true)) showToast('Your profile, friends and groups were removed.');
              }}
              data-testid="friends-stop-erase"
            >
              Stop and delete my profile
            </button>
            <div class="hint-text">Deleting removes your profile from the server.</div>
            <button class="btn ghost block" onClick={() => setStopping(false)}>
              Cancel
            </button>
          </div>
        </Overlay>
      )}
    </div>
  );
}

