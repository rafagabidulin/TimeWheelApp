// utils/bidirectionalSync.ts (ИСПРАВЛЕННЫЙ)
import * as Calendar from 'expo-calendar';
import { Day, Task } from '../types/types';
import { v4 as uuidv4 } from 'uuid';
import { formatDateISO, parseDateISO } from './timeUtils';
import { logger } from './logger';

/**
 * Двусторонняя синхронизация между TimeWheel и календарем iPhone
 * Позволяет добавлять события в Календарь и видеть их в TimeWheel
 * ИСПРАВЛЕНО: Обработка события.startDate как Date объекта или строки
 */

const TIMEWHEEL_MARKER = 'TimeWheel App'; // Маркер для идентификации наших событий
const CALENDAR_LOOKBACK_MS = 60 * 1000;

/**
 * Преобразовать значение в Date если нужно
 */
function ensureDate(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  if (typeof value === 'number') {
    return new Date(value);
  }

  return null;
}

/**
 * Получить события TimeWheel из системного календаря iPhone
 * и преобразовать их в задачи TimeWheel
 */
export async function importCalendarEventsToDay(calendarId: string, date: Date): Promise<Task[]> {
  try {
    // Получаем события за день (начало дня до конца дня)
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const events = await Calendar.getEventsAsync([calendarId], startOfDay, endOfDay);

    if (!events || events.length === 0) {
      logger.log('[BidirectionalSync] No events found for date:', date.toDateString());
      return [];
    }

    const importedTasks: Task[] = [];

    for (const event of events) {
      try {
        // Пропускаем all-day события и события TimeWheel (чтобы избежать дублей)
        if (event.allDay || event.notes?.includes(TIMEWHEEL_MARKER)) {
          continue;
        }

        // Преобразуем даты
        const startDate = ensureDate(event.startDate);
        const endDate = ensureDate(event.endDate);

        // Пропускаем события без времени
        if (!startDate || !endDate) {
        logger.warn('[BidirectionalSync] Event has no valid dates:', event.title);
          continue;
        }

        const startHours = startDate.getHours();
        const startMinutes = startDate.getMinutes();
        const endHours = endDate.getHours();
        const endMinutes = endDate.getMinutes();

        const startTime = `${String(startHours).padStart(2, '0')}:${String(startMinutes).padStart(
          2,
          '0',
        )}`;
        const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(
          2,
          '0',
        )}`;

        // Определяем цвет на основе события в календаре
        const color = getColorFromEvent(event);

        // Определяем категорию на основе названия события
        const category = getCategoryFromEventTitle(event.title || '');

        const task: Task = {
          id: `imported-${event.id || uuidv4()}`,
          title: event.title || 'Событие',
          startTime,
          endTime,
          category,
          color,
          date: formatDateISO(date),
          calendarEventId: event.id, // Сохраняем ID события в календаре
        };

        importedTasks.push(task);
        logger.log('[BidirectionalSync] Imported event:', event.title, `${startTime}-${endTime}`);
      } catch (eventError) {
        logger.warn('[BidirectionalSync] Error processing event:', event.title, eventError);
        continue;
      }
    }

    return importedTasks;
  } catch (error) {
    logger.error('[BidirectionalSync] Error importing events:', error);
    return [];
  }
}

/**
 * Синхронизировать все дни с календарем
 * Добавить события из Календаря в соответствующие дни
 */
export async function syncCalendarToDays(days: Day[], calendarId: string): Promise<Day[]> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // Ищем события за неделю назад
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7); // И на неделю вперед
    endDate.setHours(23, 59, 59, 999);

    const events = await Calendar.getEventsAsync([calendarId], startDate, endDate);

    if (!events || events.length === 0) {
      logger.log('[BidirectionalSync] No events in calendar to sync');
      return days;
    }

    let syncedDays = [...days];
    let syncedCount = 0;

    for (const event of events) {
      try {
        // Пропускаем all-day события и события TimeWheel
        if (event.allDay || event.notes?.includes(TIMEWHEEL_MARKER)) {
          continue;
        }

        // Преобразуем дату
        const eventStartDate = ensureDate(event.startDate);
        if (!eventStartDate) {
          continue;
        }

        // Находим день для этого события
        const eventDate = new Date(eventStartDate);
        eventDate.setHours(0, 0, 0, 0);

        const dayIndex = syncedDays.findIndex((d) => {
          const dayDate = parseDateISO(d.date);
          if (!dayDate) {
            return false;
          }
          return (
            dayDate.getFullYear() === eventDate.getFullYear() &&
            dayDate.getMonth() === eventDate.getMonth() &&
            dayDate.getDate() === eventDate.getDate()
          );
        });

        if (dayIndex === -1) {
          logger.warn('[BidirectionalSync] Day not found for event:', event.title);
          continue;
        }

        const day = syncedDays[dayIndex];

        // Проверяем что такой event ID уже не добавлен
        const taskExists = day.tasks.some(
          (t) => t.calendarEventId === event.id || t.id === `imported-${event.id}`,
        );

        if (taskExists) {
          logger.log('[BidirectionalSync] Task already imported:', event.title);
          continue;
        }

        // Преобразуем события в задачу
        const startDate = ensureDate(event.startDate);
        const endDate = ensureDate(event.endDate);

        if (!startDate || !endDate) {
          logger.warn('[BidirectionalSync] Event has no valid dates:', event.title);
          continue;
        }

        const startHours = startDate.getHours();
        const startMinutes = startDate.getMinutes();
        const endHours = endDate.getHours();
        const endMinutes = endDate.getMinutes();

        const startTime = `${String(startHours).padStart(2, '0')}:${String(startMinutes).padStart(
          2,
          '0',
        )}`;
        const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(
          2,
          '0',
        )}`;

        const task: Task = {
          id: `imported-${event.id || uuidv4()}`,
          title: event.title || 'Событие',
          startTime,
          endTime,
          category: getCategoryFromEventTitle(event.title || ''),
          color: getColorFromEvent(event),
          date: day.date,
          calendarEventId: event.id,
        };

        syncedDays[dayIndex].tasks.push(task);
        syncedCount++;
        logger.log('[BidirectionalSync] Synced event to day:', event.title);
      } catch (eventError) {
        logger.warn('[BidirectionalSync] Error syncing event:', event.title, eventError);
        continue;
      }
    }

    logger.log('[BidirectionalSync] Synced', syncedCount, 'events total');
    return syncedDays;
  } catch (error) {
    logger.error('[BidirectionalSync] Error syncing calendar:', error);
    return days;
  }
}

