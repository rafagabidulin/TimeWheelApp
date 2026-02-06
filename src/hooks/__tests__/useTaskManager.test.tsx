import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { useTaskManager } from '../useTaskManager';
import { mockDays } from '../../utils/mockData';
import { formatDateISO } from '../../utils/timeUtils';
import { Day } from '../../types/types';
import { getDayLabel } from '../../i18n';

jest.mock('../../utils/calendarSync', () => ({
  initializeCalendarSync: jest.fn().mockResolvedValue({
    hasPermission: false,
    calendarId: null,
  }),
}));

const mockLoadDaysFromStorage = jest.fn();
const mockSaveDaysToStorage = jest.fn().mockResolvedValue(undefined);

jest.mock('../../utils/storageUtils', () => ({
  StorageError: class StorageError extends Error {},
  loadDaysFromStorage: () => mockLoadDaysFromStorage(),
  saveDaysToStorage: (...args: unknown[]) => mockSaveDaysToStorage(...args),
}));

jest.mock('../../utils/bidirectionalSync', () => ({
  checkForNewCalendarEvents: jest.fn().mockResolvedValue(false),
  importCalendarEventsToDay: jest.fn().mockResolvedValue([]),
  removeTaskIfDeletedFromCalendar: jest.fn().mockResolvedValue([]),
}));

function HookHarness() {
  const { days, currentDay, addTask } = useTaskManager();

  return (
    <>
      <Text testID="days-count">{String(days.length)}</Text>
      <Text testID="tasks-count">{String(currentDay.tasks.length)}</Text>
      <TouchableOpacity
        testID="add-task"
        onPress={() =>
          addTask({
            title: 'Тест',
            startTime: '09:00',
            endTime: '10:00',
            category: 'custom',
            color: '#000',
          })
        }
      />
    </>
  );
}

describe('useTaskManager', () => {
  const fixedNow = new Date(2025, 0, 5, 10, 0, 0);

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    mockLoadDaysFromStorage.mockReset();
    mockSaveDaysToStorage.mockClear();
  });

  it('loads mock days when storage is empty', async () => {
    mockLoadDaysFromStorage.mockResolvedValue([]);

    const { getByTestId } = render(<HookHarness />);

    await waitFor(() => {
      expect(getByTestId('days-count').props.children).toBe(String(mockDays.length));
    });
    await waitFor(() => {
      expect(mockSaveDaysToStorage).toHaveBeenCalled();
    });
  });

  it('loads stored days and normalizes data', async () => {
    const dateIso = formatDateISO(fixedNow);
    const storedDays: Day[] = [
      {
        id: dateIso,
        name: getDayLabel('sunday'),
        date: dateIso,
        tasks: [
          {
            id: 'task-1',
            date: dateIso,
            title: 'Задача',
            startTime: '10:00',
            endTime: '11:00',
            category: 'custom',
            color: '#000',
          },
        ],
      },
    ];
    mockLoadDaysFromStorage.mockResolvedValue(storedDays);

    const { getByTestId } = render(<HookHarness />);

    await waitFor(() => {
      expect(getByTestId('days-count').props.children).toBe('1');
    });
    await waitFor(() => {
      expect(getByTestId('tasks-count').props.children).toBe('1');
    });
  });

  it('adds a task and persists', async () => {
    const dateIso = formatDateISO(fixedNow);
    mockLoadDaysFromStorage.mockResolvedValue([
      { id: dateIso, name: getDayLabel('sunday'), date: dateIso, tasks: [] },
    ]);

    const { getByTestId } = render(<HookHarness />);

    await waitFor(() => {
      expect(getByTestId('tasks-count').props.children).toBe('0');
    });

    fireEvent.press(getByTestId('add-task'));

    await waitFor(() => {
      expect(getByTestId('tasks-count').props.children).toBe('1');
    });
    await waitFor(() => {
      expect(mockSaveDaysToStorage).toHaveBeenCalled();
    });
  });
});
