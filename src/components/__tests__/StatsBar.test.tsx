import React from 'react';
import { render } from '@testing-library/react-native';
import StatsBar from '../StatsBar';
import { Task } from '../../types/types';

describe('StatsBar', () => {
  const nextTask: Task = {
    id: 'task-1',
    date: '2025-01-05',
    title: 'Встреча',
    startTime: '10:00',
    endTime: '11:00',
    category: 'work',
    color: '#000',
  };

  it('shows next task info for current day', () => {
    const { getByText } = render(
      <StatsBar loadPercent={25} nextTask={nextTask} isCurrentDay={true} />,
    );

    expect(getByText('Загрузка: 25%')).toBeTruthy();
    expect(getByText('⏰ Следующая: Встреча 10:00')).toBeTruthy();
  });

  it('shows completed message when no next task', () => {
    const { getByText } = render(
      <StatsBar loadPercent={80} nextTask={undefined} isCurrentDay={true} />,
    );

    expect(getByText('✅ Все задачи завершены')).toBeTruthy();
  });

  it('shows non-current day message', () => {
    const { getByText } = render(
      <StatsBar loadPercent={10} nextTask={nextTask} isCurrentDay={false} />,
    );

    expect(getByText('📅 Смотрите план на этот день')).toBeTruthy();
  });
});
