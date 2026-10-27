// A kind-names filter, shared by the app (so people hear about it at once) and the server (which has the last word).
// It is deliberately plain: a short list of words that have no place in a name, matched after undoing the usual disguises
// (capitals, accents, spaces and dots between letters, 0 for o, 1 for i, 3 for e, 4 for @ for a, $ for s, ...). Words that are also
// ordinary names, places or Bible words (Dick, Hancock, Scunthorpe, hell, ass, damn) are never matched inside other words.

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '+': 't' };

// matched anywhere in the letters of the name, even when spaced out (f u c k), so these must be unlikely inside a real word
const INSIDE = [
  'fuck', 'bitch', 'whore', 'pussy', 'asshole', 'bastard', 'dildo', 'porn', 'blowjob', 'handjob', 'jackoff', 'jerkoff',
  'nigger', 'nigga', 'faggot', 'retard', 'hitler', 'cocksucker', 'motherfucker', 'rapist', 'molest', 'orgasm', 'cumshot', 'jizz',
  'bollock', 'erotic',
];
// matched only as a whole word, because they sit inside innocent words, names or Bible words (Nazirite, Shittim, torpedo, Milford)
const WHOLE = [
  'shit', 'shits', 'shitty', 'shithead', 'bullshit', 'cunt', 'cunts', 'dick', 'dicks', 'cock', 'cocks', 'penis', 'vagina', 'cum', 'cums',
  'anal', 'anus', 'rape', 'raped', 'rapes', 'sex', 'sexy', 'tits', 'tit', 'boobs', 'boob', 'fag', 'fags', 'kkk', 'nude', 'nudes', 'piss',
  'prick', 'slut', 'sluts', 'slutty', 'horny', 'milf', 'wank', 'wanker', 'twat', 'kike', 'spic', 'chink', 'wetback', 'tranny', 'nazi',
  'nazis', 'pedo', 'paedo', 'pedophile', 'wtf', 'stfu', 'fck', 'fuk', 'sht', 'btch', 'dumbass', 'jackass', 'dickhead', 'suicide',
  'terrorist',
];

const squash = (s) => s.replace(/(.)\1+/g, '$1'); // fuuuck -> fuck
const trim3 = (s) => s.replace(/(.)\1{2,}/g, '$1$1'); // shiiit -> shiit, boooob -> boob
const plain = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
const unleet = (s) => s.replace(/[013458@$!+7]/g, (c) => LEET[c]);

const INSIDE_SQUASHED = INSIDE.map(squash);
const WHOLE_SET = new Set(WHOLE);
const WHOLE_SINGLE = new Set(WHOLE.filter((w) => squash(w) === w)); // words with no doubled letter can be stretched: shiiit

/** True when a person's name (or a group's name) should not be allowed. */
export function isInappropriate(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return false;
  const text = plain(raw);
  // whole words: split on anything that is not a letter, digit or one of the look-alike symbols
  for (const word of text.split(/[^a-z0-9@$!+]+/).filter(Boolean)) {
    const w = unleet(word);
    if (WHOLE_SET.has(trim3(w)) || WHOLE_SINGLE.has(squash(w))) return true;
  }
  // inside the letters: remove everything between letters so "f.u.c.k" and "f u c k" are caught too
  const letters = squash(unleet(text).replace(/[^a-z]/g, ''));
  if (letters.length >= 4 && INSIDE_SQUASHED.some((w) => letters.includes(w))) return true;
  return false;
}
