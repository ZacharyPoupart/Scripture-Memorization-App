import { describe, expect, it } from 'vitest';
import { installPolyfills } from '../../src/polyfills.ts';
import { newData, john316, at, D0 } from './helpers.ts';

describe('older-iPhone polyfills', () => {
  it('adds a structuredClone that deep-copies app data when the browser has none', () => {
    const g: { structuredClone?: unknown } = {};
    installPolyfills(g);
    const clone = g.structuredClone as <T>(v: T) => T;
    const data = newData();
    john316(data, at(D0, '07:00'));
    const copy = clone(data);
    expect(copy).toEqual(data);
    expect(copy).not.toBe(data);
    expect(Object.values(copy.verses)[0]).not.toBe(Object.values(data.verses)[0]);
  });
  it('leaves a native structuredClone alone', () => {
    const native = () => 1;
    const g = { structuredClone: native };
    installPolyfills(g);
    expect(g.structuredClone).toBe(native);
  });
});
