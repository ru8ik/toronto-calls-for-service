import { isEmergencyCall } from './severity';

describe('isEmergencyCall', () => {
  test('matches gun-related calls', () => {
    expect(isEmergencyCall('PERSON WITH A GUN')).toBe(true);
  });

  test('excludes SOUND OF GUNSHOTS even though it contains "gun"', () => {
    expect(isEmergencyCall('SOUND OF GUNSHOTS')).toBe(false);
    expect(isEmergencyCall('sound of gunshots')).toBe(false);
  });

  test('matches knife-related calls', () => {
    expect(isEmergencyCall('PERSON WITH A KNIFE')).toBe(true);
  });

  test('does not flag stabbing', () => {
    expect(isEmergencyCall('STABBING')).toBe(false);
  });

  test('matches shooting variants other than gunshots', () => {
    expect(isEmergencyCall('SHOOTING')).toBe(true);
  });

  test('matches robbery', () => {
    expect(isEmergencyCall('ROBBERY')).toBe(true);
  });

  test('matches full break & enter phrases only', () => {
    expect(isEmergencyCall('BREAK & ENTER')).toBe(true);
    expect(isEmergencyCall('BREAK & ENTER IN PROGRESS')).toBe(true);
    expect(isEmergencyCall('ATTEMPT BREAK & ENTER')).toBe(true);
  });

  test('does not flag unrelated calls containing "break" or "enter" alone', () => {
    expect(isEmergencyCall('ESCAPE CUSTODY')).toBe(false);
    expect(isEmergencyCall('UNKNOWN TROUBLE')).toBe(false);
  });

  test('is case-insensitive', () => {
    expect(isEmergencyCall('person with a gun')).toBe(true);
  });

  test('returns false for empty or missing call type', () => {
    expect(isEmergencyCall('')).toBe(false);
    expect(isEmergencyCall(null)).toBe(false);
    expect(isEmergencyCall(undefined)).toBe(false);
  });

  test('does not flag ordinary calls', () => {
    expect(isEmergencyCall('NOISY PARTY')).toBe(false);
    expect(isEmergencyCall('FOUND PROPERTY')).toBe(false);
  });
});
