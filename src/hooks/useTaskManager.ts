import { useState, useCallback, useRef, useEffect } from 'react';
import { Day, Task, FormData } from '../types/types';
import { mockDays } from '../utils/mockData';
import { loadDaysFromStorage, saveDaysToStorage, StorageError } from '../utils/storageUtils';
import { initializeCalendarSync } from '../utils/calendarSync';
import {
  checkForNewCalendarEvents,
  importCalendarEventsToDay,
  removeTaskIfDeletedFromCalendar,
} from '../utils/bidirectionalSync';
import {
  addDays,
  doTimeRangesOverlap,
  formatDateISO,
  isValidTimeRange,
  minutesToTime,
  parseDateISO,
  timeToMinutes,
} from '../utils/timeUtils';
import { DAYS_DATA, DAYS_OF_WEEK } from '../constants/theme';
import { WEEKLY_TEMPLATE, buildTasksForDate } from '../utils/templates';

export function useTaskManager() {
  // ============================================================================
  // STATE
  // ============================================================================

  const [days, setDays] = useState<Day[]>(mockDays);
  const [selectedDate, setSelectedDate] = useState<string>(formatDateISO(new Date()));
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

  const selectedDateObj = parseDateISO(selectedDate) || new Date();

  const getStartOfWeek = (date: Date): Date => {
    const result = new Date(date);
    const day = result.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    result.setDate(result.getDate() + diff);
    result.setHours(0, 0, 0, 0);
    return result;
  };

  const getDayName = (date: Date): string => {
    const day = date.getDay();
    const index = day === 0 ? 6 : day - 1;
    return DAYS_DATA[index]?.name || '';
  };

  const weekStart = getStartOfWeek(selectedDateObj);

  const weekDays = days.length
    ? DAYS_DATA.map((day, index) => {
        const date = addDays(weekStart, index);
        const dateIso = formatDateISO(date);
        const existing = days.find((d) => d.date === dateIso);
        return (
          existing || {
            id: dateIso,
            name: day.name,
            date: dateIso,
            tasks: [],
          }
        );
      })
    : [];

  const currentDay =
    days.find((d) => d.date === selectedDate) || {
      id: selectedDate,
      name: getDayName(selectedDateObj),
      date: selectedDate,
      tasks: [],
    };

  const isCurrentDay = selectedDate === formatDateISO(new Date());

  const tasks = currentDay.tasks || [];

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

  const selectedDateForCalendar = selectedDateObj;

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
    return Math.round(Math.min((totalHours / 24) * 100, 100));
  })();

  const normalizeDays = (inputDays: Day[]): Day[] => {
    const weekStartToday = getStartOfWeek(new Date());

    return inputDays.map((day, index) => {
      const dateFromDay = typeof day.date === 'string' ? parseDateISO(day.date) : null;
      const dateFromId = typeof day.id === 'string' ? parseDateISO(day.id) : null;

      let resolvedDate: Date | null = dateFromDay || dateFromId;

      if (!resolvedDate) {
        const weekdayIndex = DAYS_OF_WEEK.indexOf(day.id as typeof DAYS_OF_WEEK[number]);
        const resolvedIndex = weekdayIndex >= 0 ? weekdayIndex : index;
        resolvedDate = addDays(weekStartToday, resolvedIndex);
      }

      const dateIso = formatDateISO(resolvedDate);
      const tasks = (day.tasks || []).map((task, taskIndex) => ({
        ...task,
        id: task.id || `task-${dateIso}-${taskIndex}`,
        date: dateIso,
      }));

      return {
        ...day,
        id: dateIso,
        name: day.name || getDayName(resolvedDate),
        date: dateIso,
        tasks,
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
            calendarInitializedRef.current = true;
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
      date: day.date,
    }));

    let hasUpdates = false;
    const updatedTasks = day.tasks.map((existing) => {
      if (!existing.calendarEventId) {
        return existing;
      }

      const imported = normalized.find(
        (task) => task.calendarEventId && task.calendarEventId === existing.calendarEventId,
      );
      if (!imported) {
        return existing;
      }

      hasUpdates = true;
      return {
        ...existing,
        title: imported.title,
        startTime: imported.startTime,
        endTime: imported.endTime,
        category: imported.category,
        color: imported.color,
        date: day.date,
      };
    });

    const newTasks = normalized.filter(
      (imported) =>
        !updatedTasks.some(
          (existing) =>
            existing.calendarEventId === imported.calendarEventId || existing.id === imported.id,
        ),
    );

    if (newTasks.length === 0 && !hasUpdates) {
      return day;
    }

    return {
      ...day,
      tasks: [...updatedTasks, ...newTasks],
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
  // СИНХРОНИЗАЦИЯ С КАЛЕНДАРЕМ
  // ============================================================================

  // ============================================================================
  // ФУНКЦИИ РАБОТЫ С ЗАДАЧАМИ
  // ============================================================================

  const validateTask = useCallback(
    (formData: FormData, ignoreTaskId?: string, allowOverlap?: boolean) => {
      if (!formData.title.trim()) {
        throw new Error('Введите название задачи');
      }

      if (!isValidTimeRange(formData.startTime, formData.endTime)) {
        throw new Error('Введите корректное время');
      }

      if (!allowOverlap) {
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
      }
    },
    [currentDay.tasks],
  );

  const addTask = useCallback(
    async (formData: FormData, options?: { allowOverlap?: boolean }) => {
      validateTask(formData, undefined, options?.allowOverlap);

      const newTask: Task = {
        id: `task-${Date.now()}`,
        title: formData.title,
        startTime: formData.startTime,
        endTime: formData.endTime,
        category: formData.category,
        color: formData.color,
        date: selectedDate,
      };

      let nextDays: Day[] = [];
      setDays((prevDays) => {
        const hasDay = prevDays.some((day) => day.date === selectedDate);

        nextDays = hasDay
          ? prevDays.map((day) => {
              if (day.date !== selectedDate) {
                return day;
              }

              if (!options?.allowOverlap) {
                return { ...day, tasks: [...day.tasks, newTask] };
              }

              const newStart = timeToMinutes(newTask.startTime);
              const newEndRaw = timeToMinutes(newTask.endTime);
              const newEnd = newEndRaw <= newStart ? newEndRaw + 24 * 60 : newEndRaw;

              const adjustedTasks = day.tasks
                .map((task) => {
                  const oldStart = timeToMinutes(task.startTime);
                  const oldEndRaw = timeToMinutes(task.endTime);
                  const oldEnd = oldEndRaw <= oldStart ? oldEndRaw + 24 * 60 : oldEndRaw;

                  const hasOverlap = oldStart < newEnd && newStart < oldEnd;
                  if (!hasOverlap) {
                    return task;
                  }

                  if (oldStart < newStart) {
                    const trimmedEnd = newStart;
                    if (trimmedEnd <= oldStart) {
                      return null;
                    }
                    return {
                      ...task,
                      endTime: minutesToTime(trimmedEnd),
                    };
                  }

                  if (oldEnd > newEnd) {
                    const trimmedStart = newEnd;
                    if (oldEnd <= trimmedStart) {
                      return null;
                    }
                    return {
                      ...task,
                      startTime: minutesToTime(trimmedStart),
                    };
                  }

                  return null;
                })
                .filter(Boolean) as Task[];

              return {
                ...day,
                tasks: [...adjustedTasks, newTask],
              };
            })
          : [
              ...prevDays,
              {
                id: selectedDate,
                name: getDayName(selectedDateObj),
                date: selectedDate,
                tasks: [newTask],
              },
            ];

        return nextDays;
      });

      await saveDaysToStorage(nextDays);
    },
    [getDayName, selectedDate, selectedDateObj, validateTask],
  );

  const updateTask = useCallback(
    async (taskId: string, formData: FormData, options?: { allowOverlap?: boolean }) => {
      validateTask(formData, taskId, options?.allowOverlap);

      const updatedDays = days.map((day) => {
        if (day.date !== selectedDate) return day;

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
    },
    [days, selectedDate, validateTask],
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      const updatedDays = days.map((day) =>
        day.date === selectedDate
          ? {
              ...day,
              tasks: day.tasks.filter((t) => t.id !== taskId),
            }
          : day,
      );

      await saveDaysToStorage(updatedDays);
      setDays(updatedDays);

    },
    [days, selectedDate],
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
          await checkForNewCalendarEvents(
            calendarSync.calendarId,
            lastCalendarCheckRef.time,
          );
          lastCalendarCheckRef.time = Date.now();
        }

        const importedTasks = await importCalendarEventsToDay(
          calendarSync.calendarId,
          selectedDateForCalendar,
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
            if (day.date !== selectedDate) {
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
      selectedDateForCalendar,
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
  }, [days.length, selectedDate, syncSelectedDayFromCalendar]);

  const applyWeeklyTemplate = useCallback(async () => {
    const updatedDays: Day[] = [...days];
    let appliedCount = 0;

    DAYS_OF_WEEK.forEach((weekdayId, index) => {
      const date = addDays(weekStart, index);
      const dateIso = formatDateISO(date);
      const existing = updatedDays.find((day) => day.date === dateIso);
      const templateTasks = WEEKLY_TEMPLATE[weekdayId] || [];

      if (templateTasks.length === 0) {
        return;
      }

      if (existing && existing.tasks.length > 0) {
        return;
      }

      const tasksForDate = buildTasksForDate(date, templateTasks, 'template');
      const dayName = DAYS_DATA[index]?.name || getDayName(date);

      if (existing) {
        existing.tasks = tasksForDate;
      } else {
        updatedDays.push({
          id: dateIso,
          name: dayName,
          date: dateIso,
          tasks: tasksForDate,
        });
      }

      appliedCount += 1;
    });

    if (appliedCount > 0) {
      await saveDaysToStorage(updatedDays);
      setDays(updatedDays);
    }

    return appliedCount;
  }, [days, getDayName, weekStart]);

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
    selectedDate,
    days,
    appState,
    setSelectedDate,
    addTask,
    updateTask,
    deleteTask,
    currentDay,
    isCurrentDay,
    tasks: sortedTasks,
    currentTask,
    nextTask,
    loadPercent,
    selectedDateObj: selectedDateForCalendar,
    totalHours,
    weekDays,
    applyWeeklyTemplate,
    storageError,
    clearStorageError,
  };
}
