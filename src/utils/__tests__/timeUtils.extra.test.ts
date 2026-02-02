import {
  formatDateISO,
  parseDateISO,
  getDurationMinutes,
  isTimeInRange,
} from '../timeUtils';

describe('timeUtils extra', () => {
  it('formats and parses ISO dates', () => {
    const date = new Date(2025, 0, 5);
    const iso = formatDateISO(date);
    expect(iso).toBe('2025-01-05');
    expect(parseDateISO(iso)?.getFullYear()).toBe(2025);
  });

  it('returns null for invalid ISO date', () => {
    expect(parseDateISO('2025-13-40')).toBeNull();
  });

  it('calculates duration across midnight', () => {
    expect(getDurationMinutes('23:00', '01:30')).toBe(150);
  });

  it('checks time within range across midnight', () => {
    expect(isTimeInRange(23.5, '23:00', '01:00')).toBe(true);
    expect(isTimeInRange(2, '23:00', '01:00')).toBe(false);
  });
});
