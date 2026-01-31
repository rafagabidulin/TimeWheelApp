import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, SPACING, FONT_SIZES, SIZES } from '../../constants/theme';

interface InlineTimePickerProps {
  onTimeSelect: (hours: number, minutes: number) => void;
  initialTime: string;
}

export default function InlineTimePicker({ onTimeSelect, initialTime }: InlineTimePickerProps) {
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

  const handleDateChange = (event: any, selectedDate?: Date) => {
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
                <Text style={styles.pickerTitle}>Выбрать время</Text>
              </View>

              {/* NATIVE iOS TIME PICKER */}
              <DateTimePicker
                value={date}
                mode="time"
                display="spinner"
                is24Hour={true}
                onChange={handleDateChange}
                textColor={COLORS.textPrimary}
              />

              {/* КНОПКА ЗАКРЫТИЯ */}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowPicker(false)}
                activeOpacity={0.7}>
                <Text style={styles.closeButtonText}>Готово</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  timeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.borderRadius,
    paddingVertical: SPACING.sm,
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeButtonText: {
    fontSize: FONT_SIZES.base,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.modalOverlay,
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    flex: 1,
  },
  pickerContainer: {
    backgroundColor: COLORS.cardBackground,
    borderTopLeftRadius: SIZES.borderRadiusLarge,
    borderTopRightRadius: SIZES.borderRadiusLarge,
    paddingBottom: SPACING.lg,
    gap: SPACING.md,
  },
  pickerHeader: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: SPACING.md,
  },
  pickerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  closeButton: {
    marginHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.success,
    borderRadius: SIZES.borderRadius,
    alignItems: 'center',
  },
  closeButtonText: {
    color: COLORS.cardBackground,
    fontWeight: '600',
    fontSize: FONT_SIZES.base,
  },
});
