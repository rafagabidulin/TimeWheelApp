import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import DaySelector from '../DaySelector';
import { Day } from '../../types/types';
import { getDayLabel } from '../../i18n';

describe('DaySelector', () => {
  const days: Day[] = [
    { id: 'monday', name: getDayLabel('monday'), date: '2025-01-06', tasks: [] },
    { id: 'tuesday', name: getDayLabel('tuesday'), date: '2025-01-07', tasks: [] },
  ];

  it('renders days and handles selection', () => {
    const onSelectDate = jest.fn();
    const { getByText, getByTestId } = render(
      <DaySelector days={days} selectedDate="2025-01-06" onSelectDate={onSelectDate} />,
    );

    expect(getByText(getDayLabel('monday'))).toBeTruthy();
    expect(getByText(getDayLabel('tuesday'))).toBeTruthy();

    fireEvent.press(getByTestId('day-selector-tuesday'));
    expect(onSelectDate).toHaveBeenCalledWith('2025-01-07');
  });
});
