// utils/scheduleParser.ts
import { FormData } from '../types/types';

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
 * "9:00", "9:30", "09:00", "09:30"
 */
function parseTime(timeStr: string): string | null {
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);

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

  // Разделяем по запятым и точкам с запятой
  const entries = input.split(/[,;]/);

  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    // Паттерн: "Название ВРЕМЯ-ВРЕМЯ" или "Название ВРЕМЯ ВРЕМЯ"
    // Примеры:
    // "Работа 9:00-13:00"
    // "Обед 13:00-14:00"
    // "Завтрак 8:00 - 8:30"
    // "Встреча с боссом 10:00-11:30"

    // Ищем все вхождения времени
    const timeMatches = trimmed.match(/\d{1,2}:\d{2}/g);

    if (!timeMatches || timeMatches.length < 2) {
      // Если нет двух времён, пропускаем эту запись
      console.warn(`[ScheduleParser] Не удалось распарсить: "${trimmed}"`);
      continue;
    }

    const startTimeStr = timeMatches[0];
    const endTimeStr = timeMatches[1];

    const startTime = parseTime(startTimeStr);
    const endTime = parseTime(endTimeStr);

    if (!startTime || !endTime) {
      console.warn(`[ScheduleParser] Неверный формат времени в: "${trimmed}"`);
      continue;
    }

    // Извлекаем название (всё до первого времени)
    const titleMatch = trimmed.match(/^([^0-9]+)/);
    let title = titleMatch ? titleMatch[1].trim() : 'Задача';

    // Очищаем название от лишних символов
    title = title.replace(/[:\-→><]/g, '').trim();

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
  const lines = input.split('\n');
  const tasks: ParsedTask[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Паттерн: "Название: ВремяСтарт-ВремяКонец" или "Название: ВремяСтарт ВремяКонец"
    const match = trimmed.match(/^([^:0-9]+?)[\s:]*(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/);

    if (!match) {
      console.warn(`[ScheduleParser] Не удалось распарсить строку: "${trimmed}"`);
      continue;
    }

    let title = match[1].trim();
    const startTimeStr = match[2];
    const endTimeStr = match[3];

    const startTime = parseTime(startTimeStr);
    const endTime = parseTime(endTimeStr);

    if (!startTime || !endTime) {
      console.warn(`[ScheduleParser] Неверный формат времени в: "${trimmed}"`);
      continue;
    }

    title = title.replace(/[:\-→><]/g, '').trim();
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
