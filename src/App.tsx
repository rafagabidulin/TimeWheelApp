import 'react-native-get-random-values';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  FlatList,
  PanResponder,
  Keyboard,
  TouchableWithoutFeedback,
  Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTaskManager } from './hooks/useTaskManager';
import { SPACING, FONT_SIZES, ThemeProvider, useTheme, CLOCK_RADIUS, CENTER_Y } from './constants/theme';
import { FormData } from './types/types';
import { ParsedTask } from './utils/scheduleParser';
import { addDays, formatDateISO, parseDateISO } from './utils/timeUtils';

import DaySelector from './components/DaySelector';
import NavigationBar from './components/NavigationBar';
import ClockView from './components/ClockView';
import TaskListView from './components/TaskListView';
import SwipeableTaskModal from './components/TaskModal/SwipeableTaskModal';
import ScheduleParserModal from './components/ScheduleParserModal';
import StorageErrorBanner from './components/StorageErrorBanner';
import StatsBar from './components/StatsBar';
import PullToRefresh from './components/PullToRefresh';
import ErrorBoundary from './components/ErrorBoundary';
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
function AppContent() {
  const { colors, scheme, toggleTheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const iconSize = 28;
  // ============================================================================
  // УПРАВЛЕНИЕ СОСТОЯНИЕМ ЗАДАЧ (весь бизнес-логика в хуке)
  // ============================================================================

  const {
    currentTime,
    selectedDate,
    selectedDateObj,
    days,
    weekDays,
    appState,
    setSelectedDate,
    addTask,
    updateTask,
    deleteTask,
    currentDay,
    isCurrentDay,
    tasks,
    currentTask,
    nextTask,
    loadPercent,
    totalHours,
    storageError,
    clearStorageError,
    applyWeeklyTemplate,
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
  const handleSaveEditedTask = useCallback(async (options?: { allowOverlap?: boolean }) => {
    if (!editingTaskId) return;
    await updateTask(editingTaskId, formData, options);
    closeModal();
  }, [editingTaskId, formData, updateTask, closeModal]);

  /**
   * Добавление новой задачи
   */
  const handleAddTask = useCallback(async (options?: { allowOverlap?: boolean }) => {
    await addTask(formData, options);
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
  const confirmAddConflict = useCallback((taskTitle: string) => {
    return new Promise<boolean>((resolve) => {
      Alert.alert(
        'Конфликт задач',
        `Задача "${taskTitle}" пересекается с уже существующей. Добавить всё равно?`,
        [
          { text: 'Пропустить', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Добавить', onPress: () => resolve(true) },
        ],
      );
    });
  }, []);

  const handleAddParsedTasks = useCallback(
    async (parsedTasks: ParsedTask[]) => {
      let added = 0;
      let skipped = 0;

      for (const task of parsedTasks) {
        try {
          await addTask({
            title: task.title,
            startTime: task.startTime,
            endTime: task.endTime,
            category: task.category,
            color: task.color,
          });
          added += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : '';
          if (message.includes('пересекается')) {
            const shouldAdd = await confirmAddConflict(task.title);
            if (shouldAdd) {
              await addTask(
                {
                  title: task.title,
                  startTime: task.startTime,
                  endTime: task.endTime,
                  category: task.category,
                  color: task.color,
                },
                { allowOverlap: true },
              );
              added += 1;
            } else {
              skipped += 1;
            }
            continue;
          }
          throw error;
        }
      }

      return { added, skipped };
    },
    [addTask, confirmAddConflict],
  );

  const handleApplyWeeklyTemplate = useCallback(async () => {
    try {
      const appliedCount = await applyWeeklyTemplate();
      if (appliedCount === 0) {
        Alert.alert('Шаблон', 'Все дни недели уже заполнены.');
        return;
      }
      Alert.alert('Шаблон', `Добавлены шаблоны для ${appliedCount} дней.`);
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось применить шаблон недели.');
    }
  }, [applyWeeklyTemplate]);

  // ============================================================================
  // НАВИГАЦИЯ МЕЖДУ ДНЯМИ
  // ============================================================================

  const handlePrevDay = useCallback(() => {
    const baseDate = parseDateISO(selectedDate) || new Date();
    const prevDate = addDays(baseDate, -1);
    setSelectedDate(formatDateISO(prevDate));
  }, [selectedDate, setSelectedDate]);

  const handleNextDay = useCallback(() => {
    const baseDate = parseDateISO(selectedDate) || new Date();
    const nextDate = addDays(baseDate, 1);
    setSelectedDate(formatDateISO(nextDate));
  }, [selectedDate, setSelectedDate]);

  const handleGoToToday = useCallback(() => {
    setSelectedDate(formatDateISO(new Date()));
  }, [setSelectedDate]);

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

  const canGoPrev = useMemo(() => true, []);
  const canGoNext = useMemo(() => true, []);

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
            <DaySelector
              days={weekDays}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />

            <View style={styles.themeToggleRow}>
              <TouchableOpacity style={styles.themeToggleButton} onPress={toggleTheme}>
                <Text style={styles.themeToggleText}>
                  {scheme === 'dark' ? '☀️ Светлая тема' : '🌙 Тёмная тема'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* ЦИФЕРБЛАТ */}
            <ClockView
              currentTime={currentTime}
              selectedDate={selectedDateObj}
              currentDay={currentDay}
              isCurrentDay={isCurrentDay}
              tasks={tasks}
              onTaskPress={handleEditTask}
            />

            <View style={styles.todayButtonRow}>
              <TouchableOpacity
                style={[
                  styles.todayButton,
                  isCurrentDay ? styles.todayButtonCurrent : styles.todayButtonDefault,
                ]}
                onPress={handleGoToToday}>
                <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M21 12a9 9 0 1 1-3.02-6.73"
                    stroke={isCurrentDay ? colors.cardBackground : colors.primary}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                  <Path
                    d="M21 3v6h-6"
                    stroke={isCurrentDay ? colors.cardBackground : colors.primary}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </TouchableOpacity>
            </View>

            <View style={styles.bottomSection}>
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

              <TouchableOpacity
                style={styles.templateButton}
                onPress={handleApplyWeeklyTemplate}
                activeOpacity={0.7}>
                <Text style={styles.templateButtonText}>📅 Применить шаблон недели</Text>
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
          </View>
        ),
      },
    ],
    [
      storageError,
      clearStorageError,
      days,
      selectedDate,
      selectedDateObj,
      weekDays,
      setSelectedDate,
      currentTime,
      currentDay,
      isCurrentDay,
      tasks,
      handleEditTask,
      currentTask,
      deleteTask,
      loadPercent,
      nextTask,
      handleApplyWeeklyTemplate,
      handleGoToToday,
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
    <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top }]} edges={[]}>
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

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

// ============================================================================
// СТИЛИ
// ============================================================================

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  parserButton: {
    backgroundColor: colors.primary,
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
    color: colors.cardBackground,
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    textAlign: 'center',
  },
  templateButton: {
    backgroundColor: colors.info,
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
  templateButtonText: {
    color: colors.cardBackground,
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: colors.success,
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
    color: colors.cardBackground,
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    textAlign: 'center',
  },
  todayButtonRow: {
    position: 'absolute',
    right: SPACING.lg,
    top: CENTER_Y + CLOCK_RADIUS + 78,
    zIndex: 10,
  },
  todayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayButtonCurrent: {
    backgroundColor: colors.primary,
  },
  todayButtonDefault: {
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bottomSection: {
    marginTop: -SPACING.xxl - 40,
  },
  themeToggleRow: {
    width: '90%',
    alignSelf: 'center',
    marginBottom: SPACING.sm,
  },
  themeToggleButton: {
    alignSelf: 'flex-end',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 999,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  themeToggleText: {
    fontSize: FONT_SIZES.sm,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
