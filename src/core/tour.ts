// The guided tour: its lessons (all the wording lives here, so it can be edited without touching code), the tiny step
// engine that moves through them, and the practice verses it runs on. Pure logic; the screens are in src/ui/tour/.
//
// The tour runs on the REAL screens against throw-away sample data (see `enterSandbox` in the store): nothing done in it
// is saved, synced or counted, and the owner's own data is untouched until the tour ends.
import { GRADUATION_DAYS, addVerse, movePile, createData } from './schedule.ts';
import type { AppData } from './types.ts';

/** How a step moves on. `next` = the Next button; the others wait for the person to do the thing (Next is replaced by a hint). */
export type Advance =
  | { kind: 'next' }
  /** The highlighted element is tapped. */
  | { kind: 'click' }
  /** An element with this test id appears on screen. */
  | { kind: 'present'; testid: string }
  /** The screen's route becomes exactly this ('' is Today). */
  | { kind: 'route'; path: string };

export interface TourStep {
  id: string;
  title: string;
  body: string;
  /** Go here when the step starts (a hash route such as '/settings'). Left alone if already there. */
  route?: string;
  /** `data-testid` of the element to light up. No target = a centred card over a dimmed screen. */
  target?: string;
  advance?: Advance;
  /** Leave the screen un-dimmed and let the person use it (for steps that say "try it"). */
  free?: boolean;
  /** Show the little schedule simulator in the card. */
  sim?: boolean;
}

export interface TourLesson {
  id: string;
  title: string;
  blurb: string;
  steps: TourStep[];
}

const D = GRADUATION_DAYS;

