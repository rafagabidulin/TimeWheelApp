import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import SwipeableTaskModal from '../TaskModal/SwipeableTaskModal';
import { Day, FormData } from '../../types/types';

jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  return function MockDateTimePicker() {
    return React.createElement('DateTimePicker');
  };
});

describe('SwipeableTaskModal', () => {
  const currentDay: Day = {
    id: 'monday',
    name: 'Пн',
    date: '2025-01-05',
    tasks: [],
  };

  const baseFormData: FormData = {
    title: '',
    startTime: '09:00',
    endTime: '10:00',
    color: '#4CAF50',
    category: 'work',
  };

  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows validation error for empty title', () => {
    const onAdd = jest.fn().mockResolvedValue(undefined);
    const { getByTestId } = render(
      <SwipeableTaskModal
        visible={true}
        onClose={jest.fn()}
        onAdd={onAdd}
        onUpdate={jest.fn()}
        editingTaskId={null}
        currentDay={currentDay}
        formData={baseFormData}
        setFormData={jest.fn()}
      />,
    );

    fireEvent.press(getByTestId('task-save'));
    expect(Alert.alert).toHaveBeenCalled();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('calls onAdd with valid title', () => {
    const onAdd = jest.fn().mockResolvedValue(undefined);
    const setFormData = jest.fn();
    const filledFormData: FormData = {
      ...baseFormData,
      title: 'Новая задача',
    };
    const { getByTestId } = render(
      <SwipeableTaskModal
        visible={true}
        onClose={jest.fn()}
        onAdd={onAdd}
        onUpdate={jest.fn()}
        editingTaskId={null}
        currentDay={currentDay}
        formData={filledFormData}
        setFormData={setFormData}
      />,
    );

    fireEvent.press(getByTestId('task-save'));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('updates form data when title changes', () => {
    const setFormData = jest.fn();
    const { getByTestId } = render(
      <SwipeableTaskModal
        visible={true}
        onClose={jest.fn()}
        onAdd={jest.fn()}
        onUpdate={jest.fn()}
        editingTaskId={null}
        currentDay={currentDay}
        formData={baseFormData}
        setFormData={setFormData}
      />,
    );

    fireEvent.changeText(getByTestId('task-title-input'), 'Новая задача');
    expect(setFormData).toHaveBeenCalled();
  });
});
