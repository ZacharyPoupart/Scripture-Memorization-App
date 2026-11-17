// What the knight says (v1.75.0, owner-requested: warm, human, never guilt). Pure: the same moment always gives the same line,
// chosen from a few so it does not repeat every day. Nothing here touches scheduling.

export type TodayMood =
  | { kind: 'empty' } // no verses yet
  | { kind: 'break' }
  | { kind: 'ready'; ready: number; doneToday: number } // verses waiting now
  | { kind: 'waiting' } // done for now, more unlock later
  | { kind: 'done' } // everything for today is finished
  | { kind: 'quiet' }; // nothing due today

const pick = (lines: readonly string[], seed: number) => lines[Math.abs(Math.trunc(seed)) % lines.length];
const verses = (n: number) => `${n} verse${n === 1 ? '' : 's'}`;

/** A greeting that fits the hour (local time). */
export function hello(hour: number): string {
  return hour < 5 ? 'Up late?' : hour < 12 ? 'Good morning.' : hour < 18 ? 'Good afternoon.' : 'Good evening.';
}

/** The line on Today. `day` is any number that changes once a day; `streak` is the current streak. */
export function todayLine(mood: TodayMood, opts: { hour: number; day: number; streak: number }): string {
  const { hour, day, streak } = opts;
  switch (mood.kind) {
    case 'empty':
      return 'Hello, I’m your knight. Add a verse and we’ll learn it together.';
    case 'break':
      return pick(['Enjoy the break. Everything will be right here when you’re back.', 'Rest is part of the journey. I’ll keep watch.'], day);
    case 'ready': {
      if (mood.doneToday > 0)
        return pick(
          [`Nice start. ${verses(mood.ready)} ready when you are.`, `You’re on a roll. ${verses(mood.ready)} to go.`, `Back for more? ${verses(mood.ready)} are ready.`],
          day + mood.doneToday,
        );
      if (streak >= 7) return pick([`${hello(hour)} Day ${streak + 1} is waiting, and so am I.`, `${hello(hour)} You keep showing up. ${verses(mood.ready)} today.`], day);
      return pick(
        [
          `${hello(hour)} ${verses(mood.ready)} today. A few quiet minutes is all it takes.`,
          `${hello(hour)} Ready when you are. ${verses(mood.ready)} to walk through.`,
          `${hello(hour)} Let’s hide a little more of the Word in your heart.`,
        ],
        day,
      );
    }
    case 'waiting':
      return pick(['Good work. I’ll keep watch until the next ones are ready.', 'Well done. Take a breather, the rest come later today.'], day);
    case 'done':
      return streak >= 2
        ? pick([`That’s today done. ${streak} days running, and it shows.`, 'All finished. I’m proud of the steady work you’re putting in.', 'Everything is done. Rest well tonight.'], day)
        : pick(['That’s everything for today. Well done.', 'All finished. See you tomorrow, friend.'], day);
    case 'quiet':
      return pick(['A quiet day. Nothing is due, so enjoy it.', 'Nothing is due today. Practise anything you like, just for the joy of it.'], day);
  }
}

/** The line after one review. `n` rotates the wording; `counted` false is extra practice. */
export function reviewLine(opts: { counted: boolean; levelUp: boolean; todayComplete: boolean; n: number }): string {
  if (opts.levelUp) return pick(['Look at that, it moved up. You earned it.', 'It moved up a pile. That verse is taking root.'], opts.n);
  if (opts.todayComplete) return pick(['And that’s the day. Beautifully done.', 'That was the last one for today. Well done.'], opts.n);
  if (!opts.counted) return pick(['Extra practice. That’s the spirit.', 'Just for the love of it. I like that.'], opts.n);
  return pick(['Well done.', 'That one is a little more yours now.', 'Steady and sure.', 'Lovely. On we go.', 'Another one planted.', 'Yes. That’s it.'], opts.n);
}

/** The line on the summary at the end of a run. */
export function summaryLine(opts: { reviewed: number; fullyDone: boolean; streak: number }): string {
  if (opts.fullyDone) return opts.streak >= 2 ? `Every review done, ${opts.streak} days in a row. I’m proud of you.` : 'Every review done. I’m proud of you.';
  if (opts.reviewed >= 5) return `${opts.reviewed} verses in one sitting. That’s real work.`;
  return pick(['Good session. Thanks for showing up today.', 'Time well spent. See you soon.'], opts.reviewed);
}
