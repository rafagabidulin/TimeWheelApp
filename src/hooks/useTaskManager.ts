import { useState, useCallback, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Day, Task, FormData } from '../types/types';
import { mockDays } from '../utils/mockData';
import { loadDaysFromStorage, saveDaysToStorage, StorageError } from '../utils/storageUtils';
import {
  addTaskToCalendar,
  removeTaskFromCalendar,
  updateTaskInCalendar,
  initializeCalendarSync,
} from '../utils/calendarSync';
import {
  checkForNewCalendarEvents,
  importCalendarEventsToDay,
  removeTaskIfDeletedFromCalendar,
} from '../utils/bidirectionalSync';
import {
  addDays,
  doTimeRangesOverlap,
  formatDateISO,
  getCurrentDayId,
  isValidTimeRange,
  parseDateISO,
} from '../utils/timeUtils';

export function useTaskManager() {
  // ============================================================================
  // STATE
  // ============================================================================

  const [days, setDays] = useState<Day[]>(mockDays);
  const [selectedDayId, setSelectedDayId] = useState<string>(getCurrentDayId());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [appState, setAppState] = useState('active');
  const [storageError, setStorageError] = useState<string | null>(null);

  // ============================================================================
  // REFS И ДРУГИЕ ЗНАЧЕНИЯ
  // ============================================================================

  const calendarInitializedRef = useRef(false);
  const calendarCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const calendarSyncInProgressRef = useRef(false);
  const [lastCalendarCheckRef] = useState(() => ({ time: Date.now() }));

  // ============================================================================
  // ВЫЧИСЛЯЕМЫЕ ЗНАЧЕНИЯ
  // ============================================================================

  const currentDay = days.find((d) => d.id === selectedDayId) || days[0];
  const isCurrentDay = currentDay?.date === formatDateISO(new Date());

  const tasks = currentDay?.tasks || [];

  // Сортируем задачи по времени
  const sortedTasks = [...tasks].sort((a, b) => {
    const timeA = parseInt(a.startTime.replace(':', ''));
    const timeB = parseInt(b.startTime.replace(':', ''));
    return timeA - timeB;
  });

  const currentTask = sortedTasks.find((task) => {
    const taskStartTime = parseInt(task.startTime.replace(':', ''));
    const taskEndTime = parseInt(task.endTime.replace(':', ''));
    const currentTimeValue = parseInt(
      `${String(currentTime.getHours()).padStart(2, '0')}${String(
        currentTime.getMinutes(),
      ).padStart(2, '0')}`,
    );
    return currentTimeValue >= taskStartTime && currentTimeValue < taskEndTime;
  });

  const nextTask = sortedTasks.find((task) => {
    const taskStartTime = parseInt(task.startTime.replace(':', ''));
    const currentTimeValue = parseInt(
      `${String(currentTime.getHours()).padStart(2, '0')}${String(
        currentTime.getMinutes(),
      ).padStart(2, '0')}`,
    );
    return taskStartTime > currentTimeValue;
  });

  const selectedDate =
    parseDateISO(currentDay?.date || '') || new Date();

  const totalHours =
    currentDay?.tasks.reduce((sum, task) => {
      const [startHour, startMin] = task.startTime.split(':').map(Number);
      const [endHour, endMin] = task.endTime.split(':').map(Number);

      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      const duration = (endMinutes - startMinutes) / 60;

      return sum + (duration > 0 ? duration : 0);
    }, 0) || 0;

  const loadPercent = (() => {
    if (totalHours === 0) return 0;
    return Math.min((totalHours / 24) * 100, 100);
  })();

  const getStartOfWeek = (date: Date): Date => {
    const result = new Date(date);
    const day = result.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    result.setDate(result.getDate() + diff);
    result.setHours(0, 0, 0, 0);
    return result;
  };

  const normalizeDays = (inputDays: Day[]): Day[] => {
    const weekStart = getStartOfWeek(new Date());

    return inputDays.map((day, index) => {
      const rawDate = (day as any).date;
      if (typeof rawDate === 'string') {
        const parsed = parseDateISO(rawDate);
        if (parsed) {
          return day;
        }
      }

      if (typeof rawDate === 'number') {
        const rawMonth =
          typeof (day as any).month === 'number'
            ? (day as any).month
            : new Date().getMonth() + 1;
        const dateObj = new Date(new Date().getFullYear(), rawMonth - 1, rawDate);
        return {
          ...day,
          date: formatDateISO(dateObj),
        };
      }

      return {
        ...day,
        date: formatDateISO(addDays(weekStart, index)),
      };
    });
  };

  // ============================================================================
  // ФУНКЦИИ РАБОТЫ С ХРАНИЛИЩЕМ
  // ============================================================================

  const loadDaysFromStorageWrapper = useCallback(async () => {
    try {
      if (!calendarInitializedRef.current) {
        const calendarSync = await initializeCalendarSync();
        if (calendarSync.hasPermission && calendarSync.calendarId) {
          console.log('[useTaskManager] Calendar sync initialized');

          let loaded = await loadDaysFromStorage();
          if (loaded.length === 0) {
            loaded = mockDays;
          }

          // Синхронизируем события из календаря в дни
          try {
            const normalized = normalizeDays(loaded);
            const syncedDays = await syncCalendarToAllDays(normalized, calendarSync.calendarId);
            await saveDaysToStorage(syncedDays);
            setDays(syncedDays);
            console.log('[useTaskManager] Calendar events synced to days');
            return;
          } catch (syncError) {
            console.warn('[useTaskManager] Calendar sync error:', syncError);
          }
        }
        calendarInitializedRef.current = true;
      }

      const loaded = await loadDaysFromStorage();
      if (loaded.length > 0) {
        const normalized = normalizeDays(loaded);
        setDays(normalized);
        await saveDaysToStorage(normalized);
      } else {
        await saveDaysToStorage(mockDays);
        setDays(mockDays);
      }
      setStorageError(null);
    } catch (error) {
      const message = error instanceof StorageError ? error.message : 'Unknown error';
      setStorageError(message);
      console.error('[useTaskManager] Failed to load days:', error);
      setDays(mockDays);
    }
  }, []);

  const applyImportedTasksToDay = useCallback((day: Day, importedTasks: Task[]): Day => {
    const normalized = importedTasks.map((task) => ({
      ...task,
      dayId: day.id,
    }));

    const newTasks = normalized.filter(
      (imported) =>
        !day.tasks.some(
          (existing) =>
            existing.calendarEventId === imported.calendarEventId || existing.id === imported.id,
        ),
    );

    if (newTasks.length === 0) {
      return day;
    }

    return {
      ...day,
      tasks: [...day.tasks, ...newTasks],
    };
  }, []);

  /**
   * Синхронизировать события из календаря для всех дней
   */
  const syncCalendarToAllDays = useCallback(
    async (daysToSync: Day[], calendarId: string): Promise<Day[]> => {
      try {
        let syncedDays = [...daysToSync];

        for (const day of daysToSync) {
          try {
            const dayDate = parseDateISO(day.date) || new Date(day.date);
            const importedTasks = await importCalendarEventsToDay(calendarId, dayDate);

            if (importedTasks.length === 0) {
              continue;
            }

            const updatedDay = applyImportedTasksToDay(day, importedTasks);
            syncedDays = syncedDays.map((d) => (d.id === day.id ? updatedDay : d));
          } catch (dayError) {
            console.warn('[useTaskManager] Error syncing day:', day.id, dayError);
            continue;
          }
        }

        return syncedDays;
      } catch (error) {
        console.error('[useTaskManager] Error syncing calendar to days:', error);
        return daysToSync;
      }
    },
    [applyImportedTasksToDay],
  );

  // ============================================================================
  // ФУНКЦИИ РАБОТЫ С ЗАДАЧАМИ
  // ============================================================================

  const validateTask = useCallback(
    (formData: FormData, ignoreTaskId?: string) => {
      if (!formData.title.trim()) {
        throw new Error('Введите название задачи');
      }

      if (!isValidTimeRange(formData.startTime, formData.endTime)) {
        throw new Error('Введите корректное время');
      }

      const hasOverlap = currentDay.tasks.some(
        (task) =>
          task.id !== ignoreTaskId &&
          doTimeRangesOverlap(
            formData.startTime,
            formData.endTime,
            task.startTime,
            task.endTime,
          ),
      );

      if (hasOverlap) {
        throw new Error('Задача пересекается с уже существующей');
      }
    },
    [currentDay.tasks],
  );

  const addTask = useCallback(
    async (formData: FormData) => {
      validateTask(formData);

      const newTask: Task = {
        id: `task-${Date.now()}`,
        title: formData.title,
        startTime: formData.startTime,
        endTime: formData.endTime,
        category: formData.category,
        color: formData.color,
        dayId: currentDay.id,
      };

      const updatedDays = days.map((day) =>
        day.id === currentDay.id ? { ...day, tasks: [...day.tasks, newTask] } : day,
      );

      await saveDaysToStorage(updatedDays);
      setDays(updatedDays);

      // Синхронизируем в календарь
      const eventId = await syncTaskToCalendar(newTask);
      if (eventId) {
        setDays((prevDays) => {
          const withEventId = prevDays.map((day) =>
            day.id === currentDay.id
              ? {
                  ...day,
                  tasks: day.tasks.map((task) =>
                    task.id === newTask.id ? { ...task, calendarEventId: eventId } : task,
                  ),
                }
              : day,
          );
          saveDaysToStorage(withEventId).catch((error) => {
            console.error('[useTaskManager] Error saving calendar event ID:', error);
          });
          return withEventId;
        });
      }
    },
    [days, currentDay, syncTaskToCalendar, validateTask],
  );

  const updateTask = useCallback(
    async (taskId: string, formData: FormData) => {
      validateTask(formData, taskId);

      const updatedDays = days.map((day) => {
        if (day.id !== currentDay.id) return day;

        return {
          ...day,
          tasks: day.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  title: formData.title,
                  startTime: formData.startTime,
                  endTime: formData.endTime,
                  category: formData.category,
                  color: formData.color,
                }
              : task,
          ),
        };
      });

      await saveDaysToStorage(updatedDays);
      setDays(updatedDays);

      const updatedTask = updatedDays
        .find((day) => day.id === currentDay.id)
        ?.tasks.find((task) => task.id === taskId);

      if (updatedTask?.calendarEventId) {
        await updateTaskInCalendar(updatedTask, selectedDate, updatedTask.calendarEventId);
      } else if (updatedTask) {
        const eventId = await syncTaskToCalendar(updatedTask);
        if (eventId) {
          setDays((prevDays) => {
            const withEventId = prevDays.map((day) =>
              day.id === currentDay.id
                ? {
                    ...day,
                    tasks: day.tasks.map((task) =>
                      task.id === updatedTask.id
                        ? { ...task, calendarEventId: eventId }
                        : task,
                    ),
                  }
                : day,
            );
            saveDaysToStorage(withEventId).catch((error) => {
              console.error('[useTaskManager] Error saving calendar event ID:', error);
            });
            return withEventId;
          });
        }
      }
    },
    [days, currentDay, selectedDate, syncTaskToCalendar, validateTask],
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      const updatedDays = days.map((day) =>
        day.id === currentDay.id
          ? {
              ...day,
              tasks: day.tasks.filter((t) => t.id !== taskId),
            }
          : day,
      );

      await saveDaysToStorage(updatedDays);
      setDays(updatedDays);

      // Удаляем из календаря если это импортированное событие
      const taskToDelete = currentDay.tasks.find((t) => t.id === taskId);
      if (taskToDelete?.calendarEventId) {
        await deleteTaskFromCalendar(taskToDelete);
      }
    },
    [days, currentDay],
  );

  // ============================================================================
  // СИНХРОНИЗАЦИЯ С КАЛЕНДАРЕМ
  // ============================================================================

  const syncTaskToCalendar = useCallback(
    async (task: Task): Promise<string | null> => {
      try {
        const eventId = await addTaskToCalendar(task, selectedDate);
        if (eventId) {
          console.log('[useTaskManager] Task synced to calendar:', eventId);
        }
        return eventId;
      } catch (error) {
        console.warn('[useTaskManager] Error syncing task to calendar:', error);
        return null;
      }
    },
    [],
  );

  const deleteTaskFromCalendar = useCallback(
    async (task: Task) => {
      try {
        if (!task.calendarEventId) return;

        const removed = await removeTaskFromCalendar(task.calendarEventId);
        if (removed) {
          console.log('[useTaskManager] Task deleted from calendar:', task.calendarEventId);
        }
      } catch (error) {
        console.warn('[useTaskManager] Error deleting task from calendar:', error);
      }
    },
    [selectedDate],
  );

  const syncSelectedDayFromCalendar = useCallback(
    async (reason: 'interval' | 'day-change') => {
      if (calendarSyncInProgressRef.current) {
        return;
      }

      calendarSyncInProgressRef.current = true;
      try {
        const calendarSync = await initializeCalendarSync();
        if (!calendarSync.calendarId || !calendarSync.hasPermission) {
          return;
        }

        if (reason === 'interval') {
          const hasNewEvents = await checkForNewCalendarEvents(
            calendarSync.calendarId,
            lastCalendarCheckRef.time,
          );
          lastCalendarCheckRef.time = Date.now();
          if (!hasNewEvents) {
            return;
          }
        }

        const importedTasks = await importCalendarEventsToDay(
          calendarSync.calendarId,
          selectedDate,
        );

        const cleanedTasks = await removeTaskIfDeletedFromCalendar(
          currentDay.tasks,
          calendarSync.calendarId,
        );

        if (importedTasks.length === 0 && cleanedTasks.length === currentDay.tasks.length) {
          return;
        }

        setDays((prevDays) => {
          const updatedDays = prevDays.map((day) => {
            if (day.id !== selectedDayId) {
              return day;
            }

            const normalizedDay =
              cleanedTasks.length === day.tasks.length ? day : { ...day, tasks: cleanedTasks };

            return applyImportedTasksToDay(normalizedDay, importedTasks);
          });

          saveDaysToStorage(updatedDays).catch((error) => {
            console.error('[useTaskManager] Error saving synced days:', error);
          });

          return updatedDays;
        });
      } catch (error) {
        console.warn('[useTaskManager] Calendar sync error:', error);
      } finally {
        calendarSyncInProgressRef.current = false;
      }
    },
    [
      applyImportedTasksToDay,
      currentDay.tasks,
      selectedDate,
      selectedDayId,
    ],
  );

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Инициализация при загрузке
  useEffect(() => {
    loadDaysFromStorageWrapper();

    return () => {
      if (calendarCheckIntervalRef.current) {
        clearInterval(calendarCheckIntervalRef.current);
      }
    };
  }, [loadDaysFromStorageWrapper]);

  // Обновление текущего времени
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Периодическая проверка календаря (каждые 15 сек)
  useEffect(() => {
    if (!calendarInitializedRef.current) {
      return;
    }

    calendarCheckIntervalRef.current = setInterval(async () => {
      await syncSelectedDayFromCalendar('interval');
    }, 15000);

    return () => {
      if (calendarCheckIntervalRef.current) {
        clearInterval(calendarCheckIntervalRef.current);
      }
    };
  }, [syncSelectedDayFromCalendar]);

  // Синхро при смене дня
  useEffect(() => {
    if (!calendarInitializedRef.current || days.length === 0) {
      return;
    }

    syncSelectedDayFromCalendar('day-change');
  }, [days.length, selectedDayId, selectedDate, syncSelectedDayFromCalendar]);

  // ============================================================================
  // ФУНКЦИЯ ОЧИСТКИ ОШИБОК
  // ============================================================================

  const clearStorageError = useCallback(() => {
    setStorageError(null);
  }, []);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    currentTime,
    selectedDayId,
    days,
    appState,
    setSelectedDayId,
    addTask,
    updateTask,
    deleteTask,
    currentDay,
    isCurrentDay,
    tasks: sortedTasks,
    currentTask,
    nextTask,
    loadPercent,
    selectedDate,
    totalHours,
    storageError,
    clearStorageError,
  };
}
