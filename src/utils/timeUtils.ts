// utils/timeUtils.ts
import { DAYS_OF_WEEK } from '../constants/theme';

/**
 * Преобразует время (строка "HH:MM") в часы (число с дробной частью)
 * @example timeToHours("14:30") -> 14.5
 */
export function timeToHours(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h + m / 60;
}

/**
 * Преобразует часы (число) в угол на циферблате (0-360°)
 * @example getAngle(12) -> 180
 */
export function getAngle(hours: number): number {
  return (hours / 24) * 360;
}

/**
 * Проверяет, что время в корректном формате HH:MM (00:00 - 23:59)
 */
export function isValidTime(time: string): boolean {
  return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
}

/**
 * Проверяет, что диапазон времени корректен (начало != конца)
 */
export function isValidTimeRange(startTime: string, endTime: string): boolean {
  if (!isValidTime(startTime) || !isValidTime(endTime)) return false;
  const start = timeToHours(startTime);
  const end = timeToHours(endTime);
  return start !== end;
}

/**
 * Получает ID текущего дня недели (monday-sunday)
 * @returns День недели в формате из DAYS_OF_WEEK
 */
export function getCurrentDayId(): string {
  const today = new Date();
  const dayOfWeek = today.getDay();
  // JavaScript: 0 = Sunday, но нам нужно: Sunday = 6, Monday = 0
  const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return DAYS_OF_WEEK[adjustedDay];
}

/**
 * Преобразует часы в радианы для использования в тригонометрических функциях
 * SVG использует угол 0° справа, поэтому вычитаем 90° для верхней позиции
 */
export function getAngleRadians(hours: number): number {
  const angle = getAngle(hours);
  return (angle - 90) * (Math.PI / 180);
}

/**
 * Форматирует время в строку "HH:MM" из часов и минут
 */
export function formatTime(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Форматирует дату в локальный ISO-формат YYYY-MM-DD
 */
export function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Парсит локальный ISO-формат YYYY-MM-DD в Date без смещения по времени
 */
export function parseDateISO(dateStr: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

/**
 * Преобразует время (строка "HH:MM") в минуты от начала суток
 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Разбивает диапазон времени на сегменты (учёт перехода через полночь)
 */
export function getTimeSegments(startTime: string, endTime: string): Array<[number, number]> {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  if (start === end) {
    return [];
  }

  if (start < end) {
    return [[start, end]];
  }

  return [
    [start, 24 * 60],
    [0, end],
  ];
}

/**
 * Проверяет пересечение двух диапазонов времени
 */
export function doTimeRangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  const segmentsA = getTimeSegments(startA, endA);
  const segmentsB = getTimeSegments(startB, endB);

  for (const [aStart, aEnd] of segmentsA) {
    for (const [bStart, bEnd] of segmentsB) {
      if (aStart < bEnd && bStart < aEnd) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Возвращает длительность задачи в минутах (учитывает переход через полночь)
 */
export function getDurationMinutes(startTime: string, endTime: string): number {
  const segments = getTimeSegments(startTime, endTime);
  return segments.reduce((total, [start, end]) => total + (end - start), 0);
}

/**
 * Проверяет, находится ли текущее время в диапазоне задачи (с учётом переноса через полночь)
 */
export function isTimeInRange(currentHours: number, startTime: string, endTime: string): boolean {
  const start = timeToHours(startTime);
  const end = timeToHours(endTime);

  // Если время начала > времени окончания, задача переходит через полночь
  if (start > end) {
    return currentHours >= start || currentHours < end;
  }

  return currentHours >= start && currentHours < end;
}

/**
 * Вычисляет координаты для SVG Path дуги задачи на циферблате
 * @param startHours Время начала задачи в часах
 * @param endHours Время окончания задачи в часах
 * @param centerX X координата центра циферблата
 * @param centerY Y координата центра циферблата
 * @param radius Радиус циферблата
 */
export function getPathData(
  startHours: number,
  endHours: number,
  centerX: number,
  centerY: number,
  radius: number,
): string {
  const startAngle = getAngle(startHours);
  const endAngle = getAngle(endHours);
  const startRad = (startAngle - 90) * (Math.PI / 180);
  const endRad = (endAngle - 90) * (Math.PI / 180);

  const x1 = centerX + radius * Math.cos(startRad);
  const y1 = centerY + radius * Math.sin(startRad);
  const x2 = centerX + radius * Math.cos(endRad);
  const y2 = centerY + radius * Math.sin(endRad);

  // largeArc = 1 если угол больше 180°, иначе 0
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  // SVG Path: переместиться в центр, линия к началу дуги, дуга, линия обратно, закрыть
  return `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

/**
 * Добавляет дни к дате, корректно обрабатывая переходы между месяцами
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