export const LESSONS: TourLesson[] = [
  {
    id: 'basics',
    title: 'The basics',
    blurb: 'Adding verses and how a day looks',
    steps: [
      {
        id: 'welcome',
        route: '/',
        title: 'Welcome',
        body: 'Add a verse, practice it a little each day, and it moves through four piles until it is part of you. This tour uses practice verses, so nothing you do here is saved.',
      },
      {
        id: 'add',
        route: '/',
        target: 'tab-add',
        title: 'Adding a verse',
        body: 'Tap + to add one. Pick the book, chapter and verses, or paste the text yourself (that works offline too). New verses start in Daily.',
      },
      {
        id: 'today',
        route: '/',
        target: 'today-title',
        title: 'This is Today',
        body: 'Everything ready for you is here. Daily verses want up to three reviews a day with a short wait between them. One review a day is enough to keep your streak going.',
      },
      {
        id: 'piles-row',
        route: '/',
        target: 'pile-row',
        title: 'Four piles',
        body: `Daily, Weekly, Monthly, then Yearly. Verses move up as you practice them, so you review less and less often, and never forget them. Daily takes ${D.daily} days.`,
      },
    ],
  },
  {
    id: 'review',
    title: 'Your first review',
    blurb: 'Try a real review',
    steps: [
      {
        id: 'start',
        route: '/',
        target: 'start-today',
        title: 'Start a review',
        body: 'Tap here to review everything that is ready.',
        advance: { kind: 'click' },
      },
      {
        id: 'flip',
        route: '/review?today=1&mode=flashcard',
        target: 'card-front',
        title: 'Say it, then check',
        body: 'You see the reference. Try to say the verse in your head, then tap the card to turn it over.',
        advance: { kind: 'click' },
      },
      {
        id: 'grade',
        target: 'grade-good',
        title: 'How did it go?',
        body: 'Tap Nailed it if you knew it. If not, Needs work shows it again.',
        advance: { kind: 'click' },
      },
      {
        id: 'counted',
        target: 'verse-result',
        title: 'That one counted',
        body: 'Each counted review moves a verse forward and earns a few coins. Extra practice is always fine, it just does not count.',
        advance: { kind: 'next' },
        free: true,
      },
      {
        id: 'close',
        target: 'close-review',
        title: 'Finish when you like',
        body: 'Tap the X when you want to stop. Everything you finished is already saved.',
        advance: { kind: 'click' },
      },
      {
        id: 'summary',
        target: 'session-done',
        title: 'How it went',
        body: 'Your coins and progress show here. Tap Back home when you are ready.',
        advance: { kind: 'route', path: '' },
      },
    ],
  },
  {
    id: 'modes',
    title: 'Practice your way',
    blurb: 'Four review types and your practice order',
    steps: [
      {
        id: 'types',
        route: '/',
        target: 'mode-picker',
        title: 'Four ways to practice',
        body: 'Flashcard: see the reference and recall. Blanks: choose the missing words. Type: type the first letter of every word. Speak: say it aloud and get word-by-word feedback. Switch any time, even in the middle of a review.',
      },
      {
        id: 'shuffle',
        route: '/',
        target: 'shuffle-toggle',
        title: 'Shuffle',
        body: 'Normally the verses you have held longest come first. Turn this on to get them in a random order instead.',
      },
      {
        id: 'type-try',
        route: '/review?today=1&mode=type',
        title: 'Try Type it out',
        body: 'Type the first letter of each word. A wrong letter shows the word and counts as a slip: Daily verses allow 3, the other piles none. Then you type where it is found (like J3:16). Try it, then tap Next.',
        free: true,
      },
      {
        id: 'order',
        route: '/settings',
        target: 'practice-order',
        title: 'Your practice order',
        body: 'Choose what is asked and when: the topic and the citation (reference) can come before the verse, after it, or both.',
      },
      {
        id: 'sandwich',
        route: '/settings',
        target: 'practice-preset-sandwich',
        title: 'The sandwich',
        body: 'This is the Navigators’ method: topic, citation, the verse, then the citation again. Tap it to try.',
        advance: { kind: 'click' },
      },
      {
        id: 'preview',
        target: 'practice-preview',
        title: 'That is the order',
        body: 'This line always shows what you will be asked. Your own settings are not changed by the tour.',
      },
    ],
  },
  {
    id: 'piles',
    title: 'Piles and progress',
    blurb: 'How a verse moves up',
    steps: [
      {
        id: 'overview',
        route: '/piles',
        title: 'All your verses',
        body: `Daily: reviewed each day, for ${D.daily} days. Weekly: once in each week (Sunday to Saturday), for ${D.weekly} weeks. Monthly: once in each calendar month, for ${D.monthly} months. Yearly: once a year, for life.`,
      },
      {
        id: 'periods',
        route: '/piles',
        title: 'Any day in the week or month',
        body: 'A Weekly verse is covered by a review on any day that week. It is due by Saturday night. A Monthly verse is due by the last day of the month. Only a missed one breaks your streak, and only on that last day.',
      },
      {
        id: 'sim',
        route: '/piles',
        title: 'Watch it happen',
        body: 'This verse is nearly through Daily. Review it and move the days along.',
        sim: true,
      },
      {
        id: 'skipped',
        route: '/piles',
        title: 'Missed a week? That is fine',
        body: 'A skipped week or month just does not count toward moving up. Nothing is lost and nothing is made up. If a verse keeps feeling shaky, the app offers to move it down a pile so you see it more often.',
      },
    ],
  },
  {
    id: 'streak',
    title: 'Streak and breaks',
    blurb: 'What keeps the flame, and time away',
    steps: [
      {
        id: 'flame',
        route: '/',
        target: 'streak',
        title: 'Your streak',
        body: 'It grows by one each day every due verse gets at least one review. Days when nothing is due do not break it.',
      },
      {
        id: 'history',
        route: '/stats',
        target: 'stats',
        title: 'Your history',
        body: 'The Progress tab shows your streaks, a calendar of your days, and the verses closest to moving up.',
      },
      {
        id: 'break',
        route: '/settings',
        target: 'break-card',
        title: 'Taking a break',
        body: 'Travelling or unwell? Start a break and nothing is due, your streak waits and nothing is lost. Reviewing anyway is always welcome.',
      },
    ],
  },
  {
    id: 'knight',
    title: 'Your knight',
    blurb: 'Coins and the armor of God',
    steps: [
      {
        id: 'coins',
        route: '/avatar',
        target: 'seeds-balance',
        title: 'Coins',
        body: 'Counted reviews, finished days and level-ups earn coins, and a streak makes each one worth more. You never lose them, and they are only for your knight’s armor.',
      },
      {
        id: 'sword',
        route: '/avatar',
        target: 'slot-weapon',
        title: 'The Sword of the Spirit',
        body: 'Add your first verse and practice it, and the sword is yours.',
      },
      {
        id: 'shield',
        route: '/avatar',
        target: 'slot-shield',
        title: 'The Shield of Faith',
        body: 'This one is a gift for finishing the tour. Everything else is bought with coins as you go.',
      },
    ],
  },
  {
    id: 'safety',
    title: 'Safe and sound',
    blurb: 'Backups, sync and offline',
    steps: [
      {
        id: 'backup',
        route: '/settings',
        target: 'backup-card',
        title: 'Back up your verses',
        body: 'Your verses live on this device. Export a backup now and then to keep a copy.',
      },
      {
        id: 'sync',
        route: '/settings',
        target: 'sync-card',
        title: 'Phone and computer together',
        body: 'Turn on sync to keep your phone and computer matched. It is end-to-end encrypted with a code only you hold.',
      },
      {
        id: 'install',
        route: '/settings',
        title: 'Install it and go offline',
        body: 'On an iPhone, tap Share, then Add to Home Screen, to use it like any app. Once installed it works with no connection at all. Only looking up verse text and syncing need one.',
      },
      {
        id: 'done',
        route: '/',
        title: 'You are ready',
        body: 'That is everything. Add your first verse and practice it to earn your sword. You can replay any lesson from Settings.',
      },
    ],
  },
];

