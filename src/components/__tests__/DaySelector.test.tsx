import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import DaySelector from '../DaySelector';
import { Day } from '../../types/types';

describe('DaySelector', () => {
  const days: Day[] = [
    { id: 'monday', name: 'Пн', date: '2025-01-06', tasks: [] },
    { id: 'tuesday', name: 'Вт', date: '2025-01-07', tasks: [] },
  ];

  it('renders days and handles selection', () => {
    const onSelectDate = jest.fn();
    const { getByText, getByTestId } = render(
      <DaySelector days={days} selectedDate="2025-01-06" onSelectDate={onSelectDate} />,
    );

    expect(getByText('Пн')).toBeTruthy();
    expect(getByText('Вт')).toBeTruthy();

    fireEvent.press(getByTestId('day-selector-tuesday'));
    expect(onSelectDate).toHaveBeenCalledWith('2025-01-07');
  });
});
