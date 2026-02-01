import 'react-native-get-random-values';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  TouchableOpacity,
  Text,
  FlatList,
  PanResponder,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';

import { useTaskManager } from './hooks/useTaskManager';
import { COLORS, SPACING, FONT_SIZES } from './constants/theme';
import { FormData } from './types/types';
import { ParsedTask } from './utils/scheduleParser';

import DaySelector from './components/DaySelector';
import NavigationBar from './components/NavigationBar';
import ClockView from './components/ClockView';
import TaskListView from './components/TaskListView';
import SwipeableTaskModal from './components/TaskModal/SwipeableTaskModal';
import ScheduleParserModal from './components/ScheduleParserModal';
import StorageErrorBanner from './components/StorageErrorBanner';
import StatsBar from './components/StatsBar';
import PullToRefresh from './components/PullToRefresh';
import { initializeCalendarSync, getOrCreateTimeWheelCalendar } from './utils/calendarSync';
import { syncCalendarToDays } from './utils/bidirectionalSync';

/**
 * Главный компонент приложения TimeWheel
 *
 * Отвечает за:
 * - Координацию между компонентами
 * - Управление состоянием модального окна
 * - Обработку действий пользователя
 * - Парсинг расписания из текста
 */
export default function App() {
  // ============================================================================
  // УПРАВЛЕНИЕ СОСТОЯНИЕМ ЗАДАЧ (весь бизнес-логика в хуке)
  // ============================================================================

  const {
    currentTime,
    selectedDayId,
    days,
    appState,
    setSelectedDayId,
    addTask,
    updateTask,
    deleteTask,
    currentDay,
    isCurrentDay,
    tasks,
    currentTask,
    nextTask,
    loadPercent,
    selectedDate,
    totalHours,
    storageError,
    clearStorageError,
  } = useTaskManager();

  // ============================================================================
  // УПРАВЛЕНИЕ МОДАЛЬНЫМ ОКНОМ ДЛЯ ДОБАВЛЕНИЯ/РЕДАКТИРОВАНИЯ ЗАДАЧ
  // ============================================================================

  const [modalVisible, setModalVisible] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    title: '',
    startTime: '09:00',
    endTime: '10:00',
    color: '#4CAF50',
    category: 'custom',
  });

  /**
   * Закрытие модального окна с очисткой состояния
   */
  const closeModal = useCallback(() => {
    setModalVisible(false);
    setEditingTaskId(null);
    setFormData({
      title: '',
      startTime: '09:00',
      endTime: '10:00',
      color: '#4CAF50',
      category: 'custom',
    });
  }, []);

  /**
   * Открытие модального окна для редактирования задачи
   */
  const handleEditTask = useCallback(
    (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      setFormData({
        title: task.title,
        startTime: task.startTime,
        endTime: task.endTime,
        color: task.color,
        category: task.category,
      });
      setEditingTaskId(taskId);
      setModalVisible(true);
    },
    [tasks],
  );

  /**
   * Сохранение отредактированной задачи
   */
  const handleSaveEditedTask = useCallback(async () => {
    if (!editingTaskId) return;
    await updateTask(editingTaskId, formData);
    closeModal();
  }, [editingTaskId, formData, updateTask, closeModal]);

  /**
   * Добавление новой задачи
   */
  const handleAddTask = useCallback(async () => {
    await addTask(formData);
    closeModal();
  }, [formData, addTask, closeModal]);

  /**
   * Открытие модального окна для добавления новой задачи
   */
  const handleOpenAddModal = useCallback(() => {
    setEditingTaskId(null);
    setFormData({
      title: '',
      startTime: '09:00',
      endTime: '10:00',
      color: '#4CAF50',
      category: 'custom',
    });
    setModalVisible(true);
  }, []);

  // ============================================================================
  // УПРАВЛЕНИЕ МОДАЛЬНЫМ ОКНОМ ПАРСЕРА РАСПИСАНИЯ
  // ============================================================================

  const [parserModalVisible, setParserModalVisible] = useState(false);

  /**
   * Добавление распарсенных задач
   */
  const handleAddParsedTasks = useCallback(
    async (parsedTasks: ParsedTask[]) => {
      for (const task of parsedTasks) {
        await addTask({
          title: task.title,
          startTime: task.startTime,
          endTime: task.endTime,
          category: task.category,
          color: task.color,
        });
      }
    },
    [addTask],
  );

  // ============================================================================
  // НАВИГАЦИЯ МЕЖДУ ДНЯМИ
  // ============================================================================

  const handlePrevDay = useCallback(() => {
    const currentIndex = days.findIndex((d) => d.id === selectedDayId);
    if (currentIndex > 0) {
      setSelectedDayId(days[currentIndex - 1].id);
    }
  }, [days, selectedDayId, setSelectedDayId]);

  const handleNextDay = useCallback(() => {
    const currentIndex = days.findIndex((d) => d.id === selectedDayId);
    if (currentIndex < days.length - 1) {
      setSelectedDayId(days[currentIndex + 1].id);
    }
  }, [days, selectedDayId, setSelectedDayId]);

  const prevDayRef = useRef(handlePrevDay);
  const nextDayRef = useRef(handleNextDay);

  useEffect(() => {
    prevDayRef.current = handlePrevDay;
    nextDayRef.current = handleNextDay;
  }, [handlePrevDay, handleNextDay]);

  const swipeResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => {
        const { dx, dy } = gesture;
        return Math.abs(dx) > 20 && Math.abs(dx) > Math.abs(dy) * 1.5;
      },
      onPanResponderRelease: (_, gesture) => {
        const { dx, vx } = gesture;
        const shouldTrigger = Math.abs(dx) > 60 || Math.abs(vx) > 0.5;
        if (!shouldTrigger) return;

        if (dx > 0) {
          prevDayRef.current();
        } else {
          nextDayRef.current();
        }
      },
    }),
  ).current;

  const canGoPrev = useMemo(() => {
    const currentIndex = days.findIndex((d) => d.id === selectedDayId);
    return currentIndex > 0;
  }, [days, selectedDayId]);

  const canGoNext = useMemo(() => {
    const currentIndex = days.findIndex((d) => d.id === selectedDayId);
    return currentIndex < days.length - 1;
  }, [days, selectedDayId]);

  // ============================================================================
  // FlatList DATA — ОДИН ЭЛЕМЕНТ ДЛЯ СОДЕРЖИМОГО
  // ============================================================================

  const screenData = useMemo(
    () => [
      {
        id: 'screen',
        component: (
          <View {...swipeResponder.panHandlers}>
            {/* ОШИБКИ ХРАНИЛИЩА */}
            {storageError && (
              <StorageErrorBanner message={storageError} onDismiss={clearStorageError} />
            )}

            {/* ВЫБОР ДНЯ НЕДЕЛИ */}
            <DaySelector days={days} selectedDayId={selectedDayId} onSelectDay={setSelectedDayId} />

            {/* ЦИФЕРБЛАТ */}
            <ClockView
              currentTime={currentTime}
              selectedDate={selectedDate}
              currentDay={currentDay}
              isCurrentDay={isCurrentDay}
              tasks={tasks}
              onTaskPress={handleEditTask}
            />

            {/* ПОЛОСКА НАВИГАЦИИ */}
            <NavigationBar
              currentDay={currentDay}
              canGoPrev={canGoPrev}
              canGoNext={canGoNext}
              onPrevDay={handlePrevDay}
              onNextDay={handleNextDay}
            />

            {/* СПИСОК ЗАДАЧ */}
            <TaskListView
              tasks={tasks}
              currentTask={currentTask}
              isCurrentDay={isCurrentDay}
              onEditTask={handleEditTask}
              onDeleteTask={deleteTask}
            />

            {/* КНОПКА ПАРСЕРА РАСПИСАНИЯ */}
            <TouchableOpacity
              style={styles.parserButton}
              onPress={() => setParserModalVisible(true)}
              activeOpacity={0.7}>
              <Text style={styles.parserButtonText}>📋 Добавить расписание</Text>
            </TouchableOpacity>

            {/* КНОПКА ДОБАВЛЕНИЯ ЗАДАЧИ */}
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleOpenAddModal}
              activeOpacity={0.7}>
              <Text style={styles.addButtonText}>+ Добавить задачу</Text>
            </TouchableOpacity>

            {/* СТАТИСТИКА */}
            <StatsBar loadPercent={loadPercent} nextTask={nextTask} isCurrentDay={isCurrentDay} />
          </View>
        ),
      },
    ],
    [
      storageError,
      clearStorageError,
      days,
      selectedDayId,
      setSelectedDayId,
      currentTime,
      selectedDate,
      currentDay,
      isCurrentDay,
      tasks,
      totalHours,
      handleEditTask,
      currentTask,
      deleteTask,
      loadPercent,
      nextTask,
      canGoPrev,
      canGoNext,
      handlePrevDay,
      handleNextDay,
    ],
  );

  // ============================================================================
  // РЕНДЕР
  // ============================================================================

  return (
    <SafeAreaView style={styles.safeArea}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        {/* FlatList ВМЕСТО ScrollView — ДЛЯ СОВМЕСТИМОСТИ С ВЛОЖЕННЫМИ FlatList */}
        <FlatList
          data={screenData}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => item.component}
          scrollEnabled={true}
          showsVerticalScrollIndicator={false}
          style={styles.container}
          keyboardShouldPersistTaps="handled"
        />
      </TouchableWithoutFeedback>

      {/* МОДАЛЬНОЕ ОКНО ДЛЯ ДОБАВЛЕНИЯ/РЕДАКТИРОВАНИЯ ЗАДАЧИ */}
      <SwipeableTaskModal
        visible={modalVisible}
        onClose={closeModal}
        onAdd={handleAddTask}
        onUpdate={handleSaveEditedTask}
        editingTaskId={editingTaskId}
        currentDay={currentDay}
        formData={formData}
        setFormData={setFormData}
      />

      {/* МОДАЛЬНОЕ ОКНО ПАРСЕРА РАСПИСАНИЯ */}
      <ScheduleParserModal
        visible={parserModalVisible}
        onClose={() => setParserModalVisible(false)}
        onAddTasks={handleAddParsedTasks}
      />
    </SafeAreaView>
  );
}

// ============================================================================
// СТИЛИ
// ============================================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  parserButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    marginVertical: SPACING.md,
    marginHorizontal: SPACING.md,
    width: '90%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignSelf: 'center',
  },
  parserButtonText: {
    color: COLORS.cardBackground,
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: COLORS.success,
    borderRadius: 12,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    marginVertical: SPACING.lg,
    marginHorizontal: SPACING.md,
    width: '90%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignSelf: 'center',
  },
  addButtonText: {
    color: COLORS.buttonText,
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    textAlign: 'center',
  },
});
