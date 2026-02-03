import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import NavigationBar from '../NavigationBar';
import { Day } from '../../types/types';

describe('NavigationBar', () => {
  const currentDay: Day = {
    id: 'sunday',
    name: 'Вс',
    date: '2025-01-05',
    tasks: [],
  };

  it('renders date label and triggers navigation', () => {
    const onPrevDay = jest.fn();
    const onNextDay = jest.fn();

    const { getByText, getByTestId } = render(
      <NavigationBar
        currentDay={currentDay}
        canGoPrev={true}
        canGoNext={true}
        onPrevDay={onPrevDay}
        onNextDay={onNextDay}
      />,
    );

    expect(getByText('Вс')).toBeTruthy();
    expect(getByText('5 Янв')).toBeTruthy();

    fireEvent.press(getByTestId('nav-prev'));
    fireEvent.press(getByTestId('nav-next'));
    expect(onPrevDay).toHaveBeenCalledTimes(1);
    expect(onNextDay).toHaveBeenCalledTimes(1);
  });

  it('disables buttons when navigation is not allowed', () => {
    const onPrevDay = jest.fn();
    const onNextDay = jest.fn();
    const { getByTestId } = render(
      <NavigationBar
        currentDay={currentDay}
        canGoPrev={false}
        canGoNext={false}
        onPrevDay={onPrevDay}
        onNextDay={onNextDay}
      />,
    );

    fireEvent.press(getByTestId('nav-prev'));
    fireEvent.press(getByTestId('nav-next'));
    expect(onPrevDay).not.toHaveBeenCalled();
    expect(onNextDay).not.toHaveBeenCalled();
  });
});
