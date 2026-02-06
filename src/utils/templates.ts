import { Task } from '../types/types';
import { CATEGORY_COLORS } from '../constants/theme';
import { formatDateISO } from './timeUtils';
import i18n from '../i18n';

export type TemplateTask = Omit<Task, 'id' | 'date' | 'calendarEventId'>;

export const getWeeklyTemplate = (): Record<string, TemplateTask[]> => ({
  monday: [
    {
      title: i18n.t('templates.breakfast'),
      startTime: '08:00',
      endTime: '08:30',
      category: 'food',
      color: CATEGORY_COLORS.food,
    },
    {
      title: i18n.t('templates.work'),
      startTime: '09:00',
      endTime: '13:00',
      category: 'work',
      color: CATEGORY_COLORS.work,
    },
    {
      title: i18n.t('templates.lunch'),
      startTime: '13:00',
      endTime: '14:00',
      category: 'food',
      color: CATEGORY_COLORS.food,
    },
    {
      title: i18n.t('templates.project'),
      startTime: '14:00',
      endTime: '18:00',
      category: 'work',
      color: '#FF9800',
    },
    {
      title: i18n.t('templates.workout'),
      startTime: '19:00',
      endTime: '20:00',
      category: 'sports',
      color: CATEGORY_COLORS.sports,
    },
  ],
  tuesday: [
    {
      title: i18n.t('templates.meeting'),
      startTime: '10:00',
      endTime: '11:30',
      category: 'work',
      color: CATEGORY_COLORS.work,
    },
    {
      title: i18n.t('templates.study'),
      startTime: '12:00',
      endTime: '15:00',
      category: 'study',
      color: CATEGORY_COLORS.study,
    },
  ],
  wednesday: [
    {
      title: i18n.t('templates.work'),
      startTime: '08:00',
      endTime: '17:00',
      category: 'work',
      color: CATEGORY_COLORS.work,
    },
  ],
  thursday: [],
  friday: [
    {
      title: i18n.t('templates.presentation'),
      startTime: '14:00',
      endTime: '16:00',
      category: 'work',
      color: CATEGORY_COLORS.error,
    },
  ],
  saturday: [
    {
      title: i18n.t('templates.chores'),
      startTime: '10:00',
      endTime: '13:00',
      category: 'home',
      color: CATEGORY_COLORS.home,
    },
    {
      title: i18n.t('templates.friends'),
      startTime: '18:00',
      endTime: '22:00',
      category: 'leisure',
      color: CATEGORY_COLORS.leisure,
    },
  ],
  sunday: [
    {
      title: i18n.t('templates.rest'),
      startTime: '00:00',
      endTime: '23:59',
      category: 'leisure',
      color: CATEGORY_COLORS.leisure,
    },
  ],
});

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
