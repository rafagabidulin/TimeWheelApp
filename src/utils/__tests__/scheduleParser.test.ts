import { parseSchedule, parseSimpleSchedule, validateParsedTask } from '../scheduleParser';

describe('scheduleParser', () => {
  it('parses multiple tasks from a single line', () => {
    const input = 'Работа 9:00-13:00, обед 13:00-14:00';
    const tasks = parseSchedule(input);

    expect(tasks).toHaveLength(2);
    expect(tasks[0].title).toBe('Работа');
    expect(tasks[0].startTime).toBe('09:00');
    expect(tasks[0].endTime).toBe('13:00');
    expect(tasks[1].title).toBe('обед');
    expect(tasks[1].startTime).toBe('13:00');
    expect(tasks[1].endTime).toBe('14:00');
  });

  it('parses short time ranges like "9-17"', () => {
    const tasks = parseSchedule('Работа 9-17');

    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Работа');
    expect(tasks[0].startTime).toBe('09:00');
    expect(tasks[0].endTime).toBe('17:00');
  });

  it('parses simple line-based format', () => {
    const input = 'Встреча: 10:00-11:30\nОбед: 13:00-14:00';
    const tasks = parseSimpleSchedule(input);

    expect(tasks).toHaveLength(2);
    expect(tasks[0].title).toBe('Встреча');
    expect(tasks[0].startTime).toBe('10:00');
    expect(tasks[0].endTime).toBe('11:30');
  });

  it('validates parsed task time range', () => {
    expect(
      validateParsedTask({
        title: 'Тест',
        startTime: '10:00',
        endTime: '10:00',
        category: 'custom',
        color: '#000',
      }).valid,
    ).toBe(false);
  });
});
