import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import TaskListView from '../TaskListView';
import { Task } from '../../types/types';

describe('TaskListView', () => {
  const task: Task = {
    id: 'task-1',
    date: '2025-01-05',
    title: 'Работа',
    startTime: '09:00',
    endTime: '10:30',
    category: 'work',
    color: '#4CAF50',
  };

  it('renders empty state when no tasks', () => {
    const { getByText } = render(
      <TaskListView
        tasks={[]}
        currentTask={undefined}
        isCurrentDay={true}
        onEditTask={jest.fn()}
        onDeleteTask={jest.fn()}
      />,
    );

    expect(getByText('Нет задач на этот день')).toBeTruthy();
  });

  it('renders task and handles edit/delete actions', () => {
    const onEditTask = jest.fn();
    const onDeleteTask = jest.fn();

    const { getByText, getByTestId } = render(
      <TaskListView
        tasks={[task]}
        currentTask={task}
        isCurrentDay={true}
        onEditTask={onEditTask}
        onDeleteTask={onDeleteTask}
      />,
    );

    expect(getByText('▶ Работа')).toBeTruthy();
    expect(getByText('09:00 – 10:30 • work')).toBeTruthy();
    expect(getByText('1ч 30м')).toBeTruthy();

    fireEvent.press(getByTestId('task-item-task-1'));
    expect(onEditTask).toHaveBeenCalledWith('task-1');

    fireEvent.press(getByTestId('task-delete-task-1'));
    expect(onDeleteTask).toHaveBeenCalledWith('task-1');
  });
});
