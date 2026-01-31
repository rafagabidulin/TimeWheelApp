// utils/mockData.ts
import { Day, Task } from '../types/types';
import { DAYS_DATA } from '../constants/theme';
import { addDays, formatDateISO } from './timeUtils';

const baseTasksByDayId: Record<string, Task[]> = {
  monday: [
    {
      id: '1',
      dayId: 'monday',
      title: 'Завтрак',
      startTime: '08:00',
      endTime: '08:30',
      category: 'food',
      color: '#FFC107',
    },
    {
      id: '2',
      dayId: 'monday',
      title: 'Работа',
      startTime: '09:00',
      endTime: '13:00',
      category: 'work',
      color: '#4CAF50',
    },
    {
      id: '3',
      dayId: 'monday',
      title: 'Обед',
      startTime: '13:00',
      endTime: '14:00',
      category: 'food',
      color: '#FFC107',
    },
    {
      id: '4',
      dayId: 'monday',
      title: 'Проект',
      startTime: '14:00',
      endTime: '18:00',
      category: 'work',
      color: '#FF9800',
    },
    {
      id: '5',
      dayId: 'monday',
      title: 'Тренировка',
      startTime: '19:00',
      endTime: '20:00',
      category: 'sports',
      color: '#E91E63',
    },
  ],
  tuesday: [
    {
      id: '6',
      dayId: 'tuesday',
      title: 'Встреча',
      startTime: '10:00',
      endTime: '11:30',
      category: 'work',
      color: '#2196F3',
    },
    {
      id: '7',
      dayId: 'tuesday',
      title: 'Учёба',
      startTime: '12:00',
      endTime: '15:00',
      category: 'study',
      color: '#9C27B0',
    },
  ],
  wednesday: [
    {
      id: '8',
      dayId: 'wednesday',
      title: 'Работа',
      startTime: '08:00',
      endTime: '17:00',
      category: 'work',
      color: '#4CAF50',
    },
  ],
  thursday: [],
  friday: [
    {
      id: '9',
      dayId: 'friday',
      title: 'Презентация',
      startTime: '14:00',
      endTime: '16:00',
      category: 'work',
      color: '#F44336',
    },
  ],
  saturday: [
    {
      id: '10',
      dayId: 'saturday',
      title: 'Хозяйство',
      startTime: '10:00',
      endTime: '13:00',
      category: 'home',
      color: '#795548',
    },
    {
      id: '11',
      dayId: 'saturday',
      title: 'Друзья',
      startTime: '18:00',
      endTime: '22:00',
      category: 'leisure',
      color: '#00BCD4',
    },
  ],
  sunday: [
    {
      id: '12',
      dayId: 'sunday',
      title: 'Отдых',
      startTime: '00:00',
      endTime: '23:59',
      category: 'leisure',
      color: '#9C27B0',
    },
  ],
};

function getStartOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday as start
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

const weekStart = getStartOfWeek(new Date());

export const mockDays: Day[] = DAYS_DATA.map((day, index) => ({
  id: day.id,
  name: day.name,
  date: formatDateISO(addDays(weekStart, index)),
  tasks: baseTasksByDayId[day.id] || [],
}));
