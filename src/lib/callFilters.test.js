import { callKey, filterCalls } from './callFilters';

const call = (over = {}) => ({
  OCCURRENCE_TIME: 1786293091000,
  LATITUDE: 43.65,
  LONGITUDE: -79.38,
  DIVISION: 'D51',
  CALL_TYPE: 'ROBBERY',
  CROSS_STREETS: 'A ST - B ST',
  ...over,
});

const sel = (divisions = [], types = []) => ({
  divisions: new Set(divisions),
  types: new Set(types),
});

describe('callKey', () => {
  test('combines time and coordinates', () => {
    expect(callKey(call())).toBe('1786293091000|43.65|-79.38');
  });

  test('distinguishes two calls at the same location at different times', () => {
    const a = callKey(call());
    const b = callKey(call({ OCCURRENCE_TIME: 1786293099000 }));
    expect(a).not.toBe(b);
  });
});

describe('filterCalls', () => {
  const calls = [
    call({ DIVISION: 'D51', CALL_TYPE: 'ROBBERY' }),
    call({ DIVISION: 'D52', CALL_TYPE: 'ASSAULT' }),
    call({ DIVISION: 'D14', CALL_TYPE: 'FRAUD' }),
    call({ DIVISION: 'HP', CALL_TYPE: 'FIRE' }),
  ];

  test('empty selection returns everything', () => {
    expect(filterCalls(calls, sel())).toHaveLength(4);
  });

  test('ORs within the division category', () => {
    const result = filterCalls(calls, sel(['D51', 'D52']));
    expect(result.map((c) => c.DIVISION)).toEqual(['D51', 'D52']);
  });

  test('ANDs across categories', () => {
    const result = filterCalls(calls, sel(['D51', 'D52'], ['ASSAULT']));
    expect(result).toHaveLength(1);
    expect(result[0].DIVISION).toBe('D52');
  });

  test('matches call types exactly, not by substring', () => {
    const typed = [
      call({ CALL_TYPE: 'ASSAULT' }),
      call({ CALL_TYPE: 'ASSAULT IN PROGRESS' }),
      call({ CALL_TYPE: 'ASSAULT JUST OCCURRED' }),
    ];
    const result = filterCalls(typed, sel([], ['ASSAULT']));
    expect(result).toHaveLength(1);
    expect(result[0].CALL_TYPE).toBe('ASSAULT');
  });

  test('matches divisions exactly, not by substring', () => {
    const typed = [call({ DIVISION: 'D5' }), call({ DIVISION: 'D51' })];
    const result = filterCalls(typed, sel(['D5']));
    expect(result).toHaveLength(1);
    expect(result[0].DIVISION).toBe('D5');
  });
});

import { sortDivisions, groupDivisions } from './callFilters';

describe('sortDivisions', () => {
  test('sorts numerically, not lexically', () => {
    expect(sortDivisions(['D51', 'D14', 'D9', 'D32'])).toEqual([
      'D9',
      'D14',
      'D32',
      'D51',
    ]);
  });

  test('places non-division units after all divisions, alphabetically', () => {
    expect(sortDivisions(['TAC8', 'D51', 'HP', 'D14', 'DARU'])).toEqual([
      'D14',
      'D51',
      'DARU',
      'HP',
      'TAC8',
    ]);
  });
});

describe('groupDivisions', () => {
  test('splits geographic divisions from operational units', () => {
    expect(groupDivisions(['HP', 'D51', 'TAC8', 'D14'])).toEqual({
      divisions: ['D14', 'D51'],
      other: ['HP', 'TAC8'],
    });
  });

  test('returns empty groups for empty input', () => {
    expect(groupDivisions([])).toEqual({ divisions: [], other: [] });
  });
});
