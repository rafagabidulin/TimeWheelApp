// utils/scheduleParser.ts
import { FormData } from '../types/types';
import { logger } from './logger';

/**
 * Результат парсинга расписания
 */
export interface ParsedTask {
  title: string;
  startTime: string;
  endTime: string;
  category: string;
  color: string;
}

/**
 * Категории и соответствующие им цвета
 */
const CATEGORY_COLORS: Record<string, string> = {
  work: '#4CAF50',
  food: '#FFC107',
  sports: '#E91E63',
  study: '#9C27B0',
  leisure: '#00BCD4',
  home: '#795548',
  custom: '#2196F3',
};

const MAX_SCHEDULE_INPUT_LENGTH = 1000;
const MAX_SCHEDULE_ENTRIES = 200;

/**
 * Определение категории по названию задачи
 */
function getCategoryForTask(title: string): string {
  const titleLower = title.toLowerCase();

  // Работа
  if (/работ|встреча|презентац|проект|офис|совещан/i.test(titleLower)) {
    return 'work';
  }

  // Еда
  if (/завтрак|обед|ужин|перекус|кофе|чай/i.test(titleLower)) {
    return 'food';
  }

  // Спорт
  if (/тренир|спорт|бег|йога|гимнаст|плаван|фитнес|зарядк/i.test(titleLower)) {
    return 'sports';
  }

  // Учёба
  if (/учёб|лекц|семинар|занят|курс|урок|практик/i.test(titleLower)) {
    return 'study';
  }

  // Досуг
  if (/кино|театр|концерт|друз|игр|развлеч|выход|прогулк|отдых/i.test(titleLower)) {
    return 'leisure';
  }

  // Дом
  if (/дом|уборк|готов|хозяйств|стирк|уход/i.test(titleLower)) {
    return 'home';
  }

  return 'custom';
}

/**
 * Парсинг времени из различных форматов
 * "9", "9:00", "9.30", "09:00", "09:30"
 */
function parseTime(timeStr: string): string | null {
  const trimmed = timeStr
    .trim()
    .replace(/\b(\d{1,2})\s+(\d{2})\b/, '$1:$2')
    .replace(/\b(\d{1,2})\s*ч\s*(\d{2})\b/i, '$1:$2')
    .replace(/\b(\d{1,2})\s*ч\b/i, '$1');
  const match = trimmed.match(/^(\d{1,2})(?:(?::|\.)(\d{2}))?$/);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Основной парсер расписания
 * Парсит строки вида:
 * - "Работа 9:00-13:00"
 * - "Обед 13:00-14:00, тренировка 19:00-20:00"
 * - "Завтрак 8:00 - 8:30"
 */
export function parseSchedule(input: string): ParsedTask[] {
  const tasks: ParsedTask[] = [];

  // Разделяем по запятым, точкам с запятой и переводам строк
  let safeInput = input;
  if (safeInput.length > MAX_SCHEDULE_INPUT_LENGTH) {
    logger.warn('[ScheduleParser] Input too long, truncating');
    safeInput = safeInput.slice(0, MAX_SCHEDULE_INPUT_LENGTH);
  }

  let entries = safeInput.split(/[,;\n]+/);
  if (entries.length > MAX_SCHEDULE_ENTRIES) {
    logger.warn('[ScheduleParser] Too many entries, truncating');
    entries = entries.slice(0, MAX_SCHEDULE_ENTRIES);
  }

  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    // Поддерживаем форматы:
    // "Работа 9:00-13:00"
    // "Обед 13:00-14:00"
    // "Завтрак 8:00 - 8:30"
    // "Встреча с боссом 10:00-11:30"
    // "Работа с 9 до 17"
    // "Работа 9-17"
    // "Работа 9.30-17.00"

    const rangeMatch = trimmed.match(
      /(.*?)(?:\bс\b)?\s*(\d{1,2}(?::\d{2}|\.\d{2})?|\d{1,2}|\d{1,2}\s+\d{2}|\d{1,2}\s*ч)\s*(?:-|\u2013|\u2014|до|по)\s*(\d{1,2}(?::\d{2}|\.\d{2})?|\d{1,2}|\d{1,2}\s+\d{2}|\d{1,2}\s*ч)/i,
    );

    if (!rangeMatch) {
      logger.warn(`[ScheduleParser] Не удалось распарсить: "${trimmed}"`);
      continue;
    }

    const titlePart = rangeMatch[1]?.trim() || '';
    const startTime = parseTime(rangeMatch[2]);
    const endTime = parseTime(rangeMatch[3]);

    if (!startTime || !endTime) {
      logger.warn(`[ScheduleParser] Неверный формат времени в: "${trimmed}"`);
      continue;
    }

    // Извлекаем название (всё до времени)
    let title = titlePart || 'Задача';

    // Очищаем название от лишних символов и служебных слов
    title = title.replace(/[:\-→><]/g, '').trim();
    title = title.replace(/[\s\u00A0]+$/g, '');
    title = title.replace(/\s+(с|со|до|по)\s*$/i, '').trim();
    title = title.replace(/(с|со|до|по)\s*$/i, '').trim();

    if (!title) {
      title = 'Задача';
    }

    const category = getCategoryForTask(title);
    const color = CATEGORY_COLORS[category];

    tasks.push({
      title,
      startTime,
      endTime,
      category,
      color,
    });
  }

  return tasks;
}

