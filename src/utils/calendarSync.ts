// utils/calendarSync.ts (ИСПРАВЛЕННЫЙ)
import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import { Task } from '../types/types';

/**
 * Управление синхронизацией с календарем iPhone
 * Исправлено: использует существующие календари вместо создания новых
 */

const TIMEWHEEL_CALENDAR_NAME = 'TimeWheel';

/**
 * Проверка разрешений на доступ к календарю
 */
export async function requestCalendarPermissions(): Promise<boolean> {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('[CalendarSync] Permission error:', error);
    return false;
  }
}

/**
 * Получение ID календаря TimeWheel или использование календаря по умолчанию
 * Исправлено: если не может создать, использует календарь "Календарь" или первый доступный
 */
export async function getOrCreateTimeWheelCalendar(): Promise<string | null> {
  try {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);

    if (!calendars || calendars.length === 0) {
      console.warn('[CalendarSync] No calendars available');
      return null;
    }

    // Ищем существующий календарь TimeWheel
    let timeWheelCal = calendars.find(
      (cal) => cal.title === TIMEWHEEL_CALENDAR_NAME && !cal.isPrimaryForSource,
    );

    if (timeWheelCal) {
      console.log('[CalendarSync] Found existing TimeWheel calendar:', timeWheelCal.id);
      return timeWheelCal.id;
    }

    // Если iOS и можно создать календарь
    if (Platform.OS === 'ios') {
      try {
        const defaultSource = await Calendar.getDefaultCalendarAsync();

        if (defaultSource) {
          const calendarId = await Calendar.createCalendarAsync({
            title: TIMEWHEEL_CALENDAR_NAME,
            color: '#2196F3',
            entityType: Calendar.EntityTypes.EVENT,
            source: defaultSource,
            name: TIMEWHEEL_CALENDAR_NAME,
          });

          console.log('[CalendarSync] Created new TimeWheel calendar:', calendarId);
          return calendarId;
        }
      } catch (createError) {
        console.warn(
          '[CalendarSync] Cannot create new calendar, using default:',
          createError instanceof Error ? createError.message : 'Unknown error',
        );

        // Fallback: используем календарь по умолчанию (обычно "Календарь")
        const primaryCalendar = calendars.find((cal) => cal.isPrimaryForSource);
        if (primaryCalendar) {
          console.log('[CalendarSync] Using primary calendar:', primaryCalendar.id);
          return primaryCalendar.id;
        }

        // Если нет primary, используем первый доступный
        if (calendars[0]) {
          console.log('[CalendarSync] Using first available calendar:', calendars[0].id);
          return calendars[0].id;
        }
      }
    }

    return null;
  } catch (error) {
    console.error('[CalendarSync] Error getting calendar:', error);
    return null;
  }
}

/**
 * Преобразование Task в Event для календаря
 */
function taskToCalendarEvent(task: Task, date: Date) {
  const [startHour, startMin] = task.startTime.split(':').map(Number);
  const [endHour, endMin] = task.endTime.split(':').map(Number);

  const startDate = new Date(date);
  startDate.setHours(startHour, startMin, 0);

  const endDate = new Date(date);
  endDate.setHours(endHour, endMin, 0);

  return {
    title: task.title,
    startDate,
    endDate,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    notes: `Category: ${task.category} | TimeWheel App`,
    allDay: false,
  };
}

/**
 * Добавление задачи в календарь iPhone
 */
export async function addTaskToCalendar(task: Task, date: Date): Promise<string | null> {
  try {
    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) {
      console.warn('[CalendarSync] No permission to access calendar');
      return null;
    }

    const calendarId = await getOrCreateTimeWheelCalendar();
    if (!calendarId) {
      console.warn('[CalendarSync] Could not get calendar ID');
      return null;
    }

    const eventData = taskToCalendarEvent(task, date);

    const eventId = await Calendar.createEventAsync(calendarId, eventData);

    console.log('[CalendarSync] Event created:', eventId);
    return eventId;
  } catch (error) {
    console.error('[CalendarSync] Error adding event:', error);
    return null;
  }
}

/**
 * Обновление задачи в календаре iPhone
 */
export async function updateTaskInCalendar(
  task: Task,
  date: Date,
  calendarEventId: string,
): Promise<boolean> {
  try {
    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) {
      return false;
    }

    const calendarId = await getOrCreateTimeWheelCalendar();
    if (!calendarId) {
      return false;
    }

    const eventData = taskToCalendarEvent(task, date);

    await Calendar.updateEventAsync(calendarEventId, eventData, {
      futureEvents: false,
    });

    console.log('[CalendarSync] Event updated:', calendarEventId);
    return true;
  } catch (error) {
    console.error('[CalendarSync] Error updating event:', error);
    return false;
  }
}

/**
 * Удаление задачи из календаря iPhone
 */
export async function removeTaskFromCalendar(calendarEventId: string): Promise<boolean> {
  try {
    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) {
      return false;
    }

    await Calendar.deleteEventAsync(calendarEventId, {
      futureEvents: false,
    });

    console.log('[CalendarSync] Event deleted:', calendarEventId);
    return true;
  } catch (error) {
    console.error('[CalendarSync] Error deleting event:', error);
    return false;
  }
}

/**
 * Получение всех событий TimeWheel из системного календаря
 */
export async function getTimeWheelEventsFromCalendar(
  startDate: Date,
  endDate: Date,
): Promise<Calendar.Event[]> {
  try {
    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) {
      return [];
    }

    const calendarId = await getOrCreateTimeWheelCalendar();
    if (!calendarId) {
      return [];
    }

    const events = await Calendar.getEventsAsync([calendarId], startDate, endDate);

    // Фильтруем только TimeWheel события (содержат наш маркер в notes)
    return events.filter(
      (event) => event.title && !event.allDay && event.notes?.includes('TimeWheel'),
    );
  } catch (error) {
    console.error('[CalendarSync] Error getting events:', error);
    return [];
  }
}

/**
 * Инициализация синхронизации при запуске приложения
 */
export async function initializeCalendarSync(): Promise<{
  hasPermission: boolean;
  calendarId: string | null;
}> {
  try {
    const hasPermission = await requestCalendarPermissions();
    const calendarId = await getOrCreateTimeWheelCalendar();

    if (hasPermission && calendarId) {
      console.log('[CalendarSync] ✓ Calendar sync ready');
    } else if (!hasPermission) {
      console.warn('[CalendarSync] ⚠ Calendar permission not granted');
    } else {
      console.warn('[CalendarSync] ⚠ Could not get calendar');
    }

    return {
      hasPermission,
      calendarId,
    };
  } catch (error) {
    console.error('[CalendarSync] Initialization error:', error);
    return {
      hasPermission: false,
      calendarId: null,
    };
  }
}
