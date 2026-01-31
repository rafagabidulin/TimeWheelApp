import React from 'react';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import { Day } from '../types/types';
import { COLORS, SPACING, FONT_SIZES, SIZES } from '../constants/theme';
import { parseDateISO } from '../utils/timeUtils';


interface NavigationBarProps {
  currentDay: Day;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrevDay: () => void;
  onNextDay: () => void;
}


/**
 * Полоска навигации под циферблатом
 * Содержит кнопки влево/вправо и информацию о дате
 */
export default function NavigationBar({
  currentDay,
  canGoPrev,
  canGoNext,
  onPrevDay,
  onNextDay,
}: NavigationBarProps) {
  const getMonthName = (month: number): string => {
    const months = [
      'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
      'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек',
    ];
    return months[month - 1] || '';
  };

  const parsedDate = parseDateISO(currentDay.date);
  const dateLabel = parsedDate
    ? `${parsedDate.getDate()} ${getMonthName(parsedDate.getMonth() + 1)}`
    : currentDay.date;

  return (
    <View style={styles.container}>
      {/* КНОПКА ВЛЕВО */}
      <TouchableOpacity
        style={[styles.navButton, !canGoPrev && styles.navButtonDisabled]}
        onPress={onPrevDay}
        disabled={!canGoPrev}
        activeOpacity={0.7}>
        <Text style={styles.navButtonText}>‹</Text>
      </TouchableOpacity>

      {/* ИНФОРМАЦИЯ О ДАТЕ ПОСЕРЕДИНЕ */}
      <View style={styles.dateInfoContainer}>
        <Text style={styles.dayOfWeekText}>{currentDay.name}</Text>
        <Text style={styles.dateText}>{dateLabel}</Text>
      </View>

      {/* КНОПКА ВПРАВО */}
      <TouchableOpacity
        style={[styles.navButton, !canGoNext && styles.navButtonDisabled]}
        onPress={onNextDay}
        disabled={!canGoNext}
        activeOpacity={0.7}>
        <Text style={styles.navButtonText}>›</Text>
      </TouchableOpacity>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.cardBackground,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: SPACING.md,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonDisabled: {
    backgroundColor: '#CCC',
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: FONT_SIZES.xl,
    color: COLORS.cardBackground,
    fontWeight: 'bold',
  },
  dateInfoContainer: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  dayOfWeekText: {
    fontSize: FONT_SIZES.base,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  dateText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
});
