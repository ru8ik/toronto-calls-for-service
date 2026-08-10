import { mergeCallTypes, SEED_CALL_TYPES } from './knownCallTypes';

describe('SEED_CALL_TYPES', () => {
  test('has no duplicates', () => {
    expect(new Set(SEED_CALL_TYPES).size).toBe(SEED_CALL_TYPES.length);
  });
});

describe('mergeCallTypes', () => {
  test('unions multiple lists with no duplicates', () => {
    const result = mergeCallTypes(['A', 'B'], ['B', 'C'], ['C', 'D']);
    expect(result).toEqual(['A', 'B', 'C', 'D']);
  });

  test('sorts the result', () => {
    expect(mergeCallTypes(['ROBBERY', 'ARSON', 'FRAUD'])).toEqual([
      'ARSON',
      'FRAUD',
      'ROBBERY',
    ]);
  });

  test('drops empty and falsy values', () => {
    expect(mergeCallTypes(['A', '', null, undefined, 'B'])).toEqual(['A', 'B']);
  });

  test('empty input returns an empty list', () => {
    expect(mergeCallTypes()).toEqual([]);
    expect(mergeCallTypes([])).toEqual([]);
  });
});
