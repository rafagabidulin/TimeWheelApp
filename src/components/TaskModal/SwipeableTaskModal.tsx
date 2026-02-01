import React, { useRef, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  TextInput,
  Animated,
  PanResponder,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { FormData, Day } from '../../types/types';
import { COLORS, SPACING, FONT_SIZES, SIZES, SCREEN } from '../../constants/theme';
import { COLOR_OPTIONS, CATEGORY_OPTIONS } from '../../constants/theme';

interface SwipeableTaskModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (options?: { allowOverlap?: boolean }) => Promise<void>;
  onUpdate: (options?: { allowOverlap?: boolean }) => Promise<void>;
  editingTaskId: string | null;
  currentDay: Day;
  formData: FormData;
  setFormData: (data: FormData) => void;
}

/**
 * Компактная модальная форма для задач с нативным временным пикером
 */
export default function SwipeableTaskModal({
  visible,
  onClose,
  onAdd,
  onUpdate,
  editingTaskId,
  currentDay,
  formData,
  setFormData,
}: SwipeableTaskModalProps) {
  const translateYRef = useRef(new Animated.Value(0)).current;
  const panResponderRef = useRef<any>(null);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());

  // Инициализация времён при открытии модалки
  useEffect(() => {
    if (visible) {
      // Парсим стартовое время
      const [sh, sm] = formData.startTime.split(':');
      const startHour = parseInt(sh) || 9;
      const startMin = parseInt(sm) || 0;
      const newStartDate = new Date();
      newStartDate.setHours(startHour, startMin, 0);
      setStartDate(newStartDate);

      // Парсим конечное время
      const [eh, em] = formData.endTime.split(':');
      const endHour = parseInt(eh) || 10;
      const endMin = parseInt(em) || 0;
      const newEndDate = new Date();
      newEndDate.setHours(endHour, endMin, 0);
      setEndDate(newEndDate);

      translateYRef.setValue(0);
    }
  }, [visible, formData.startTime, formData.endTime, translateYRef]);

  if (!panResponderRef.current) {
    panResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: (evt) => evt.nativeEvent.pageY < 50,
      onMoveShouldSetPanResponder: (evt, { dy }) => Math.abs(dy) > 5 && dy > 0,
      onPanResponderMove: (evt, { dy }) => {
        if (dy > 0) translateYRef.setValue(dy);
      },
      onPanResponderRelease: (evt, { dy, vy }) => {
        if (dy > 80 || vy > 0.7) {
          Animated.timing(translateYRef, {
            toValue: SCREEN.height,
            duration: 200,
            useNativeDriver: true,
          }).start(() => onClose());
        } else {
          Animated.spring(translateYRef, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    });
  }

  const isEditing = editingTaskId !== null;

  const handleSaveTask = async () => {
    if (!formData.title.trim()) {
      Alert.alert('Ошибка', 'Введите название задачи');
      return;
    }
    try {
      if (isEditing) {
        await onUpdate();
      } else {
        await onAdd();
      }
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : 'Не удалось сохранить задачу';

      if (message.includes('пересекается')) {
        Alert.alert(
          'Конфликт задач',
          'Задача пересекается с уже существующей. Добавить и скорректировать старую задачу?',
          [
            { text: 'Отмена', style: 'cancel' },
            {
              text: 'Добавить',
              onPress: async () => {
                try {
                  if (isEditing) {
                    await onUpdate({ allowOverlap: true });
                  } else {
                    await onAdd({ allowOverlap: true });
                  }
                } catch (innerError) {
                  const innerMessage =
                    innerError instanceof Error && innerError.message
                      ? innerError.message
                      : 'Не удалось сохранить задачу';
                  Alert.alert('Ошибка', innerMessage);
                }
              },
            },
          ],
        );
        return;
      }

      Alert.alert('Ошибка', message);
    }
  };

  // ⚠️ ВАЖНО: НЕ закрываем пикер при прокрутке - только обновляем значение
  const handleStartTimeChange = (event: any, selectedDate?: Date) => {
    if (selectedDate) {
      setStartDate(selectedDate);
      const hours = String(selectedDate.getHours()).padStart(2, '0');
      const minutes = String(selectedDate.getMinutes()).padStart(2, '0');
      setFormData({ ...formData, startTime: `${hours}:${minutes}` });
      // ⚠️ НЕ закрываем модалку здесь! Только обновляем время.
    }
  };

  // ⚠️ ВАЖНО: НЕ закрываем пикер при прокрутке - только обновляем значение
  const handleEndTimeChange = (event: any, selectedDate?: Date) => {
    if (selectedDate) {
      setEndDate(selectedDate);
      const hours = String(selectedDate.getHours()).padStart(2, '0');
      const minutes = String(selectedDate.getMinutes()).padStart(2, '0');
      setFormData({ ...formData, endTime: `${hours}:${minutes}` });
      // ⚠️ НЕ закрываем модалку здесь! Только обновляем время.
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayTouchable} activeOpacity={1} onPress={onClose} />

        <Animated.View
          style={[styles.modalContent, { transform: [{ translateY: translateYRef }] }]}
          {...panResponderRef.current.panHandlers}>
          {/* ИНДИКАТОР СВАЙПА */}
          <View style={styles.swipeIndicator} />

          {/* СОДЕРЖИМОЕ */}
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.content}>
            {/* ЗАГОЛОВОК */}
            <View style={styles.header}>
              <Text style={styles.title}>{isEditing ? 'Редактировать' : 'Добавить задачу'}</Text>
              <Text style={styles.subtitle}>{currentDay.name}</Text>
            </View>

            {/* НАЗВАНИЕ */}
            <View style={styles.field}>
              <Text style={styles.label}>Название</Text>
              <TextInput
                style={styles.input}
                placeholder="Введите название"
                placeholderTextColor={COLORS.textLight}
                value={formData.title}
                onChangeText={(text) => setFormData({ ...formData, title: text })}
              />
            </View>

            {/* ВРЕМЯ - КНОПКИ */}
            <View style={styles.field}>
              <Text style={styles.label}>Время</Text>
              <View style={styles.timeButtonRow}>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => setShowStartTimePicker(true)}
                  activeOpacity={0.7}>
                  <Text style={styles.timeButtonText}>{formData.startTime}</Text>
                </TouchableOpacity>
                <Text style={styles.timeSeparatorText}>→</Text>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => setShowEndTimePicker(true)}
                  activeOpacity={0.7}>
                  <Text style={styles.timeButtonText}>{formData.endTime}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* КАТЕГОРИЯ */}
            <View style={styles.field}>
              <Text style={styles.label}>Категория</Text>
              <View style={styles.optionGrid}>
                {CATEGORY_OPTIONS.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.option, formData.category === cat && styles.optionSelected]}
                    onPress={() => setFormData({ ...formData, category: cat })}>
                    <Text
                      style={[
                        styles.optionText,
                        formData.category === cat && styles.optionTextSelected,
                      ]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ЦВЕТ */}
            <View style={styles.field}>
              <Text style={styles.label}>Цвет</Text>
              <View style={styles.colorGrid}>
                {COLOR_OPTIONS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      formData.color === color && styles.colorSelected,
                    ]}
                    onPress={() => setFormData({ ...formData, color })}
                  />
                ))}
              </View>
            </View>

            {/* КНОПКИ */}
            <View style={styles.buttons}>
              <TouchableOpacity style={[styles.button, styles.cancelBtn]} onPress={onClose}>
                <Text style={styles.cancelText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.saveBtn]} onPress={handleSaveTask}>
                <Text style={styles.saveText}>{isEditing ? 'Сохранить' : 'Добавить'}</Text>
              </TouchableOpacity>
            </View>
            </View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </View>

      {/* NATIVE iOS TIME PICKER ДЛЯ СТАРТОВОГО ВРЕМЕНИ */}
      {showStartTimePicker && (
        <Modal
          visible={showStartTimePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowStartTimePicker(false)}>
          <View style={timePickerStyles.overlay}>
            <TouchableOpacity
              style={timePickerStyles.overlayTouchable}
              activeOpacity={1}
              onPress={() => setShowStartTimePicker(false)}
            />

            <View style={timePickerStyles.pickerContainer}>
              <View style={timePickerStyles.pickerHeader}>
                <Text style={timePickerStyles.pickerTitle}>Стартовое время</Text>
              </View>

              <DateTimePicker
                value={startDate}
                mode="time"
                display="spinner"
                is24Hour={true}
                onChange={handleStartTimeChange}
                textColor={COLORS.textPrimary}
              />

              {/* КНОПКА "ГОТОВО" - закрывает модалку ТОЛЬКО при нажатии */}
              <TouchableOpacity
                style={timePickerStyles.closeButton}
                onPress={() => setShowStartTimePicker(false)}
                activeOpacity={0.7}>
                <Text style={timePickerStyles.closeButtonText}>Готово</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* NATIVE iOS TIME PICKER ДЛЯ КОНЕЧНОГО ВРЕМЕНИ */}
      {showEndTimePicker && (
        <Modal
          visible={showEndTimePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowEndTimePicker(false)}>
          <View style={timePickerStyles.overlay}>
            <TouchableOpacity
              style={timePickerStyles.overlayTouchable}
              activeOpacity={1}
              onPress={() => setShowEndTimePicker(false)}
            />

            <View style={timePickerStyles.pickerContainer}>
              <View style={timePickerStyles.pickerHeader}>
                <Text style={timePickerStyles.pickerTitle}>Конечное время</Text>
              </View>

              <DateTimePicker
                value={endDate}
                mode="time"
                display="spinner"
                is24Hour={true}
                onChange={handleEndTimeChange}
                textColor={COLORS.textPrimary}
              />

              {/* КНОПКА "ГОТОВО" - закрывает модалку ТОЛЬКО при нажатии */}
              <TouchableOpacity
                style={timePickerStyles.closeButton}
                onPress={() => setShowEndTimePicker(false)}
                activeOpacity={0.7}>
                <Text style={timePickerStyles.closeButtonText}>Готово</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.modalOverlay,
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: COLORS.cardBackground,
    borderTopLeftRadius: SIZES.borderRadiusLarge,
    borderTopRightRadius: SIZES.borderRadiusLarge,
    maxHeight: '90%',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  swipeIndicator: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.textLight,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  content: {
    gap: SPACING.sm,
  },
  header: {
    marginBottom: SPACING.xs,
  },
  title: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
  },
  field: {
    gap: SPACING.xs,
  },
  label: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.borderRadius,
    padding: SPACING.sm,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textPrimary,
    backgroundColor: '#F9F9F9',
  },
  timeButtonRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    alignItems: 'center',
  },
  timeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.borderRadius,
    paddingVertical: SPACING.sm,
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
  },
  timeButtonText: {
    fontSize: FONT_SIZES.base,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  timeSeparatorText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  option: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.borderRadius,
    alignItems: 'center',
  },
  optionSelected: {
    borderColor: COLORS.primary,
    borderWidth: 2,
    backgroundColor: '#E3F2FD',
  },
  optionText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  optionTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  colorOption: {
    width: '20%',
    aspectRatio: 1,
    borderRadius: SIZES.borderRadiusLarge,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSelected: {
    borderColor: COLORS.textPrimary,
    borderWidth: 3,
  },
  buttons: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  button: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: SIZES.borderRadius,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#F0F0F0',
  },
  cancelText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: FONT_SIZES.sm,
  },
  saveBtn: {
    backgroundColor: COLORS.success,
  },
  saveText: {
    color: COLORS.cardBackground,
    fontWeight: '600',
    fontSize: FONT_SIZES.sm,
  },
});

const timePickerStyles = StyleSheet.create({
  overlay: {
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
