import { Task } from '../types/types';
import { CATEGORY_COLORS } from '../constants/theme';
import { formatDateISO } from './timeUtils';

export type TemplateTask = Omit<Task, 'id' | 'date' | 'calendarEventId'>;

export const WEEKLY_TEMPLATE: Record<string, TemplateTask[]> = {
  monday: [
    {
      title: 'Завтрак',
      startTime: '08:00',
      endTime: '08:30',
      category: 'food',
      color: CATEGORY_COLORS.food,
    },
    {
      title: 'Работа',
      startTime: '09:00',
      endTime: '13:00',
      category: 'work',
      color: CATEGORY_COLORS.work,
    },
    {
      title: 'Обед',
      startTime: '13:00',
      endTime: '14:00',
      category: 'food',
      color: CATEGORY_COLORS.food,
    },
    {
      title: 'Проект',
      startTime: '14:00',
      endTime: '18:00',
      category: 'work',
      color: '#FF9800',
    },
    {
      title: 'Тренировка',
      startTime: '19:00',
      endTime: '20:00',
      category: 'sports',
      color: CATEGORY_COLORS.sports,
    },
  ],
  tuesday: [
    {
      title: 'Встреча',
      startTime: '10:00',
      endTime: '11:30',
      category: 'work',
      color: CATEGORY_COLORS.work,
    },
    {
      title: 'Учёба',
      startTime: '12:00',
      endTime: '15:00',
      category: 'study',
      color: CATEGORY_COLORS.study,
    },
  ],
  wednesday: [
    {
      title: 'Работа',
      startTime: '08:00',
      endTime: '17:00',
      category: 'work',
      color: CATEGORY_COLORS.work,
    },
  ],
  thursday: [],
  friday: [
    {
      title: 'Презентация',
      startTime: '14:00',
      endTime: '16:00',
      category: 'work',
      color: CATEGORY_COLORS.error,
    },
  ],
  saturday: [
    {
      title: 'Хозяйство',
      startTime: '10:00',
      endTime: '13:00',
      category: 'home',
      color: CATEGORY_COLORS.home,
    },
    {
      title: 'Друзья',
      startTime: '18:00',
      endTime: '22:00',
      category: 'leisure',
      color: CATEGORY_COLORS.leisure,
    },
  ],
  sunday: [
    {
      title: 'Отдых',
      startTime: '00:00',
      endTime: '23:59',
      category: 'leisure',
      color: CATEGORY_COLORS.leisure,
    },
  ],
};

export function buildTasksForDate(
  date: Date,
  templateTasks: TemplateTask[],
  idPrefix: string,
): Task[] {
  const isoDate = formatDateISO(date);
  return templateTasks.map((task, index) => ({
    ...task,
    id: `${idPrefix}-${isoDate}-${index}`,
    date: isoDate,
  }));
}
