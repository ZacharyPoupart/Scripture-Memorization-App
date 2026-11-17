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

// Streamlined in v1.76.0 (owner-requested): three short lessons, fifteen steps, each one showing a thing you will really use.
// It was seven lessons and thirty-three steps; the details it used to explain are where you meet them in the app.
export const LESSONS: TourLesson[] = [
  {
    id: 'basics',
    title: 'The essentials',
    blurb: 'Add a verse and do a real review',
    steps: [
      {
        id: 'welcome',
        route: '/',
        title: 'Welcome',
        body: 'Add a verse, practice it a little each day, and it stays with you for life. This tour uses practice verses, so nothing you do here is saved.',
      },
      {
        id: 'add',
        route: '/',
        target: 'tab-add',
        title: 'Add a verse',
        body: 'Tap + and choose the book, chapter and verse. The text is looked up for you, or you can type it in. New verses start in Daily.',
      },
      {
        id: 'start',
        route: '/',
        target: 'start-today',
        title: 'Start a review',
        body: 'Today lists what is ready. Tap here to review it all.',
        advance: { kind: 'click' },
      },
      {
        id: 'flip',
        route: '/review?today=1&mode=flashcard',
        target: 'card-front',
        title: 'Say it, then check',
        body: 'Say the verse in your head, then tap the card to turn it over.',
        advance: { kind: 'click' },
      },
      {
        id: 'grade',
        target: 'grade-good',
        title: 'How did it go?',
        body: 'Tap Nailed it if you knew it. Needs work shows it again.',
        advance: { kind: 'click' },
      },
      {
        id: 'close',
        target: 'close-review',
        title: 'That one counted',
        body: 'It moved the verse forward and earned a few coins. Tap the X whenever you want to stop. What you finished is already saved.',
        advance: { kind: 'click' },
      },
      {
        id: 'summary',
        target: 'session-done',
        title: 'How it went',
        body: 'Your coins and progress show here. Tap Back home.',
        advance: { kind: 'route', path: '' },
      },
    ],
  },
  {
    id: 'practice',
    title: 'Practice your way',
    blurb: 'Review types and how verses move up',
    steps: [
      {
        id: 'types',
        route: '/',
        target: 'mode-picker',
        title: 'Four ways to review',
        body: 'Flashcard, Blanks (choose the missing words), Type (the first letter of each word) and Speak (say it aloud). Switch any time, even mid review. Open a verse to play a game with it, too.',
      },
      {
        id: 'piles-row',
        route: '/',
        target: 'pile-row',
        title: 'Four piles',
        body: `Daily for ${D.daily} days, Weekly for ${D.weekly} weeks, Monthly for ${D.monthly} months, then Yearly for life. A verse moves up as you review it, so you see it less often and still keep it.`,
      },
      {
        id: 'sim',
        route: '/piles',
        title: 'Watch it happen',
        body: 'This verse is nearly through Daily. Review it and move the days along. A skipped week just does not count, nothing is lost.',
        sim: true,
      },
    ],
  },
  {
    id: 'keep',
    title: 'Keep it going',
    blurb: 'Your streak, your knight and your backup',
    steps: [
      {
        id: 'flame',
        route: '/',
        target: 'streak',
        title: 'Your streak',
        body: 'It grows each day every due verse gets at least one review. Days with nothing due never break it.',
      },
      {
        id: 'break',
        route: '/settings',
        target: 'break-card',
        title: 'Taking a break',
        body: 'Travelling or unwell? Start a break: nothing is due, your streak waits and nothing is lost.',
      },
      {
        id: 'coins',
        route: '/avatar',
        target: 'seeds-balance',
        title: 'Your knight',
        body: 'Reviews earn coins for your knight’s armor, and a streak makes each one worth more. The sword comes with your first practiced verse, and the shield is a gift for finishing this tour.',
      },
      {
        id: 'backup',
        route: '/settings',
        target: 'backup-card',
        title: 'Keep your verses safe',
        body: 'Your verses live on this device. Export a backup now and then, or turn on sync to match your phone and computer.',
      },
      {
        id: 'done',
        route: '/',
        title: 'You are ready',
        body: 'Add your first verse and practice it to earn your sword. You can replay any lesson from Settings.',
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
