import { dayKeyOf, formatDuration } from "../core/dates.ts";
import { formatRef } from "../core/reference.ts";
import { nextReviewInfo } from "../core/today.ts";
import {
  daysUntilFreeze,
  isFrozen,
  isPaused,
  liveVerses,
  pileVerses,
  streakInfo,
  todaySummary,
  verseStatus,
} from "../core/schedule.ts";
import { PILES } from "../core/types.ts";
import { navigate } from "../router.ts";
import { shouldNudgeBackup } from "../core/nudges.ts";
import { currentLook, seedsBalance } from "../core/avatar.ts";
import { downloadBackup, stopBreak, updateSettings, useApp } from "../store.ts";
import { AvatarFigure } from "./AvatarFigure.tsx";
import { Icon, PILE_INFO } from "./common.tsx";
import { ModePicker } from "./ModePicker.tsx";

export function Home() {
  const { data, settings, online } = useApp();
  const now = Date.now();
  const verses = liveVerses(data);
  const today = todaySummary(data, now);
  const streak = streakInfo(data, now);
  const onBreak = isPaused(data, dayKeyOf(now));
  const frozen = isFrozen(data, now) && verses.length > 0 && !onBreak;
  const untilFreeze = daysUntilFreeze(data, now);
  const readyAll = verses.filter(
    (v) => verseStatus(data, v, now).state === "ready",
  ).length;
  const pct = today.total ? Math.round((today.met / today.total) * 100) : 100;
  const todayList = verses
    .map((v) => ({ v, s: verseStatus(data, v, now) }))
    .filter(
      ({ v, s }) =>
        s.state === "ready" ||
        s.state === "waiting" ||
        (s.state === "done" && v.pile === "daily") ||
        (s.countedToday > 0 && v.pile !== "daily"),
    );
  const next = nextReviewInfo(data, now);
  const nextText =
    next.kind === "soon"
      ? `Next review in ${formatDuration(next.waitMs)}.`
      : next.kind === "day"
        ? next.daysAway <= 1
          ? "Next review: tomorrow."
          : `Next review: ${new Date(next.day + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}.`
        : "";
  const breakEnds = data.pause
    ? new Date(data.pause.until + "T12:00:00").toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      })
    : "";
  const headline = onBreak
    ? "On a break"
    : readyAll > 0
      ? `${readyAll} verse${readyAll === 1 ? "" : "s"} to review`
      : todayList.some(({ s }) => s.state === "waiting")
        ? "Done for now"
        : today.outcome === "c" || today.total > 0 || todayList.length > 0
          ? "All done for today!"
          : "Nothing due today";
  const subline = onBreak
    ? `Until ${breakEnds}. Your streak and progress are resting; nothing is lost. Review any time you like.`
    : readyAll > 0
      ? today.remaining > readyAll
        ? `${today.remaining - readyAll} more unlock later today`
        : "Aim for three a day; one keeps your streak."
      : [
          streak.count > 0
            ? `Streak ${streak.count} day${streak.count === 1 ? "" : "s"}.`
            : "",
          nextText,
        ]
          .filter(Boolean)
          .join(" ") || "Newly added verses are optional on their first day.";
  const hour = new Date(now).getHours();
  const greet =
    hour < 5
      ? "Still up?"
      : hour < 12
        ? "Good morning"
        : hour < 18
          ? "Good afternoon"
          : "Good evening";

  if (!verses.length) {
    return (
      <div class="scroll">
        <div class="narrow stack">
          <h1>Memorize For Life</h1>
          <div class="card center stack" data-testid="empty-home">
            <div class="hero">📖</div>
            <h2>Add your first verse</h2>
            <p class="muted">
              Pick a verse, and it will be in your Daily pile. Review it three
              times a day and it will become part of you.
            </p>
            <button class="btn primary block" onClick={() => navigate("/add")}>
              Add a verse
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div class="scroll">
        <div class="narrow stack">
          <div class="row spread">
            <div>
              <div class="muted small">
                {new Date(now).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </div>
              <h1>{greet}</h1>
              {!online && (
                <div
                  class="offline-note small muted"
                  data-testid="offline-note"
                >
                  Offline. Reviewing and your progress all work as normal.
                </div>
              )}
            </div>
            <div class="row" style={{ gap: "8px" }}>
              {settings.avatarOn && (
                <button
                  class="avatar-bubble"
                  onClick={() => navigate("/avatar")}
                  aria-label={`Your avatar. ${seedsBalance(data)} seeds.`}
                  data-testid="avatar-bubble"
                >
                  <AvatarFigure
                    look={currentLook(data)}
                    size={44}
                    view="face"
                  />
                  <span class="seeds-chip" data-testid="seeds-chip">
                    🌱 {seedsBalance(data)}
                  </span>
                </button>
              )}
              <button
                class="streak"
                title={`Longest streak: ${streak.longest}`}
                aria-label={`Streak: ${streak.count} day${streak.count === 1 ? "" : "s"}. Open progress.`}
                onClick={() => navigate("/stats")}
                data-testid="streak"
              >
                <Icon name="flame" fill />
                <span>{streak.count}</span>
                {streak.longest > streak.count && (
                  <small class="streak-best">best {streak.longest}</small>
                )}
              </button>
            </div>
          </div>

          {frozen && (
            <div class="banner" data-testid="freeze-banner">
              <strong>Progress is paused.</strong> You've gone more than 3 days
              without reviewing. Do any review today and your verses start
              counting days toward their next pile again.
            </div>
          )}
          {!frozen &&
            !onBreak &&
            untilFreeze !== null &&
            untilFreeze <= 1 &&
            today.total > 0 && (
              <div class="banner">
                A review today keeps your verses moving. (After 3 days without
                one, progress simply pauses — nothing is lost.)
              </div>
            )}

          <div class="card stack today-card">
            <div class="row">
              <div
                class={`ring ${today.outcome === "c" && readyAll === 0 ? "done" : ""}`}
                style={{ "--p": pct } as never}
              >
                <div data-testid="today-ring">
                  {today.total ? `${today.met}/${today.total}` : "✓"}
                </div>
              </div>
              <div class="grow">
                <h2 data-testid="today-title">{headline}</h2>
                <div class="muted small" data-testid="today-sub">
                  {subline}
                </div>
              </div>
            </div>
            {todayList.length > 0 && (
              <ul
                class="today-list"
                aria-label="Verses for today"
                data-testid="today-list"
              >
                {todayList.map(({ v, s }) => (
                  <li key={v.id} class={`pile-${v.pile} ${s.state}`}>
                    <i aria-hidden="true" />
                    <span>{formatRef(v)}</span>
                    <small class="muted">
                      {s.state === "ready"
                        ? s.countedToday
                          ? `${s.countedToday}/3`
                          : "ready"
                        : s.state === "waiting"
                          ? `in ${formatDuration(s.waitMs ?? 0)}`
                          : "done"}
                    </small>
                  </li>
                ))}
              </ul>
            )}
            {onBreak && (
              <button
                class="btn ghost small"
                onClick={stopBreak}
                data-testid="end-break"
              >
                End the break
              </button>
            )}
            <ModePicker />
          </div>

          <div>
            <h2 class="section-title">Your piles</h2>
            <div class="pile-grid">
              {PILES.map((p) => {
                const vs = pileVerses(data, p);
                const ready = vs.filter(
                  (v) => verseStatus(data, v, now).state === "ready",
                ).length;
                return (
                  <button
                    key={p}
                    class={`card tap pile-tile pile-${p}`}
                    onClick={() => navigate(`/pile/${p}`)}
                    data-testid={`pile-${p}`}
                    aria-label={`${PILE_INFO[p].label}: ${vs.length} verses, ${ready} ready`}
                  >
                    <h3>{PILE_INFO[p].label}</h3>
                    <div class="count" data-testid={`count-${p}`}>
                      {vs.length}
                    </div>
                    <div class={`small ${ready ? "status-ready" : "muted"}`}>
                      {ready ? `${ready} ready` : "none due"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          {shouldNudgeBackup({
            syncOn: !!settings.syncCode,
            verses: verses.length,
            lastExportAt: settings.lastExportAt,
            nudgeDismissedAt: settings.nudgeDismissedAt ?? 0,
            now,
          }) && (
            <div class="banner info" data-testid="backup-nudge">
              <div style={{ marginBottom: "8px" }}>
                Your verses live on this device. A quick backup (or turning on
                sync in Settings) keeps them safe if you ever lose or reset your
                phone.
              </div>
              <div class="row wrap">
                <button class="btn small primary" onClick={downloadBackup}>
                  Export a backup
                </button>
                <button
                  class="btn small ghost"
                  onClick={() =>
                    updateSettings({ nudgeDismissedAt: Date.now() })
                  }
                  data-testid="backup-nudge-dismiss"
                >
                  Not now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {readyAll > 0 && (
        <div class="action-bar">
          <button
            class="btn primary block"
            onClick={() =>
              navigate(`/review?today=1&mode=${settings.defaultMode}`)
            }
            data-testid="start-today"
          >
            {onBreak ? "Review anyway" : "Start today's reviews"} · {readyAll}
          </button>
        </div>
      )}
    </>
  );
}
