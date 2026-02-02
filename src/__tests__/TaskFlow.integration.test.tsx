import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { useTaskManager } from '../hooks/useTaskManager';
import DaySelector from '../components/DaySelector';
import TaskListView from '../components/TaskListView';
import StatsBar from '../components/StatsBar';
import { mockDays } from '../utils/mockData';

const mockLoadDaysFromStorage = jest.fn();
const mockSaveDaysToStorage = jest.fn().mockResolvedValue(undefined);

jest.mock('../utils/storageUtils', () => ({
  StorageError: class StorageError extends Error {},
  loadDaysFromStorage: () => mockLoadDaysFromStorage(),
  saveDaysToStorage: (...args: unknown[]) => mockSaveDaysToStorage(...args),
}));

jest.mock('../utils/calendarSync', () => ({
  initializeCalendarSync: jest.fn().mockResolvedValue({
    hasPermission: false,
    calendarId: null,
  }),
}));

jest.mock('../utils/bidirectionalSync', () => ({
  checkForNewCalendarEvents: jest.fn().mockResolvedValue(false),
  importCalendarEventsToDay: jest.fn().mockResolvedValue([]),
  removeTaskIfDeletedFromCalendar: jest.fn().mockResolvedValue([]),
}));

function TaskFlowHarness() {
  const {
    days,
    weekDays,
    selectedDate,
    setSelectedDate,
    tasks,
    currentTask,
    isCurrentDay,
    nextTask,
    loadPercent,
    addTask,
  } = useTaskManager();

  return (
    <View>
      <DaySelector days={weekDays} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
      <TaskListView
        tasks={tasks}
        currentTask={currentTask}
        isCurrentDay={isCurrentDay}
        onEditTask={jest.fn()}
        onDeleteTask={jest.fn()}
      />
      <StatsBar loadPercent={loadPercent} nextTask={nextTask} isCurrentDay={isCurrentDay} />
      <Text testID="days-count">{String(days.length)}</Text>
      <TouchableOpacity
        testID="add-task"
        onPress={() =>
          addTask({
            title: 'Интеграция',
            startTime: '09:00',
            endTime: '10:00',
            category: 'custom',
            color: '#000',
          })
        }
      />
    </View>
  );
}

describe('Task flow integration', () => {
  beforeEach(() => {
    mockLoadDaysFromStorage.mockReset();
    mockSaveDaysToStorage.mockClear();
  });

  it('renders empty state then adds a task', async () => {
    mockLoadDaysFromStorage.mockResolvedValue(mockDays.map((day) => ({ ...day, tasks: [] })));

    const { getByText, getByTestId } = render(<TaskFlowHarness />);

    await waitFor(() => {
      expect(getByTestId('days-count').props.children).toBe(String(mockDays.length));
    });
    expect(getByText('Нет задач на этот день')).toBeTruthy();

    fireEvent.press(getByTestId('add-task'));

    await waitFor(() => {
      expect(getByText('Интеграция')).toBeTruthy();
    });
  });
});
