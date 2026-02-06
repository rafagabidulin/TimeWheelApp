import React, { useMemo, useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { SPACING, FONT_SIZES, SIZES, useTheme } from '../../constants/theme';

interface InlineTimePickerProps {
  onTimeSelect: (hours: number, minutes: number) => void;
  initialTime: string;
}

export default function InlineTimePicker({ onTimeSelect, initialTime }: InlineTimePickerProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [date, setDate] = useState<Date>(new Date());
  const [showPicker, setShowPicker] = useState(false);

  // Инициализация из initialTime
  useEffect(() => {
    if (initialTime && initialTime.includes(':')) {
      const [h, m] = initialTime.split(':');
      const hour = parseInt(h) || 0;
      const minute = parseInt(m) || 0;

      const newDate = new Date();
      newDate.setHours(hour, minute, 0);
      setDate(newDate);
    }
  }, [initialTime]);

  const handleDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (selectedDate) {
      setDate(selectedDate);
      const hours = selectedDate.getHours();
      const minutes = selectedDate.getMinutes();
      onTimeSelect(hours, minutes);
      setShowPicker(false);
    }
  };

  const displayTime = `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;

  return (
    <>
      {/* КНОПКА ОТКРЫТИЯ ПИКЕРА */}
      <TouchableOpacity
        style={styles.timeButton}
        onPress={() => setShowPicker(true)}
        activeOpacity={0.7}>
        <Text style={styles.timeButtonText}>{displayTime}</Text>
      </TouchableOpacity>

      {/* МОДАЛЬНОЕ ОКНО С ПИКЕРОМ */}
      {showPicker && (
        <Modal
          visible={showPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPicker(false)}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.overlayTouchable}
              activeOpacity={1}
              onPress={() => setShowPicker(false)}
            />

            <View style={styles.pickerContainer}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>{t('timePicker.selectTimeTitle')}</Text>
              </View>

              {/* NATIVE iOS TIME PICKER */}
              <DateTimePicker
                value={date}
                mode="time"
                display="spinner"
                is24Hour={true}
                onChange={handleDateChange}
                textColor={colors.textPrimary}
              />

              {/* КНОПКА ЗАКРЫТИЯ */}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowPicker(false)}
                activeOpacity={0.7}>
                <Text style={styles.closeButtonText}>{t('common.done')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
  timeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: SIZES.borderRadius,
    paddingVertical: SPACING.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeButtonText: {
    fontSize: FONT_SIZES.base,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.modalOverlay,
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    flex: 1,
  },
  pickerContainer: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: SIZES.borderRadiusLarge,
    borderTopRightRadius: SIZES.borderRadiusLarge,
    paddingBottom: SPACING.lg,
    gap: SPACING.md,
  },
  pickerHeader: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: SPACING.md,
  },
  pickerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  closeButton: {
    marginHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: colors.success,
    borderRadius: SIZES.borderRadius,
    alignItems: 'center',
  },
  closeButtonText: {
    color: colors.cardBackground,
    fontWeight: '600',
    fontSize: FONT_SIZES.base,
  },
});
