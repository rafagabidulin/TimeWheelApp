// components/StatsBar.tsx
import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Task } from '../types/types';
import { COLORS, SPACING, FONT_SIZES } from '../constants/theme';

interface StatsBarProps {
  loadPercent: number;
  nextTask: Task | undefined;
  isCurrentDay: boolean;
}

/**
 * Компонент статистики и информации о следующей задаче
 */
export default function StatsBar({ loadPercent, nextTask, isCurrentDay }: StatsBarProps) {
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

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  statsText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  nextTask: {
    fontSize: FONT_SIZES.base,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
});