// ---------------------------------------------------------------- the step engine

export interface TourPos {
  lesson: number;
  step: number;
}

export const START: TourPos = { lesson: 0, step: 0 };

export const stepAt = (p: TourPos): TourStep => LESSONS[p.lesson].steps[p.step];

export const isLastStep = (p: TourPos): boolean => p.lesson === LESSONS.length - 1 && p.step === LESSONS[p.lesson].steps.length - 1;

/** The next step, or `null` when the tour has ended. */
export function nextPos(p: TourPos): TourPos | null {
  if (p.step + 1 < LESSONS[p.lesson].steps.length) return { lesson: p.lesson, step: p.step + 1 };
  if (p.lesson + 1 < LESSONS.length) return { lesson: p.lesson + 1, step: 0 };
  return null;
}

/** The step before, staying at the very first step. */
export function prevPos(p: TourPos): TourPos {
  if (p.step > 0) return { lesson: p.lesson, step: p.step - 1 };
  if (p.lesson > 0) return { lesson: p.lesson - 1, step: LESSONS[p.lesson - 1].steps.length - 1 };
  return p;
}

/** Skip the rest of a lesson: the first step of the next one, or `null` after the last. */
export const nextLesson = (p: TourPos): TourPos | null => (p.lesson + 1 < LESSONS.length ? { lesson: p.lesson + 1, step: 0 } : null);

export const lessonStart = (lesson: number): TourPos => ({ lesson: Math.max(0, Math.min(LESSONS.length - 1, lesson)), step: 0 });

/** True when the step cannot be passed with the Next button (the person has to do the thing). */
export const needsAction = (s: TourStep): boolean => !!s.advance && s.advance.kind !== 'next';

/** Lessons finished on this device, by their id, ignoring unknown ones. */
export const doneLessons = (ids: string[]): string[] => LESSONS.map((l) => l.id).filter((id) => ids.includes(id));

// ---------------------------------------------------------------- the practice verses

const BOOK = { psalms: 19, proverbs: 20, philippians: 50 };

/**
 * Three practice verses (King James text) in different piles, all ready to review: a Daily verse (so the first review is a Daily one),
 * a Weekly one and a Monthly one. Everything here is thrown away when the tour ends.
 */
export function sampleTourData(now: number): AppData {
  const data = createData(now);
  const base = { translation: 'KJV' };
  addVerse(data, { ...base, book: BOOK.psalms, chapter: 23, start: 1, end: 1, text: 'The LORD is my shepherd; I shall not want.', topic: 'Trust', daysInPile: 60 }, now);
  const weekly = addVerse(data, { ...base, book: BOOK.philippians, chapter: 4, start: 13, end: 13, text: 'I can do all things through Christ which strengtheneth me.', topic: 'Strength' }, now);
  const monthly = addVerse(data, { ...base, book: BOOK.proverbs, chapter: 3, start: 5, end: 5, text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding.', topic: 'Trust' }, now);
  movePile(data, weekly.id, 'weekly', now, 30);
  movePile(data, monthly.id, 'monthly', now, 20);
  return data;
}
