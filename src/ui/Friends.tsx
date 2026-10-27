import { useEffect, useState } from 'preact/hooks';
import { currentLook, defaultLook, GUILD_WIN_COINS, matchedSet, type Look } from '../core/avatar.ts';
import { cleanName, cheerLine, codeFrom, formatCode, guildLink, inviteLink, inviteMessage, MAX_GUILD_NAME, MAX_NAME, countdownText, weekEndsAt, type FriendCard, type GuildView } from '../core/social.ts';
import { api, socialMessage } from '../services/social.ts';
import { navigate } from '../router.ts';
import {
  acceptFriend,
  createGuild,
  enableSharing,
  joinGuild,
  leaveGuild,
  transferGuild,
  makeGuildInvite,
  makeInvite,
  refreshSocial,
  cheerFriend,
  removeFriend,
  renameGuild,
  setGuildBanner,
  renameSharing,
  showToast,
  stopSharing,
  useApp,
} from '../store.ts';
import { bannerOf, bannerSpec } from '../core/banner.ts';
import { AvatarFigure } from './AvatarFigure.tsx';
import { BannerEditor, BannerFigure } from './Banner.tsx';
import { Coin, Confirm, Icon, Overlay, PILE_INFO } from './common.tsx';
import { PILES } from '../core/types.ts';

/** Which half of the screen was open last, kept while the app is open (the link to join a group lands on groups). */
let lastTab: 'friends' | 'groups' = 'friends';

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

function FriendRow({ card, cheered, onOpen, onCheer, onRemove }: { card: FriendCard; cheered: boolean; onOpen: () => void; onCheer: () => void; onRemove: () => void }) {
  return (
    <li class="friend-row" data-testid="friend-row">
      <button class="friend-open" onClick={onOpen} aria-label={`See ${card.name}'s knight and stats`} data-testid="friend-open">
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
      </div>
      </button>
      <button class={`icon-btn cheer-btn ${cheered ? 'done' : ''}`} aria-label={cheered ? `You cheered ${card.name} today` : `Cheer ${card.name}`} disabled={cheered} onClick={onCheer} data-testid="friend-cheer">
        <span aria-hidden="true">👏</span>
      </button>
      <button class="icon-btn" aria-label={`Options for ${card.name}`} onClick={onRemove} data-testid="friend-menu">
        <Icon name="more" />
      </button>
    </li>
  );
}

