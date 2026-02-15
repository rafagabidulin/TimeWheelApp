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
import { v4 as uuidv4 } from 'uuid';

import { useTaskManager } from './hooks/useTaskManager';
import {
  SPACING,
  FONT_SIZES,
  ThemeProvider,
  useTheme,
  CLOCK_RADIUS,
  CENTER_Y,
  DAYS_OF_WEEK,
} from './constants/theme';
import { FormData, Template, TemplateApplyOptions, TemplateTaskInput, TemplateType } from './types/types';
import { ParsedTask } from './utils/scheduleParser';
import { addDays, formatDateISO, parseDateISO } from './utils/timeUtils';
import { loadTemplatesFromStorage, saveTemplatesToStorage } from './utils/storageUtils';

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
import TemplatesScreen from './components/TemplatesScreen';
import { initializeCalendarSync, getOrCreateTimeWheelCalendar } from './utils/calendarSync';
import { syncCalendarToDays } from './utils/bidirectionalSync';

/**
 * Главный компонент приложения Routiva
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
    previewTemplateApply,
    applyTemplateWithOptions,
  } = useTaskManager();

  // ============================================================================
  // УПРАВЛЕНИЕ МОДАЛЬНЫМ ОКНОМ ДЛЯ ДОБАВЛЕНИЯ/РЕДАКТИРОВАНИЯ ЗАДАЧ
  // ============================================================================

  const [modalVisible, setModalVisible] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [addMenuVisible, setAddMenuVisible] = useState(false);
  const [templatesVisible, setTemplatesVisible] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);

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
    setAddMenuVisible(false);
  }, []);

  const toggleAddMenu = useCallback(() => {
    setAddMenuVisible((prev) => !prev);
    setMenuVisible(false);
  }, []);

  const handleMenuItemPress = useCallback((label: string, action?: () => void) => {
    setMenuVisible(false);
    if (action) {
      action();
      return;
    }
    Alert.alert(label);
  }, []);

  const handleAddMenuItemPress = useCallback((action: () => void) => {
    setAddMenuVisible(false);
    action();
  }, []);

  const handleOpenTemplatesScreen = useCallback(() => {
    void loadTemplatesFromStorage()
      .then((loaded) => setTemplates(loaded))
      .catch(() => setTemplates([]));
    setTemplatesVisible(true);
  }, []);

  const handleCloseTemplatesScreen = useCallback(() => {
    setTemplatesVisible(false);
  }, []);

  const toTemplateTaskInput = useCallback((task: { title: string; startTime: string; endTime: string; category: string; color: string; }): TemplateTaskInput => {
    return {
      title: task.title,
      startTime: task.startTime,
      endTime: task.endTime,
      category: task.category,
      color: task.color,
    };
  }, []);

  const handleCreateTemplatePress = useCallback(
    (type: TemplateType) => {
      const nowIso = new Date().toISOString();
      let newTemplate: Template | null = null;

      if (type === 'day') {
        if (currentDay.tasks.length === 0) {
          Alert.alert('Нет задач', 'Нельзя создать шаблон дня из пустого дня.');
          return;
        }

        newTemplate = {
          id: `template-${uuidv4()}`,
          type: 'day',
          name: `День ${selectedDate}`,
          createdAt: nowIso,
          updatedAt: nowIso,
          tasks: currentDay.tasks.map(toTemplateTaskInput),
        };
      }

      if (type === 'week') {
        const weekTasksByDay = DAYS_OF_WEEK.reduce((acc, weekdayId, index) => {
          acc[weekdayId] = (weekDays[index]?.tasks || []).map(toTemplateTaskInput);
          return acc;
        }, {} as Record<typeof DAYS_OF_WEEK[number], TemplateTaskInput[]>);

        const totalWeekTasks = Object.values(weekTasksByDay).reduce((sum, tasksForDay) => sum + tasksForDay.length, 0);
        if (totalWeekTasks === 0) {
          Alert.alert('Нет задач', 'Нельзя создать шаблон недели из пустой недели.');
          return;
        }

        newTemplate = {
          id: `template-${uuidv4()}`,
          type: 'week',
          name: `Неделя от ${weekDays[0]?.date || selectedDate}`,
          createdAt: nowIso,
          updatedAt: nowIso,
          days: weekTasksByDay,
        };
      }

      if (type === 'month') {
        const year = selectedDateObj.getFullYear();
        const month = selectedDateObj.getMonth();
        const monthDaysWithTasks = days.filter((day) => {
          const parsed = parseDateISO(day.date);
          if (!parsed) return false;
          return parsed.getFullYear() === year && parsed.getMonth() === month && day.tasks.length > 0;
        });

        if (monthDaysWithTasks.length === 0) {
          Alert.alert('Нет задач', 'Нельзя создать шаблон месяца из пустого месяца.');
          return;
        }

        const monthTemplateMap: Record<string, TemplateTaskInput[]> = {};
        monthDaysWithTasks.forEach((day) => {
          monthTemplateMap[day.date] = day.tasks.map(toTemplateTaskInput);
        });

        newTemplate = {
          id: `template-${uuidv4()}`,
          type: 'month',
          name: `Месяц ${selectedDate.slice(0, 7)}`,
          createdAt: nowIso,
          updatedAt: nowIso,
          days: monthTemplateMap,
        };
      }

      if (!newTemplate) {
        return;
      }

      const nextTemplates = [newTemplate, ...templates];
      setTemplates(nextTemplates);
      void saveTemplatesToStorage(nextTemplates).catch(() => {
        Alert.alert('Ошибка', 'Не удалось сохранить шаблон.');
      });
      Alert.alert('Готово', `Шаблон "${newTemplate.name}" создан.`);
    },
    [currentDay.tasks, selectedDate, selectedDateObj, weekDays, days, toTemplateTaskInput, templates],
  );

  const handleRenameTemplatePress = useCallback(
    (nextTemplate: Template) => {
      const nextTemplates = templates.map((template) =>
        template.id === nextTemplate.id
          ? {
              ...nextTemplate,
              updatedAt: new Date().toISOString(),
            }
          : template,
      );
      setTemplates(nextTemplates);
      void saveTemplatesToStorage(nextTemplates).catch(() => {
        Alert.alert('Ошибка', 'Не удалось сохранить изменения шаблона.');
      });
    },
    [templates],
  );

  const handleDeleteTemplatePress = useCallback(
    (templateId: string) => {
      const nextTemplates = templates.filter((template) => template.id !== templateId);
      setTemplates(nextTemplates);
      void saveTemplatesToStorage(nextTemplates).catch(() => {
        Alert.alert('Ошибка', 'Не удалось удалить шаблон.');
      });
    },
    [templates],
  );

  const handlePreviewTemplatePress = useCallback(
    (template: Template, options: TemplateApplyOptions) => {
      return previewTemplateApply(template, options);
    },
    [previewTemplateApply],
  );

  const handleApplyTemplatePress = useCallback(
    async (template: Template, options: TemplateApplyOptions) => {
      return applyTemplateWithOptions(template, options);
    },
    [applyTemplateWithOptions],
  );

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const loaded = await loadTemplatesFromStorage();
        setTemplates(loaded);
      } catch (error) {
        setTemplates([]);
      }
    };

    void loadTemplates();
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

  const headerHeight = 52;

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
                <TouchableOpacity
                  style={[styles.headerIconButton, menuVisible && styles.headerIconButtonActive]}
                  onPress={toggleMenu}
                  activeOpacity={0.8}>
                  <View style={styles.burgerIcon}>
                    <View style={styles.burgerLine} />
                    <View style={styles.burgerLine} />
                    <View style={styles.burgerLine} />
                  </View>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Routiva</Text>
                <TouchableOpacity
                  style={[styles.headerIconButton, addMenuVisible && styles.headerIconButtonActive]}
                  onPress={toggleAddMenu}
                  activeOpacity={0.8}>
                  <Text style={styles.addMenuIcon}>+</Text>
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
                    styles.menuContainerLeft,
                    { top: headerHeight + insets.top },
                  ]}>
                  {[
                    { icon: '☀', label: 'Светлая тема', action: () => setMode('light') },
                    { icon: '🌙', label: 'Темная тема', action: () => setMode('dark') },
                    { icon: '🔔', label: 'Напоминания' },
                    { icon: 'ℹ', label: 'О приложении' },
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.label}
                      style={styles.menuItem}
                      onPress={() => handleMenuItemPress(item.label, item.action)}
                      activeOpacity={0.7}>
                      <View style={styles.menuItemRow}>
                        <Text style={styles.menuItemIcon}>{item.icon}</Text>
                        <Text style={styles.menuItemText}>{item.label}</Text>
                        <Text style={styles.menuItemChevron}>›</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {addMenuVisible && (
              <>
                <TouchableWithoutFeedback onPress={() => setAddMenuVisible(false)}>
                  <View style={styles.menuOverlay} />
                </TouchableWithoutFeedback>
                <View
                  style={[
                    styles.menuContainer,
                    styles.menuContainerRight,
                    { top: headerHeight + insets.top },
                  ]}>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => handleAddMenuItemPress(handleOpenAddModal)}
                    activeOpacity={0.7}>
                    <View style={styles.menuItemRow}>
                      <Text style={styles.menuItemIcon}>✍</Text>
                      <Text style={styles.menuItemText}>{t('ui.addTask').replace(/^\+\s*/, '')}</Text>
                      <Text style={styles.menuItemChevron}>›</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => handleAddMenuItemPress(() => setParserModalVisible(true))}
                    activeOpacity={0.7}>
                    <View style={styles.menuItemRow}>
                      <Text style={styles.menuItemIcon}>📋</Text>
                      <Text style={styles.menuItemText}>{t('ui.addSchedule').replace(/^📋\s*/, '')}</Text>
                      <Text style={styles.menuItemChevron}>›</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => handleAddMenuItemPress(handleApplyWeeklyTemplate)}
                    activeOpacity={0.7}>
                    <View style={styles.menuItemRow}>
                      <Text style={styles.menuItemIcon}>📅</Text>
                      <Text style={styles.menuItemText}>{t('ui.quickWeeklyTemplate')}</Text>
                      <Text style={styles.menuItemChevron}>›</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => handleAddMenuItemPress(handleOpenTemplatesScreen)}
                    activeOpacity={0.7}>
                    <View style={styles.menuItemRow}>
                      <Text style={styles.menuItemIcon}>🗂</Text>
                      <Text style={styles.menuItemText}>{`${t('ui.templates')} (${templates.length})`}</Text>
                      <Text style={styles.menuItemChevron}>›</Text>
                    </View>
                  </TouchableOpacity>
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
      handleOpenAddModal,
      handleOpenTemplatesScreen,
      handleAddMenuItemPress,
      handleGoToToday,
      canGoPrev,
      canGoNext,
      handlePrevDay,
      handleNextDay,
      setMode,
      t,
      templates.length,
      menuVisible,
      addMenuVisible,
      toggleMenu,
      toggleAddMenu,
      insets,
    ],
  );

  // ============================================================================
  // РЕНДЕР
  // ============================================================================

  if (templatesVisible) {
    return (
      <TemplatesScreen
        templates={templates}
        selectedDate={selectedDate}
        onBack={handleCloseTemplatesScreen}
        onCreateTemplate={handleCreateTemplatePress}
        onSaveTemplate={handleRenameTemplatePress}
        onDeleteTemplate={handleDeleteTemplatePress}
        onPreviewTemplate={handlePreviewTemplatePress}
        onApplyTemplate={handleApplyTemplatePress}
      />
    );
  }

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
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.24)',
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    width: '100%',
    paddingBottom: SPACING.xs,
  },
  headerTitle: {
    flex: 1,
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: colors.cardBackground,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  headerIconButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
  },
  addMenuIcon: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.cardBackground,
    lineHeight: 26,
  },
  burgerIcon: {
    width: 18,
    height: 13,
    justifyContent: 'space-between',
  },
  burgerLine: {
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.cardBackground,
  },
  menuContainer: {
    position: 'absolute',
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: SPACING.sm,
    zIndex: 20,
    minWidth: 292,
    maxWidth: '94%',
    marginTop: SPACING.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 8,
  },
  menuContainerLeft: {
    left: SPACING.sm,
    borderRadius: 14,
  },
  menuContainerRight: {
    right: SPACING.sm,
    borderRadius: 14,
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
  menuItem: {
    marginHorizontal: SPACING.sm,
    borderRadius: 10,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  menuItemIcon: {
    width: 20,
    fontSize: FONT_SIZES.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  menuItemText: {
    flex: 1,
    fontSize: FONT_SIZES.base,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  menuItemChevron: {
    fontSize: FONT_SIZES.base,
    color: colors.textTertiary,
    fontWeight: '700',
  },
  bottomSection: {
    marginTop: -SPACING.sm + 20,
  },
});
