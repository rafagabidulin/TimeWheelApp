// components/DaySelector.tsx
import React, { useMemo } from 'react';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import { Day } from '../types/types';
import { SPACING, FONT_SIZES, SIZES, useTheme } from '../constants/theme';

interface DaySelectorProps {
  days: Day[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

/**
 * Компонент выбора дня недели
 * Отображает полоску дней с возможностью выбора
 */
export default function DaySelector({ days, selectedDate, onSelectDate }: DaySelectorProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      {days.map((day) => (
        <TouchableOpacity
          key={day.id}
          style={[styles.dayChip, selectedDate === day.date && styles.selectedDayChip]}
          onPress={() => onSelectDate(day.date)}
          activeOpacity={0.7}
          testID={`day-selector-${day.id}`}>
          <Text
            style={[styles.dayText, selectedDate === day.date && styles.selectedDayText]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}>
            {day.name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
  container: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    gap: SPACING.xs,
  },
  dayChip: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    backgroundColor: colors.cardBackground,
    borderRadius: SIZES.borderRadiusExtraLarge,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedDayChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayText: {
    fontSize: FONT_SIZES.sm,
    color: colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },
  selectedDayText: {
    color: colors.cardBackground,
    fontWeight: '700',
  },
});
