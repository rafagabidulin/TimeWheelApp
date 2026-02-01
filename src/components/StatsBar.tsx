// components/StatsBar.tsx
import React, { useMemo } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Task } from '../types/types';
import { SPACING, FONT_SIZES, useTheme } from '../constants/theme';

interface StatsBarProps {
  loadPercent: number;
  nextTask: Task | undefined;
  isCurrentDay: boolean;
}

/**
 * Компонент статистики и информации о следующей задаче
 */
export default function StatsBar({ loadPercent, nextTask, isCurrentDay }: StatsBarProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      <Text style={styles.statsText}>Загрузка: {loadPercent}%</Text>
      {isCurrentDay ? (
        nextTask ? (
          <Text style={styles.nextTask}>
            ⏰ Следующая: {nextTask.title} {nextTask.startTime}
          </Text>
        ) : (
          <Text style={styles.nextTask}>✅ Все задачи завершены</Text>
        )
      ) : (
        <Text style={styles.nextTask}>📅 Смотрите план на этот день</Text>
      )}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  statsText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  nextTask: {
    fontSize: FONT_SIZES.base,
    color: colors.textSecondary,
    marginTop: SPACING.sm,
  },
});
