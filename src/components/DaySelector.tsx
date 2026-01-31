// components/DaySelector.tsx
import React from 'react';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import { Day } from '../types/types';
import { COLORS, SPACING, FONT_SIZES, SIZES } from '../constants/theme';

interface DaySelectorProps {
  days: Day[];
  selectedDayId: string;
  onSelectDay: (dayId: string) => void;
}

/**
 * Компонент выбора дня недели
 * Отображает полоску дней с возможностью выбора
 */
export default function DaySelector({ days, selectedDayId, onSelectDay }: DaySelectorProps) {
  return (
    <View style={styles.container}>
      {days.map((day) => (
        <TouchableOpacity
          key={day.id}
          style={[styles.dayChip, selectedDayId === day.id && styles.selectedDayChip]}
          onPress={() => onSelectDay(day.id)}
          activeOpacity={0.7}>
          <Text style={[styles.dayText, selectedDayId === day.id && styles.selectedDayText]}>
            {day.name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  dayChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.borderRadiusExtraLarge,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedDayChip: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dayText: {
    fontSize: FONT_SIZES.base,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  selectedDayText: {
    color: COLORS.cardBackground,
    fontWeight: '700',
  },
});