/**
 * Получить цвет из события календаря
 */
function getColorFromEvent(event: Calendar.Event): string {
  try {
    // Используем цвет события если доступен, иначе дефолтный
    const eventColor = event.color;

    if (eventColor) {
      return eventColor;
    }

    // Карта цветов календаря iOS
    const colorMap: { [key: string]: string } = {
      red: '#FF3B30',
      orange: '#FF9500',
      yellow: '#FFCC00',
      green: '#4CD964',
      cyan: '#50B7C4',
      blue: '#007AFF',
      purple: '#AF52DE',
      pink: '#FF2D55',
      gray: '#A2AAAD',
    };

    return colorMap[eventColor] || '#4CAF50'; // Дефолтный зеленый
  } catch (error) {
    logger.warn('[BidirectionalSync] Error getting event color:', error);
    return '#4CAF50';
  }
}

/**
 * Определить категорию на основе названия события
 */
function getCategoryFromEventTitle(title: string): string {
  const titleLower = title.toLowerCase();

  if (
    /работ|встреча|презентац|проект|офис|совещан|деловой|бизнес|meeting|call|conference/i.test(
      titleLower,
    )
  ) {
    return 'work';
  }
  if (
    /завтрак|обед|ужин|перекус|кофе|чай|еда|ресторан|кафе|lunch|breakfast|dinner/i.test(titleLower)
  ) {
    return 'food';
  }
  if (
    /тренир|спорт|бег|йога|гимнаст|плаван|фитнес|зарядк|спортзал|gym|run|yoga|workout/i.test(
      titleLower,
    )
  ) {
    return 'sports';
  }
  if (
    /учёб|лекц|семинар|занят|курс|урок|практик|школа|универ|class|study|lecture/i.test(titleLower)
  ) {
    return 'study';
  }
  if (
    /кино|театр|концерт|друз|игр|развлеч|выход|прогулк|отдых|вечер|развлечение|movie|concert|party/i.test(
      titleLower,
    )
  ) {
    return 'leisure';
  }
  if (
    /дом|уборк|готов|хозяйств|стирк|уход|ремонт|покупк|магазин|clean|shopping|home/i.test(
      titleLower,
    )
  ) {
    return 'home';
  }

  return 'custom';
}

/**
 * Проверить есть ли новые события в календаре с момента последней синхро
 * (для автоматической фоновой синхро)
 */
export async function checkForNewCalendarEvents(
  calendarId: string,
  lastSyncTime: number, // timestamp последней синхро
): Promise<boolean> {
  try {
    const now = Date.now();
    const lastSync = new Date(lastSyncTime);
    const checkStart = new Date(lastSync.getTime() - CALENDAR_LOOKBACK_MS); // За минуту до синхро

    const events = await Calendar.getEventsAsync([calendarId], checkStart, new Date(now));

    if (!events || events.length === 0) {
      return false;
    }

    // Проверяем есть ли события созданные после последней синхро
    const newEvents = events.filter((e) => {
      if (!e.creationDate) return false;
      const creationDate = ensureDate(e.creationDate);
      return creationDate && creationDate.getTime() > lastSyncTime;
    });

    return newEvents.length > 0;
  } catch (error) {
    logger.error('[BidirectionalSync] Error checking for new events:', error);
    return false;
  }
}

/**
 * Удалить задачу если её удалили в календаре
 */
export async function removeTaskIfDeletedFromCalendar(
  tasks: Task[],
  calendarId: string,
): Promise<Task[]> {
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const calendarEvents = await Calendar.getEventsAsync([calendarId], weekAgo, now);
    const eventIds = new Set(calendarEvents.map((e) => e.id));

    // Удаляем импортированные задачи которых нет в календаре
    return tasks.filter((task) => {
      if (!task.calendarEventId) {
        return true; // Оставляем локальные задачи
      }

      if (!eventIds.has(task.calendarEventId)) {
        logger.log('[BidirectionalSync] Task deleted from calendar:', task.title);
        return false; // Удаляем если события нет в календаре
      }

      return true;
    });
  } catch (error) {
    logger.error('[BidirectionalSync] Error removing deleted tasks:', error);
    return tasks;
  }
}
