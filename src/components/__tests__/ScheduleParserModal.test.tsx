import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import ScheduleParserModal from '../ScheduleParserModal';

describe('ScheduleParserModal', () => {
  const onAddTasks = jest.fn().mockResolvedValue({ added: 1, skipped: 0 });
  const onClose = jest.fn();

  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows validation error when input is empty', () => {
    const { getByTestId } = render(
      <ScheduleParserModal visible={true} onClose={onClose} onAddTasks={onAddTasks} />,
    );

    fireEvent.press(getByTestId('schedule-parse'));
    expect(Alert.alert).toHaveBeenCalled();
  });

  it('parses input and adds tasks', async () => {
    const { getByTestId } = render(
      <ScheduleParserModal visible={true} onClose={onClose} onAddTasks={onAddTasks} />,
    );

    fireEvent.changeText(
      getByTestId('schedule-input'),
      'Работа 9:00-10:00, обед 12:00-13:00',
    );
    fireEvent.press(getByTestId('schedule-parse'));

    await waitFor(() => {
      expect(getByTestId('schedule-add')).toBeTruthy();
    });

    fireEvent.press(getByTestId('schedule-add'));

    await waitFor(() => {
      expect(onAddTasks).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
