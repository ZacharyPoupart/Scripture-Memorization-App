import { describe, expect, it } from 'vitest';
import { isInappropriate } from '../../functions/_lib/moderation.js';

describe('the kind-names filter', () => {
  it('lets ordinary names, places and Bible words through', () => {
    for (const n of ['Zach P.', 'Sam L.', 'Youth Group', 'Bible Crew', 'Scunthorpe', 'Hancock', 'Class of 2026', 'Nazirite Vow', 'Shittim Wood', 'Torpedo', 'Milford', 'Spice Girls', 'Swanky', 'Thorny Crown', 'Hell and Back', 'The Ass and the Colt', 'Damn Good Verses', 'Isis', 'Bob', 'Lee K.', 'Piper', 'Skip', 'María José', '李明', '']) {
      expect(isInappropriate(n), n).toBe(false);
    }
  });

  it('stops rude words, in capitals, with accents, with spaces and dots, and with look-alike symbols', () => {
    for (const n of ['fuck', 'FUCK you', 'F.u.c.k', 'f u c k', 'fuuuck', 'fück', 'sh1t', '$hit', 'Sh!t head', 'b1tch', 'a$$hole', 'ass hole', 'p0rn fans', 'Big Cunt', 'nazi club', 'N4Z1 club', 'slutty', 'The Dick', 'Hitler Fans', 'sex', 'shiiiit', 'B00bs']) {
      expect(isInappropriate(n), n).toBe(true);
    }
  });

  it('is safe with odd input', () => {
    expect(isInappropriate(undefined as unknown as string)).toBe(false);
    expect(isInappropriate('   ')).toBe(false);
    expect(isInappropriate('a'.repeat(5000))).toBe(false);
  });
});
