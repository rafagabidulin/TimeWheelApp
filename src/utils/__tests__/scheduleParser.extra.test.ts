import { parseSchedule, parseSimpleSchedule, validateParsedTask } from '../scheduleParser';
import { logger } from '../logger';

describe('scheduleParser extra', () => {
  it('parses "с 9 до 17" format', () => {
    const tasks = parseSchedule('Работа с 9 до 17');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].startTime).toBe('09:00');
    expect(tasks[0].endTime).toBe('17:00');
  });

  it('parses dot time format', () => {
    const tasks = parseSchedule('Учёба 9.30-11.00');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].startTime).toBe('09:30');
    expect(tasks[0].endTime).toBe('11:00');
  });

  it('parseSimpleSchedule skips invalid lines', () => {
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    const tasks = parseSimpleSchedule('Без времени\nВстреча: 10:00-11:00');
    warnSpy.mockRestore();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Встреча');
  });

  it('validateParsedTask rejects empty title', () => {
    const result = validateParsedTask({
      title: '   ',
      startTime: '09:00',
      endTime: '10:00',
      category: 'custom',
      color: '#000',
    });
    expect(result.valid).toBe(false);
  });
});
