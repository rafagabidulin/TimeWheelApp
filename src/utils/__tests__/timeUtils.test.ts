import { timeToMinutes, minutesToTime, getTimeSegments, doTimeRangesOverlap } from '../timeUtils';

describe('timeUtils', () => {
  it('converts time to minutes', () => {
    expect(timeToMinutes('09:30')).toBe(9 * 60 + 30);
  });

  it('normalizes minutes into time string', () => {
    expect(minutesToTime(-15)).toBe('23:45');
  });

  it('splits ranges that cross midnight', () => {
    expect(getTimeSegments('22:00', '02:00')).toEqual([
      [22 * 60, 24 * 60],
      [0, 2 * 60],
    ]);
  });

  it('detects overlap across midnight', () => {
    expect(doTimeRangesOverlap('23:00', '01:00', '00:30', '02:00')).toBe(true);
    expect(doTimeRangesOverlap('23:00', '01:00', '01:30', '02:00')).toBe(false);
  });
});
