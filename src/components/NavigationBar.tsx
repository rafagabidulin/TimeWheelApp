import React, { useMemo } from 'react';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import { Day } from '../types/types';
import { SPACING, FONT_SIZES, SIZES, useTheme } from '../constants/theme';
import { parseDateISO } from '../utils/timeUtils';
import { formatShortDate } from '../i18n';


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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const parsedDate = parseDateISO(currentDay.date);
  const dateLabel = parsedDate
    ? formatShortDate(parsedDate)
    : currentDay.date;

  return (
    <View style={styles.container}>
      {/* КНОПКА ВЛЕВО */}
      <TouchableOpacity
        style={[styles.navButton, !canGoPrev && styles.navButtonDisabled]}
        onPress={onPrevDay}
        disabled={!canGoPrev}
        activeOpacity={0.7}
        testID="nav-prev">
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
        activeOpacity={0.7}
        testID="nav-next">
        <Text style={styles.navButtonText}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: colors.cardBackground,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: -SPACING.xl,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonDisabled: {
    backgroundColor: '#CCC',
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: FONT_SIZES.xl,
    color: colors.cardBackground,
    fontWeight: 'bold',
  },
  dateInfoContainer: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  dayOfWeekText: {
    fontSize: FONT_SIZES.base,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dateText: {
    fontSize: FONT_SIZES.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
