// components/ScheduleParserModal.tsx
import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { parseSchedule, validateParsedTask, ParsedTask } from '../utils/scheduleParser';
import { SPACING, FONT_SIZES, SIZES, useTheme } from '../constants/theme';

interface ScheduleParserModalProps {
  visible: boolean;
  onClose: () => void;
  onAddTasks: (tasks: ParsedTask[]) => Promise<{ added: number; skipped: number }>;
}

/**
 * Модальное окно для парсинга расписания из текста
 * Пользователь вводит: "Работа 9:00-13:00, обед 13:00-14:00, тренировка 19:00-20:00"
 * Парсер распознаёт и показывает список задач для подтверждения
 */
export default function ScheduleParserModal({
  visible,
  onClose,
  onAddTasks,
}: ScheduleParserModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [input, setInput] = useState('');
  const [parsedTasks, setParsedTasks] = useState<ParsedTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  /**
   * Парсим введённый текст
   */
  const handleParse = () => {
    if (!input.trim()) {
      Alert.alert('Ошибка', 'Введите расписание');
      return;
    }

    setLoading(true);

    try {
      const tasks = parseSchedule(input);

      if (tasks.length === 0) {
        Alert.alert('Ошибка', 'Не удалось распарсить расписание. Попробуйте формат: "Название 9:00-13:00"');
        setLoading(false);
        return;
      }

      // Валидируем каждую задачу
      const validatedTasks = tasks.filter((task) => {
        const validation = validateParsedTask(task);
        if (!validation.valid) {
          console.warn(`[Parser] Invalid task: ${task.title} - ${validation.error}`);
        }
        return validation.valid;
      });

      if (validatedTasks.length === 0) {
        Alert.alert('Ошибка', 'Все задачи содержат ошибки. Проверьте формат времени.');
        setLoading(false);
        return;
      }

      setParsedTasks(validatedTasks);
      setShowPreview(true);
    } catch (error) {
      console.error('[Parser] Error:', error);
      Alert.alert('Ошибка', 'Ошибка при парсинге расписания');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Добавляем распарсенные задачи
   */
  const handleAddTasks = async () => {
    setLoading(true);
    try {
      const result = await onAddTasks(parsedTasks);
      setInput('');
      setParsedTasks([]);
      setShowPreview(false);
      const skippedInfo =
        result.skipped > 0 ? `, пропущено ${result.skipped} из-за конфликтов` : '';
      Alert.alert('Успех', `Добавлено ${result.added} задач${skippedInfo}`);
      onClose();
    } catch (error) {
      console.error('[Parser] Error adding tasks:', error);
      Alert.alert('Ошибка', 'Не удалось добавить задачи');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setInput('');
    setParsedTasks([]);
    setShowPreview(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.overlayTouchable} activeOpacity={1} onPress={handleClose} />

          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.container}>
          {!showPreview ? (
            <>
              {/* ВВОД РАСПИСАНИЯ */}
              <View style={styles.header}>
                <Text style={styles.title}>Добавить расписание</Text>
                <Text style={styles.hint}>
                  Введите расписание в формате: "Название 9:00-13:00, название 13:00-14:00"
                </Text>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Работа 9:00-13:00, обед 13:00-14:00, тренировка 19:00-20:00"
                placeholderTextColor={colors.textLight}
                value={input}
                onChangeText={setInput}
                multiline
                numberOfLines={4}
                editable={!loading}
                maxLength={1000}
              />

              <View style={styles.buttons}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelBtn]}
                  onPress={handleClose}
                  disabled={loading}>
                  <Text style={styles.cancelText}>Отмена</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.parseBtn]}
                  onPress={handleParse}
                  disabled={loading}
                  activeOpacity={0.7}>
                  {loading ? (
                    <ActivityIndicator color={colors.cardBackground} />
                  ) : (
                    <Text style={styles.parseText}>Распарсить</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {/* ПРЕДПРОСМОТР РАСПАРСЕННЫХ ЗАДАЧ */}
              <View style={styles.header}>
                <Text style={styles.title}>Проверка расписания</Text>
                <Text style={styles.subtitle}>Найдено {parsedTasks.length} задач</Text>
              </View>

              <ScrollView style={styles.preview} keyboardShouldPersistTaps="handled">
                {parsedTasks.map((task, index) => (
                  <View key={index} style={styles.taskPreview}>
                    <View style={[styles.taskColorDot, { backgroundColor: task.color }]} />

                    <View style={styles.taskInfo}>
                      <Text style={styles.taskTitle}>{task.title}</Text>
                      <Text style={styles.taskTime}>
                        {task.startTime} → {task.endTime}
                      </Text>
                      <Text style={styles.taskCategory}>{task.category}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.buttons}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelBtn]}
                  onPress={() => setShowPreview(false)}
                  disabled={loading}>
                  <Text style={styles.cancelText}>Назад</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.addBtn]}
                  onPress={handleAddTasks}
                  disabled={loading}
                  activeOpacity={0.7}>
                  {loading ? (
                    <ActivityIndicator color={colors.cardBackground} />
                  ) : (
                    <Text style={styles.addText}>Добавить все</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
            )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: colors.modalOverlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayTouchable: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    width: '90%',
    backgroundColor: colors.cardBackground,
    borderRadius: SIZES.borderRadiusLarge,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    maxHeight: '85%',
    gap: SPACING.md,
  },
  header: {
    gap: SPACING.xs,
  },
  title: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: colors.textSecondary,
  },
  hint: {
    fontSize: FONT_SIZES.xs,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: SIZES.borderRadius,
    padding: SPACING.md,
    fontSize: FONT_SIZES.sm,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    textAlignVertical: 'top',
    minHeight: 100,
  },
  preview: {
    borderRadius: SIZES.borderRadius,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: SPACING.sm,
    maxHeight: 300,
  },
  taskPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: SPACING.md,
  },
  taskColorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  taskInfo: {
    flex: 1,
    gap: SPACING.xs,
  },
  taskTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  taskTime: {
    fontSize: FONT_SIZES.xs,
    color: colors.textSecondary,
  },
  taskCategory: {
    fontSize: FONT_SIZES.xs,
    color: colors.textTertiary,
  },
  buttons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  button: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: SIZES.borderRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: '#F0F0F0',
  },
  cancelText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: FONT_SIZES.sm,
  },
  parseBtn: {
    backgroundColor: colors.primary,
  },
  parseText: {
    color: colors.cardBackground,
    fontWeight: '600',
    fontSize: FONT_SIZES.sm,
  },
  addBtn: {
    backgroundColor: colors.success,
  },
  addText: {
    color: colors.cardBackground,
    fontWeight: '600',
    fontSize: FONT_SIZES.sm,
  },
});
