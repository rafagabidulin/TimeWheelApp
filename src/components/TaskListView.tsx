// components/TaskListView.tsx
import React from 'react';
import { StyleSheet, View, TouchableOpacity, Text, FlatList } from 'react-native';
import { Task } from '../types/types';
import { COLORS, SPACING, FONT_SIZES, SIZES } from '../constants/theme';
import { getDurationMinutes } from '../utils/timeUtils';

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
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) {
      return `${mins}м`;
    }
    if (mins === 0) {
      return `${hours}ч`;
    }
    return `${hours}ч ${mins}м`;
  };

  // Используем простой View с map() — это БЕЗОПАСНО и не вызывает ошибок VirtualizedLists
  // потому что TaskListView сам по себе не использует ScrollView

  if (tasks.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Нет задач на этот день</Text>
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
              activeOpacity={0.7}>
              <View style={[styles.taskColorBar, { backgroundColor: task.color }]} />
              <View style={styles.taskInfo}>
                <Text
                  style={[styles.taskTitle, isCurrentTaskItem && styles.taskTitleCurrent]}
                  numberOfLines={1}>
                  {isCurrentTaskItem ? '▶ ' : ''}
                  {task.title}
                </Text>
                <Text style={styles.taskTime}>
                  {task.startTime} – {task.endTime} • {task.category}
                </Text>
              </View>
              <Text style={styles.taskDuration}>{duration}</Text>
              <TouchableOpacity
                style={styles.taskDeleteButton}
                onPress={() => onDeleteTask(task.id)}>
                <Text style={styles.taskDeleteIcon}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.borderRadius,
    overflow: 'hidden',
  },
  emptyContainer: {
    width: '100%',
    paddingVertical: SPACING.xl,
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.borderRadius,
    marginBottom: SPACING.lg,
  },
  emptyText: {
    fontSize: FONT_SIZES.base,
    color: COLORS.textTertiary,
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
    borderBottomColor: COLORS.borderLight,
  },
  taskItemCurrent: {
    backgroundColor: COLORS.currentDayHighlight,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.currentDayBorder,
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
    color: COLORS.textPrimary,
  },
  taskTitleCurrent: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  taskTime: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    marginTop: SPACING.sm,
  },
  taskDuration: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    marginLeft: SPACING.md,
    textAlign: 'right',
    minWidth: 56,
  },
  taskDeleteButton: {
    padding: SPACING.md,
  },
  taskDeleteIcon: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.danger,
    fontWeight: 'bold',
  },
});
