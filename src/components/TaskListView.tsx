// components/TaskListView.tsx
import React, { useMemo } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, FlatList } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Task } from '../types/types';
import { SPACING, FONT_SIZES, SIZES, useTheme } from '../constants/theme';
import { getDurationMinutes } from '../utils/timeUtils';
import { getCategoryLabel } from '../i18n';

interface TaskListViewProps {
  tasks: Task[];
  currentTask: Task | undefined;
  isCurrentDay: boolean;
  onEditTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
}

/**
 * Компонент списка задач дня
 * Отображает все задачи с выделением текущей
 *
 * ОПТИМИЗАЦИЯ:
 * - Использует мемоизированный renderItem для улучшения производительности
 * - Правильная обработка пустого списка
 * - Ключи для каждого элемента для избежания ошибок React Native
 */
export default function TaskListView({
  tasks,
  currentTask,
  isCurrentDay,
  onEditTask,
  onDeleteTask,
}: TaskListViewProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const hoursLabel = t('time.hoursShort');
    const minutesLabel = t('time.minutesShort');
    if (hours === 0) {
      return `${mins}${minutesLabel}`;
    }
    if (mins === 0) {
      return `${hours}${hoursLabel}`;
    }
    return `${hours}${hoursLabel} ${mins}${minutesLabel}`;
  };

  // Используем простой View с map() — это БЕЗОПАСНО и не вызывает ошибок VirtualizedLists
  // потому что TaskListView сам по себе не использует ScrollView

  if (tasks.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{t('tasks.empty')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {tasks.map((task) => {
        const isCurrentTaskItem = isCurrentDay && task.id === currentTask?.id;
        const duration = formatDuration(getDurationMinutes(task.startTime, task.endTime));

        return (
          <View key={task.id} style={styles.taskWrapper}>
            <TouchableOpacity
              style={[styles.taskItem, isCurrentTaskItem && styles.taskItemCurrent]}
              onPress={() => onEditTask(task.id)}
              activeOpacity={0.7}
              testID={`task-item-${task.id}`}>
              <View style={[styles.taskColorBar, { backgroundColor: task.color }]} />
              <View style={styles.taskInfo}>
                <Text
                  style={[styles.taskTitle, isCurrentTaskItem && styles.taskTitleCurrent]}
                  numberOfLines={1}>
                  {isCurrentTaskItem ? '▶ ' : ''}
                  {task.title}
                </Text>
                <Text style={styles.taskTime}>
                  {task.startTime} – {task.endTime} • {getCategoryLabel(task.category)}
                </Text>
              </View>
              <Text style={styles.taskDuration}>{duration}</Text>
              <TouchableOpacity
                style={styles.taskDeleteButton}
                onPress={() => onDeleteTask(task.id)}
                testID={`task-delete-${task.id}`}>
                <Text style={styles.taskDeleteIcon}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: SPACING.lg,
    backgroundColor: colors.cardBackground,
    borderRadius: SIZES.borderRadius,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    overflow: 'hidden',
  },
  emptyContainer: {
    width: '100%',
    paddingVertical: SPACING.xl,
    backgroundColor: colors.cardBackground,
    borderRadius: SIZES.borderRadius,
    marginBottom: SPACING.lg,
  },
  emptyText: {
    fontSize: FONT_SIZES.base,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  taskWrapper: {
    // Обёртка для каждого элемента
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  taskItemCurrent: {
    backgroundColor: colors.currentDayHighlight,
    borderLeftWidth: 3,
    borderLeftColor: colors.currentDayBorder,
  },
  taskColorBar: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: SPACING.lg,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: FONT_SIZES.base,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  taskTitleCurrent: {
    color: colors.primary,
    fontWeight: '700',
  },
  taskTime: {
    fontSize: FONT_SIZES.xs,
    color: colors.textTertiary,
    marginTop: SPACING.sm,
  },
  taskDuration: {
    fontSize: FONT_SIZES.xs,
    color: colors.textTertiary,
    marginLeft: SPACING.md,
    textAlign: 'right',
    minWidth: 56,
  },
  taskDeleteButton: {
    padding: SPACING.md,
  },
  taskDeleteIcon: {
    fontSize: FONT_SIZES.lg,
    color: colors.danger,
    fontWeight: 'bold',
  },
});