/**
 * Парсер для более простого формата (по одной задаче в строке)
 * "Работа: 9:00-13:00"
 * "Обед: 13:00-14:00"
 */
export function parseSimpleSchedule(input: string): ParsedTask[] {
  let safeInput = input;
  if (safeInput.length > MAX_SCHEDULE_INPUT_LENGTH) {
    logger.warn('[ScheduleParser] Input too long, truncating');
    safeInput = safeInput.slice(0, MAX_SCHEDULE_INPUT_LENGTH);
  }

  let lines = safeInput.split('\n');
  if (lines.length > MAX_SCHEDULE_ENTRIES) {
    logger.warn('[ScheduleParser] Too many lines, truncating');
    lines = lines.slice(0, MAX_SCHEDULE_ENTRIES);
  }
  const tasks: ParsedTask[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Паттерн: "Название: ВремяСтарт-ВремяКонец" или "Название: ВремяСтарт ВремяКонец"
    // Поддерживает "Работа с 9 до 17", "Учёба 9-17", "Зал 9.30-11.00"
    const match = trimmed.match(
      /^([^:0-9]+?)[\s:]*?(?:\bс\b)?\s*(\d{1,2}(?::\d{2}|\.\d{2})?|\d{1,2}|\d{1,2}\s+\d{2}|\d{1,2}\s*ч)\s*[-–—до|по]\s*(\d{1,2}(?::\d{2}|\.\d{2})?|\d{1,2}|\d{1,2}\s+\d{2}|\d{1,2}\s*ч)/i,
    );

    if (!match) {
      logger.warn(`[ScheduleParser] Не удалось распарсить строку: "${trimmed}"`);
      continue;
    }

    let title = match[1].trim();
    const startTimeStr = match[2];
    const endTimeStr = match[3];

    const startTime = parseTime(startTimeStr);
    const endTime = parseTime(endTimeStr);

    if (!startTime || !endTime) {
      logger.warn(`[ScheduleParser] Неверный формат времени в: "${trimmed}"`);
      continue;
    }

    title = title.replace(/[:\-→><]/g, '').trim();
    title = title.replace(/[\s\u00A0]+$/g, '');
    title = title.replace(/\s+(с|со|до|по)\s*$/i, '').trim();
    title = title.replace(/(с|со|до|по)\s*$/i, '').trim();
    if (!title) title = 'Задача';

    const category = getCategoryForTask(title);
    const color = CATEGORY_COLORS[category];

    tasks.push({
      title,
      startTime,
      endTime,
      category,
      color,
    });
  }

  return tasks;
}

/**
 * Валидация распарсенной задачи
 */
export function validateParsedTask(task: ParsedTask): { valid: boolean; error?: string } {
  if (!task.title || !task.title.trim()) {
    return { valid: false, error: 'Название не может быть пусто' };
  }

  if (!task.startTime || !task.endTime) {
    return { valid: false, error: 'Неверный формат времени' };
  }

  const [sh, sm] = task.startTime.split(':').map(Number);
  const [eh, em] = task.endTime.split(':').map(Number);

  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;

  if (startMinutes >= endMinutes) {
    return { valid: false, error: 'Время окончания должно быть позже времени начала' };
  }

  return { valid: true };
}
