import React from 'react';
import { render } from '@testing-library/react-native';
import ClockView from '../ClockView';
import { Day, Task } from '../../types/types';

describe('ClockView', () => {
  const currentDay: Day = {
    id: 'monday',
    name: 'Пн',
    date: '2025-01-05',
    tasks: [],
  };

  const task: Task = {
    id: 'task-1',
    date: '2025-01-05',
    title: 'Работа',
    startTime: '09:00',
    endTime: '10:00',
    category: 'work',
    color: '#4CAF50',
  };

  it('renders time, date, and task title', () => {
    const currentTime = new Date(2025, 0, 5, 10, 5, 0);
    const selectedDate = new Date(2025, 0, 5);

    const { getByTestId, getByText } = render(
      <ClockView
        currentTime={currentTime}
        selectedDate={selectedDate}
        currentDay={currentDay}
        isCurrentDay={true}
        tasks={[task]}
        onTaskPress={jest.fn()}
      />,
    );

    const readSvgText = (node: { props: { children?: any } }) => {
      const child = node.props.children;
      if (typeof child === 'string') {
        return child;
      }
      if (Array.isArray(child)) {
        const textChild = child.find((item) => typeof item === 'string' || item?.props?.children);
        return typeof textChild === 'string' ? textChild : textChild?.props?.children;
      }
      return child?.props?.children;
    };

    expect(readSvgText(getByTestId('clock-time'))).toBe('10:05');
    expect(readSvgText(getByTestId('clock-date'))).toBe('Пн 05');
    expect(readSvgText(getByTestId('clock-task-task-1'))).toBe('Работа');
  });
});
