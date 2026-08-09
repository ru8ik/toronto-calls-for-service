import { parseHash, buildHash, emptySelection } from './urlState';

const sel = (divisions = [], types = []) => ({
  divisions: new Set(divisions),
  types: new Set(types),
});

const sorted = (set) => [...set].sort();

describe('parseHash', () => {
  test('empty hash is the main page', () => {
    expect(parseHash('').page).toBe('main');
    expect(parseHash('#/').page).toBe('main');
  });

  test('reads the aggregate page with no selection', () => {
    const r = parseHash('#/aggregate');
    expect(r.page).toBe('aggregate');
    expect(r.selection.divisions.size).toBe(0);
    expect(r.selection.types.size).toBe(0);
  });

  test('reads divisions and types', () => {
    const r = parseHash('#/aggregate?div=D51,D52&type=ROBBERY');
    expect(sorted(r.selection.divisions)).toEqual(['D51', 'D52']);
    expect(sorted(r.selection.types)).toEqual(['ROBBERY']);
  });

  test('decodes values containing spaces and ampersands', () => {
    const r = parseHash('#/aggregate?type=BREAK%20%26%20ENTER');
    expect(sorted(r.selection.types)).toEqual(['BREAK & ENTER']);
  });

  test('unmatched routes fall back to main page', () => {
    expect(parseHash('#####').page).toBe('main');
    expect(parseHash(undefined).page).toBe('main');
  });

  test('malformed values in valid route do not throw, stay on aggregate page, and drop only the bad value', () => {
    expect(() => parseHash('#/aggregate?div=%E0%A4%A')).not.toThrow();
    const r = parseHash('#/aggregate?div=%E0%A4%A,D51');
    expect(r.page).toBe('aggregate');
    expect(sorted(r.selection.divisions)).toEqual(['D51']);
  });

  test('drops empty values', () => {
    const r = parseHash('#/aggregate?div=,,D51,');
    expect(sorted(r.selection.divisions)).toEqual(['D51']);
  });
});

describe('buildHash', () => {
  test('main page is #/', () => {
    expect(buildHash('main', sel(['D51']))).toBe('#/');
  });

  test('omits empty categories', () => {
    expect(buildHash('aggregate', sel())).toBe('#/aggregate');
    expect(buildHash('aggregate', sel(['D51']))).toBe('#/aggregate?div=D51');
  });

  test('encodes special characters', () => {
    expect(buildHash('aggregate', sel([], ['BREAK & ENTER']))).toBe(
      '#/aggregate?type=BREAK%20%26%20ENTER'
    );
  });
});

describe('round trip', () => {
  test('buildHash -> parseHash preserves the selection', () => {
    const original = sel(['D51', 'HP'], ['BREAK & ENTER', 'THEFT OF VEHICLE']);
    const result = parseHash(buildHash('aggregate', original));
    expect(sorted(result.selection.divisions)).toEqual(sorted(original.divisions));
    expect(sorted(result.selection.types)).toEqual(sorted(original.types));
  });
});

describe('emptySelection', () => {
  test('returns independent empty sets each call', () => {
    const a = emptySelection();
    a.divisions.add('D51');
    expect(emptySelection().divisions.size).toBe(0);
  });
});
