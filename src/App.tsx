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
import { useTranslation } from 'react-i18next';

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
  const { colors, setMode } = useTheme();
  const { t } = useTranslation();
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
  const [menuVisible, setMenuVisible] = useState(false);

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
  }, [t]);

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

  const handleDeleteTask = useCallback(
    (taskId: string) => {
      Alert.alert('Удалить задачу?', 'Это действие нельзя отменить.', [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => {
            void deleteTask(taskId);
          },
        },
      ]);
    },
    [deleteTask],
  );

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
        t('alerts.taskConflictTitle'),
        t('alerts.taskConflictMessage', { title: taskTitle }),
        [
          { text: t('common.skip'), style: 'cancel', onPress: () => resolve(false) },
          { text: t('common.add'), onPress: () => resolve(true) },
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
          if (message.includes(t('errors.taskOverlap'))) {
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
        Alert.alert(t('alerts.templateTitle'), t('alerts.templateAllFilled'));
        return;
      }
      Alert.alert(t('alerts.templateTitle'), t('alerts.templateApplied', { count: appliedCount }));
    } catch (error) {
      Alert.alert(t('common.error'), t('alerts.templateError'));
    }
  }, [applyWeeklyTemplate, t]);

  const toggleMenu = useCallback(() => {
    setMenuVisible((prev) => !prev);
  }, []);

  const handleMenuItemPress = useCallback((label: string, action?: () => void) => {
    setMenuVisible(false);
    if (action) {
      action();
      return;
    }
    Alert.alert(label);
  }, []);

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

  const headerHeight = 32;

  // ============================================================================
  // FlatList DATA — ОДИН ЭЛЕМЕНТ ДЛЯ СОДЕРЖИМОГО
  // ============================================================================

  const screenData = useMemo(
    () => [
      {
        id: 'screen',
        component: (
          <View {...swipeResponder.panHandlers}>
            {/* ШАПКА */}
            <View style={[styles.header, { height: headerHeight + insets.top, paddingTop: insets.top }]}>
              <View style={styles.headerContent}>
                <View style={styles.headerSpacer} />
                <Text style={styles.headerTitle}>TimeWheel</Text>
                <TouchableOpacity style={styles.headerButton} onPress={toggleMenu} activeOpacity={0.7}>
                  <View style={styles.burgerIcon}>
                    <View style={styles.burgerLine} />
                    <View style={styles.burgerLine} />
                    <View style={styles.burgerLine} />
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {menuVisible && (
              <>
                <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
                  <View style={styles.menuOverlay} />
                </TouchableWithoutFeedback>
                <View
                  style={[
                    styles.menuContainer,
                    { top: headerHeight + insets.top, left: 0, right: 0 },
                  ]}>
                  {[
                    { label: 'Светлая тема', action: () => setMode('light') },
                    { label: 'Темная тема', action: () => setMode('dark') },
                    { label: 'Напоминания' },
                    { label: 'О приложении' },
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.label}
                      style={styles.menuItem}
                      onPress={() => handleMenuItemPress(item.label, item.action)}
                      activeOpacity={0.7}>
                      <Text style={styles.menuItemText}>{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

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
                onDeleteTask={handleDeleteTask}
              />

              {/* КНОПКА ПАРСЕРА РАСПИСАНИЯ */}
              <TouchableOpacity
                style={styles.parserButton}
                onPress={() => setParserModalVisible(true)}
                activeOpacity={0.7}>
                <Text style={styles.parserButtonText}>{t('ui.addSchedule')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.templateButton}
                onPress={handleApplyWeeklyTemplate}
                activeOpacity={0.7}>
                <Text style={styles.templateButtonText}>{t('ui.applyWeeklyTemplate')}</Text>
              </TouchableOpacity>

              {/* КНОПКА ДОБАВЛЕНИЯ ЗАДАЧИ */}
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleOpenAddModal}
                activeOpacity={0.7}>
                <Text style={styles.addButtonText}>{t('ui.addTask')}</Text>
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
      setMode,
      t,
    ],
  );

  // ============================================================================
  // РЕНДЕР
  // ============================================================================

  return (
    <SafeAreaView style={styles.safeArea} edges={[]}>
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
    top: CENTER_Y + CLOCK_RADIUS + Math.round(CLOCK_RADIUS * 0.8),
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
  header: {
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.primary,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    width: '100%',
    marginTop: -4,
  },
  headerSpacer: {
    width: 84,
  },
  headerTitle: {
    flex: 1,
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: colors.cardBackground,
    textAlign: 'center',
  },
  headerButton: {
    width: 84,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  burgerIcon: {
    width: 22,
    height: 16,
    justifyContent: 'space-between',
  },
  burgerLine: {
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.cardBackground,
  },
  menuContainer: {
    position: 'absolute',
    width: '100%',
    backgroundColor: colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingVertical: SPACING.xs,
    zIndex: 20,
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  menuItem: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  menuItemText: {
    fontSize: FONT_SIZES.sm,
    color: colors.cardBackground,
    fontWeight: '600',
  },
  bottomSection: {
    marginTop: -SPACING.sm + 20,
  },
});