/** One friend up close: the whole suit of armor, their streaks and numbers, and the groups you share. */
function FriendSheet({ card, groups, cheered, onCheer, onClose }: { card: FriendCard; groups: GuildView[]; cheered: boolean; onCheer?: () => void; onClose: () => void }) {
  const look = faceLook(card.snap.look);
  const set = matchedSet(look);
  const week = card.snap.week + (card.snap.extra ?? 0);
  return (
    <Overlay onClose={onClose} label={`${card.name}'s knight`}>
      <div class="sheet stack scrolls center" data-testid="friend-sheet">
        <div class="friend-figure">
          <AvatarFigure look={look} size={220} title={`${card.name}'s knight`} />
        </div>
        <div>
          <h2 style={{ margin: 0 }} data-testid="friend-sheet-name">
            {card.name}
          </h2>
          {set && (
            <div class="muted small" data-testid="friend-sheet-set">
              {set.name} set
            </div>
          )}
        </div>
        <dl class="friend-stats">
          <div>
            <dt>Streak</dt>
            <dd data-testid="friend-sheet-streak">
              <Icon name="flame" fill /> {card.snap.streak}
            </dd>
          </div>
          <div>
            <dt>Longest</dt>
            <dd data-testid="friend-sheet-longest">{card.snap.longest}</dd>
          </div>
          <div>
            <dt>This week</dt>
            <dd data-testid="friend-sheet-week">{week}</dd>
          </div>
        </dl>
        <div class="friend-figure">
          <Counts card={card} />
        </div>
        <div class="friend-groups" data-testid="friend-sheet-groups">
          {groups.length ? (
            <>
              <div class="muted small">In a group together</div>
              {groups.map((g) => (
                <div key={g.id} class="friend-group-name row" style={{ gap: '8px', justifyContent: 'center' }}>
                  <BannerFigure banner={bannerOf(g)} size={20} title={`${g.name} banner`} />
                  {g.name}
                </div>
              ))}
            </>
          ) : (
            <div class="muted small">No group together</div>
          )}
        </div>
        {onCheer && (
          <button class="btn block" disabled={cheered} onClick={onCheer} data-testid="friend-sheet-cheer">
            {cheered ? 'Cheered today' : `👏 Cheer ${card.name}`}
          </button>
        )}
        <button class="btn ghost block" onClick={onClose}>
          Done
        </button>
      </div>
    </Overlay>
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

/** What leaving a group means: if you lead it, who takes over (the member who has been in it longest). */
function leavingBody(g: GuildView, me: string): string {
  const heir = g.owner === me ? g.members.find((m) => m.id === g.heir) : undefined;
  return heir ? `${heir.name}, who has been in the group longest, will lead it. You can join again later with a new invite.` : 'You can join again later with a new invite.';
}

function GuildCard({ g, me, onInvite, onLeave, onTransfer, onOpenMember }: { g: GuildView; me: string; onInvite: () => void; onLeave: () => void; onTransfer: () => void; onOpenMember: (m: FriendCard) => void }) {
  const [renaming, setRenaming] = useState(false);
  const [designing, setDesigning] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [title, setTitle] = useState(g.name);
  const pct = Math.min(100, Math.round((g.progress / Math.max(1, g.goal)) * 100));
  const done = g.progress >= g.goal;
  const leader = g.members.find((m) => m.id === g.owner);
  const isLeader = g.owner === me;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  return (
    <div class="card stack" data-testid="guild-card">
      {renaming ? (
        <div class="row">
          <input class="input grow" value={title} maxLength={MAX_GUILD_NAME} onInput={(e) => setTitle(e.currentTarget.value)} aria-label="Group name" data-testid="guild-rename-input" />
          <button
            class="btn primary"
            disabled={!cleanName(title, MAX_GUILD_NAME)}
            onClick={async () => {
              if (await renameGuild(g.id, title)) setRenaming(false);
            }}
            data-testid="guild-rename-save"
          >
            Save
          </button>
        </div>
      ) : (
        <div class="row" style={{ gap: '10px', minWidth: 0 }}>
          <BannerFigure banner={bannerOf(g)} size={34} title={`${g.name} banner`} />
          <div class="grow" style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0 }} data-testid="guild-name">
              {g.name}
            </h3>
            <div class="muted small">
              <span data-testid="guild-leader">Led by {leader ? (leader.id === me ? 'you' : leader.name) : 'the leader'}</span> · {g.members.length} member{g.members.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>
      )}
      {designing && <BannerEditor initial={bannerOf(g)} onSave={(b) => setGuildBanner(g.id, bannerSpec(b))} onClose={() => setDesigning(false)} />}
      <div>
        <div class="bar" role="progressbar" aria-valuemin={0} aria-valuemax={g.goal} aria-valuenow={Math.min(g.progress, g.goal)} aria-valuetext={`${g.progress} of ${g.goal} reviews`} aria-label="This week's goal">
          <i style={{ width: `${pct}%` }} />
        </div>
        <div class="small guild-progress-line" data-testid="guild-progress">
          {done ? 'Goal reached this week!' : 'Together this week'}: {g.progress} of {g.goal} reviews
        </div>
        <div class="muted small guild-reward" data-testid="guild-reward">
          {g.members.length > 1 && (
            <>
              <Coin /> {GUILD_WIN_COINS} each at the goal
              {' · '}
            </>
          )}
          <span data-testid="guild-countdown">{countdownText(weekEndsAt(g.weekStart) - now)}</span>
        </div>
      </div>
      <div class="row">
        <button class="btn primary grow" onClick={onInvite} data-testid="guild-invite">
          Invite someone
        </button>
        <button class="btn" aria-expanded={membersOpen} aria-controls={`members-${g.id}`} onClick={() => setMembersOpen(!membersOpen)} data-testid="guild-members-toggle">
          Members
        </button>
        <button class="icon-btn" aria-label={`More for ${g.name}`} aria-expanded={moreOpen} aria-controls={`more-${g.id}`} onClick={() => setMoreOpen(!moreOpen)} data-testid="guild-more">
          <Icon name="more" />
        </button>
      </div>
      {membersOpen && (
        <ul class="guild-members" id={`members-${g.id}`} data-testid="guild-members">
          {g.members.map((m) => (
            <li key={m.id}>
              <button class="guild-member-btn" onClick={() => onOpenMember(m)} aria-label={`${m.name}${m.id === g.owner ? ', leader' : ''}${m.id === me ? ', you' : ''}. See their knight.`} data-testid="guild-member">
                <Face card={m} size={34} />
                <span class="guild-member-name">
                  {m.name}
                  {m.id === me ? ' (you)' : ''}
                  {m.id === g.owner && <span class="leader-tag"> · Leader</span>}
                </span>
                <span class="muted small guild-member-streak">
                  <Icon name="flame" fill /> {m.snap.streak}
                </span>
                <span class="guild-member-week" title="Reviews this week">
                  {m.snap.weekStart === g.weekStart ? m.snap.week + (m.snap.extra ?? 0) : 0}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {moreOpen && (
        <div class="stack more-panel" id={`more-${g.id}`} style={{ '--gap': '4px' } as never}>
          {isLeader && !renaming && (
            <button class="menu-item" onClick={() => (setTitle(g.name), setRenaming(true), setMoreOpen(false))} data-testid="guild-rename">
              Rename group
            </button>
          )}
          {isLeader && (
            <button class="menu-item" onClick={() => (setDesigning(true), setMoreOpen(false))} data-testid="guild-banner-edit">
              Edit banner
            </button>
          )}
          {isLeader && g.members.length > 1 && (
            <button class="menu-item" onClick={() => (setMoreOpen(false), onTransfer())} data-testid="guild-transfer">
              Choose a new leader
            </button>
          )}
          <button class="menu-item danger" onClick={onLeave} data-testid="guild-leave">
            Leave group
          </button>
        </div>
      )}
    </div>
  );
}

/** The two halves of this screen: your friends, and your groups. One at a time keeps each short. */
function Segments({ tab, onTab, friends, groups }: { tab: 'friends' | 'groups'; onTab: (t: 'friends' | 'groups') => void; friends: number | null; groups: number | null }) {
  const items = [
    { id: 'friends' as const, label: 'Friends', n: friends },
    { id: 'groups' as const, label: 'Groups', n: groups },
  ];
  const move = (e: KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : items.length - 1)) % items.length;
    onTab(items[next].id);
    (document.getElementById(`seg-${items[next].id}`) as HTMLElement | null)?.focus();
  };
  return (
    <div class="seg" role="tablist" aria-label="Friends or groups">
      {items.map((it, i) => (
        <button
          key={it.id}
          id={`seg-${it.id}`}
          role="tab"
          class={`seg-tab ${tab === it.id ? 'on' : ''}`}
          aria-selected={tab === it.id}
          aria-controls={`panel-${it.id}`}
          tabIndex={tab === it.id ? 0 : -1}
          onClick={() => onTab(it.id)}
          onKeyDown={(e) => move(e, i)}
          data-testid={`friends-tab-${it.id}`}
        >
          {it.label}
          {it.n !== null && it.n > 0 ? ` (${it.n})` : ''}
        </button>
      ))}
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
  const [opened, setOpened] = useState<string | null>(null);
  const [tab, setTabState] = useState<'friends' | 'groups'>(guildCode ? 'groups' : lastTab);
  const setTab = (t: 'friends' | 'groups') => {
    lastTab = t;
    setTabState(t);
  };
  const [meOpen, setMeOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [openedMember, setOpenedMember] = useState<FriendCard | null>(null);
  const [leaving, setLeaving] = useState<GuildView | null>(null);
  const [pickingLeader, setPickingLeader] = useState<GuildView | null>(null);
  const [newLeader, setNewLeader] = useState<FriendCard | null>(null);
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
      setTab('groups');
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

        <div class="me-row" data-testid="me-card">
          <AvatarFigure look={currentLook(data)} size={44} view="face" title="Your knight" />
          <div class="friend-name grow" data-testid="my-name">
            {data.sharing?.name}
          </div>
          <button class="btn" aria-expanded={meOpen} aria-controls="me-panel" onClick={() => setMeOpen(!meOpen)} data-testid="friends-settings">
            Your sharing
          </button>
        </div>
        {meOpen && (
          <div class="card stack" id="me-panel" data-testid="me-panel">
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
              <button class="menu-item" onClick={() => (setName(data.sharing?.name ?? ''), setEditing(true))} data-testid="friends-rename">
                Change my name
              </button>
            )}
            <p class="muted small" style={{ margin: 0 }}>
              Friends see your name, knight, streak, pile counts and this week’s reviews. Never your verses.
            </p>
            <button class="menu-item danger" onClick={() => setStopping(true)} data-testid="friends-stop">
              Stop sharing…
            </button>
          </div>
        )}

        <Segments tab={tab} onTab={setTab} friends={friends ? friends.length : null} groups={guilds ? guilds.length : null} />

        {tab === 'friends' && (
          <section class="stack" id="panel-friends" role="tabpanel" aria-labelledby="seg-friends">
            <button class="btn primary block" disabled={social.busy} onClick={() => void showInvite()} data-testid="friends-invite">
              Invite a friend
            </button>
            {friends === null ? (
              <div class="muted" data-testid="friends-loading" role="status">
                {social.busy ? 'Loading…' : 'Your friends will show up here.'}
              </div>
            ) : friends.length === 0 ? (
              <div class="card center stack" data-testid="friends-empty">
                <div class="hero" aria-hidden="true">
                  🌱
                </div>
                <div class="muted">No friends yet. Invite someone, or add a code below.</div>
              </div>
            ) : (
              <ul class="friend-list" data-testid="friend-list">
                {friends.map((f) => (
                  <FriendRow key={f.id} card={f} cheered={social.cheered.includes(f.id)} onOpen={() => setOpened(f.id)} onCheer={() => void cheerFriend(f.id).then((ok) => ok && showToast(`You cheered ${f.name}.`))} onRemove={() => setRemoving(f)} />
                ))}
              </ul>
            )}
            {friends && friends.length > 0 && (
              <button class="link-btn" aria-expanded={codeOpen} aria-controls="friend-code-row" onClick={() => setCodeOpen(!codeOpen)} data-testid="friends-code-toggle">
                Got a code from a friend?
              </button>
            )}
            {(codeOpen || !friends || friends.length === 0) && (
              <div class="card stack" id="friend-code-row">
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
            )}
          </section>
        )}

        {tab === 'groups' && (
          <section class="stack" id="panel-groups" role="tabpanel" aria-labelledby="seg-groups">
            {(guilds ?? []).length === 0 && (
              <p class="muted small" style={{ margin: 0 }}>
                A small team with a weekly goal. Start one, or join with a code.
              </p>
            )}
            {(guilds ?? []).map((g) => (
              <GuildCard key={g.id} g={g} me={data.social!.id} onInvite={() => void showGuildInvite(g)} onLeave={() => setLeaving(g)} onTransfer={() => setPickingLeader(g)} onOpenMember={(m) => setOpenedMember(m)} />
            ))}
            {(guilds ?? []).length > 0 && (
              <button class="link-btn" aria-expanded={addOpen} aria-controls="guild-add" onClick={() => setAddOpen(!addOpen)} data-testid="guild-add-toggle">
                Start or join another group
              </button>
            )}
            {(addOpen || (guilds ?? []).length === 0) && (
              <div class="card stack" id="guild-add">
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
            )}
          </section>
        )}
      </div>

      {invite && <InviteSheet {...invite} onClose={() => setInvite(null)} />}
      {opened && friends?.find((f) => f.id === opened) && (
        <FriendSheet
          card={friends.find((f) => f.id === opened)!}
          groups={(guilds ?? []).filter((g) => g.members.some((m) => m.id === opened))}
          cheered={social.cheered.includes(opened)}
          onCheer={() => void cheerFriend(opened).then((ok) => ok && showToast(`You cheered ${friends.find((f) => f.id === opened)?.name}.`))}
          onClose={() => setOpened(null)}
        />
      )}
      {openedMember && (
        <FriendSheet
          card={openedMember}
          groups={(guilds ?? []).filter((g) => g.members.some((m) => m.id === openedMember.id))}
          cheered={social.cheered.includes(openedMember.id)}
          onCheer={
            openedMember.id !== data.social!.id && friends?.some((f) => f.id === openedMember.id)
              ? () => void cheerFriend(openedMember.id).then((ok) => ok && showToast(`You cheered ${openedMember.name}.`))
              : undefined
          }
          onClose={() => setOpenedMember(null)}
        />
      )}
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
      {pickingLeader && !newLeader && (
        <Overlay onClose={() => setPickingLeader(null)} label="Choose a new leader">
          <div class="sheet stack scrolls" data-testid="leader-picker">
            <h2>Choose a new leader</h2>
            <p class="muted small" style={{ margin: 0 }}>
              The leader can rename the group and design its banner. You stay in the group.
            </p>
            <ul class="guild-members" style={{ margin: 0 }}>
              {pickingLeader.members
                .filter((m) => m.id !== data.social!.id)
                .map((m) => (
                  <li key={m.id}>
                    <button class="guild-member-btn" onClick={() => setNewLeader(m)} data-testid="leader-option">
                      <Face card={m} size={34} />
                      <span class="guild-member-name">
                        {m.name}
                        {m.id === pickingLeader.heir && <span class="leader-tag"> · here longest</span>}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
            <button class="btn ghost block" onClick={() => setPickingLeader(null)}>
              Cancel
            </button>
          </div>
        </Overlay>
      )}
      {pickingLeader && newLeader && (
        <Confirm
          title={`Make ${newLeader.name} the leader?`}
          body="They will be able to rename the group and design its banner. You stay in the group."
          confirmLabel="Make leader"
          onCancel={() => setNewLeader(null)}
          onConfirm={() => {
            const g = pickingLeader;
            const m = newLeader;
            setNewLeader(null);
            setPickingLeader(null);
            void transferGuild(g.id, m.id).then((ok) => ok && showToast(`${m.name} leads ${g.name} now.`));
          }}
        />
      )}
      {leaving && (
        <Confirm
          title={`Leave ${leaving.name}?`}
          body={leavingBody(leaving, data.social!.id)}
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

