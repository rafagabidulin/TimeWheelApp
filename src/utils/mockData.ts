// utils/mockData.ts
import { Day } from '../types/types';
import { DAYS_DATA, DAYS_OF_WEEK } from '../constants/theme';
import { getDayLabel } from '../i18n';
import { addDays, formatDateISO } from './timeUtils';
import { getWeeklyTemplate, buildTasksForDate } from './templates';

function getStartOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday as start
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

const weekStart = getStartOfWeek(new Date());

export const mockDays: Day[] = DAYS_DATA.map((day, index) => {
  const dayIndex = DAYS_OF_WEEK.indexOf(day.id);
  const resolvedIndex = dayIndex >= 0 ? dayIndex : index;
  const date = addDays(weekStart, resolvedIndex);
  const dateIso = formatDateISO(date);
  const templateTasks = getWeeklyTemplate()[day.id] || [];

  return {
    id: dateIso,
    name: getDayLabel(day.id),
    date: dateIso,
    tasks: buildTasksForDate(date, templateTasks, 'template'),
  };
});
