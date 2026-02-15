import React, { useMemo, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLOR_OPTIONS, FONT_SIZES, SPACING, useTheme } from '../constants/theme';
import {
  Template,
  TemplateApplyOptions,
  TemplateApplyPolicy,
  TemplateApplyPreview,
  TemplateTaskInput,
  TemplateType,
  WeekdayId,
} from '../types/types';
import { addDays, formatDateISO, isValidTimeRange, parseDateISO } from '../utils/timeUtils';

interface TemplatesScreenProps {
  templates: Template[];
  selectedDate: string;
  onBack: () => void;
  onCreateTemplate: (type: TemplateType) => void;
  onSaveTemplate: (nextTemplate: Template) => void;
  onDeleteTemplate: (templateId: string) => void;
  onPreviewTemplate: (template: Template, options: TemplateApplyOptions) => TemplateApplyPreview;
  onApplyTemplate: (template: Template, options: TemplateApplyOptions) => Promise<TemplateApplyPreview>;
}

const WEEKDAY_LABELS: Record<WeekdayId, string> = {
  monday: 'Пн',
  tuesday: 'Вт',
  wednesday: 'Ср',
  thursday: 'Чт',
  friday: 'Пт',
  saturday: 'Сб',
  sunday: 'Вс',
};

function cloneTemplate(template: Template): Template {
  if (template.type === 'day') {
    return { ...template, tasks: template.tasks.map((task) => ({ ...task })) };
  }
  if (template.type === 'week') {
    return {
      ...template,
      days: Object.fromEntries(
        Object.entries(template.days).map(([key, tasks]) => [key, tasks.map((task) => ({ ...task }))]),
      ) as Template['days'],
    };
  }
  return {
    ...template,
    days: Object.fromEntries(
      Object.entries(template.days).map(([key, tasks]) => [key, tasks.map((task) => ({ ...task }))]),
    ),
  };
}

const TABS: Array<{ id: TemplateType; label: string }> = [
  { id: 'day', label: 'День' },
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
];

function getTemplateSummary(template: Template): string {
  if (template.type === 'day') {
    return `${template.tasks.length} задач`;
  }

  if (template.type === 'week') {
    const daysWithTasks = Object.values(template.days).filter((tasks) => tasks.length > 0).length;
    const totalTasks = Object.values(template.days).reduce((sum, tasks) => sum + tasks.length, 0);
    return `${daysWithTasks} дн. с задачами · ${totalTasks} задач`;
  }

  const datesWithTasks = Object.values(template.days).filter((tasks) => tasks.length > 0).length;
  const totalTasks = Object.values(template.days).reduce((sum, tasks) => sum + tasks.length, 0);
  return `${datesWithTasks} дат · ${totalTasks} задач`;
}

function getTemplatePreview(template: Template): string {
  if (template.type === 'day') {
    return 'Шаблон на один день';
  }
  if (template.type === 'week') {
    return 'Пн-Вс с разным набором задач';
  }
  return 'Набор задач по конкретным датам';
}

export default function TemplatesScreen({
  templates,
  selectedDate,
  onBack,
  onCreateTemplate,
  onSaveTemplate,
  onDeleteTemplate,
  onPreviewTemplate,
  onApplyTemplate,
}: TemplatesScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState<TemplateType>('day');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [applyPolicy, setApplyPolicy] = useState<TemplateApplyPolicy>('empty_only');
  const [targetMode, setTargetMode] = useState<'selected_day' | 'next_7_days' | 'current_week' | 'next_4_weeks' | 'current_month'>('selected_day');
  const [preview, setPreview] = useState<TemplateApplyPreview | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editingTemplateDraft, setEditingTemplateDraft] = useState<Template | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [activeTaskGroup, setActiveTaskGroup] = useState<string>('day');
  const [openColorPickerTaskIndex, setOpenColorPickerTaskIndex] = useState<number | null>(null);

  const filteredTemplates = useMemo(
    () => templates.filter((template) => template.type === activeTab),
    [templates, activeTab],
  );

  const targetModeOptions = useMemo(() => {
    if (!selectedTemplate) return [];
    if (selectedTemplate.type === 'day') {
      return [
        { id: 'selected_day' as const, label: 'Только выбранный день' },
        { id: 'next_7_days' as const, label: 'Следующие 7 дней' },
      ];
    }
    if (selectedTemplate.type === 'week') {
      return [
        { id: 'current_week' as const, label: 'Текущая неделя' },
        { id: 'next_4_weeks' as const, label: 'Следующие 4 недели' },
      ];
    }
    return [{ id: 'current_month' as const, label: 'Текущий месяц' }];
  }, [selectedTemplate]);

  const openApplyModal = useCallback((template: Template) => {
    setSelectedTemplate(template);
    setApplyPolicy('empty_only');
    setPreview(null);
    if (template.type === 'day') {
      setTargetMode('selected_day');
    } else if (template.type === 'week') {
      setTargetMode('current_week');
    } else {
      setTargetMode('current_month');
    }
  }, []);

  const closeApplyModal = useCallback(() => {
    setSelectedTemplate(null);
    setPreview(null);
    setIsApplying(false);
  }, []);

  const buildTargetDates = useCallback((): string[] => {
    const anchor = parseDateISO(selectedDate) || new Date();
    const result: string[] = [];

    if (targetMode === 'selected_day') {
      return [formatDateISO(anchor)];
    }

    if (targetMode === 'next_7_days') {
      for (let index = 0; index < 7; index += 1) {
        result.push(formatDateISO(addDays(anchor, index)));
      }
      return result;
    }

    const weekStart = (() => {
      const d = new Date(anchor);
      const jsDay = d.getDay();
      const offset = jsDay === 0 ? -6 : 1 - jsDay;
      d.setDate(d.getDate() + offset);
      d.setHours(0, 0, 0, 0);
      return d;
    })();

    if (targetMode === 'current_week') {
      for (let index = 0; index < 7; index += 1) {
        result.push(formatDateISO(addDays(weekStart, index)));
      }
      return result;
    }

    if (targetMode === 'next_4_weeks') {
      for (let index = 0; index < 28; index += 1) {
        result.push(formatDateISO(addDays(weekStart, index)));
      }
      return result;
    }

    const year = anchor.getFullYear();
    const month = anchor.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      result.push(formatDateISO(new Date(year, month, day)));
    }
    return result;
  }, [selectedDate, targetMode]);

  const buildApplyOptions = useCallback((): TemplateApplyOptions => {
    return {
      policy: applyPolicy,
      targetDates: buildTargetDates(),
    };
  }, [applyPolicy, buildTargetDates]);

  const handlePreviewPress = useCallback(() => {
    if (!selectedTemplate) return;
    const nextPreview = onPreviewTemplate(selectedTemplate, buildApplyOptions());
    setPreview(nextPreview);
  }, [selectedTemplate, onPreviewTemplate, buildApplyOptions]);

  const handleApplyPress = useCallback(async () => {
    if (!selectedTemplate) return;
    try {
      setIsApplying(true);
      const result = await onApplyTemplate(selectedTemplate, buildApplyOptions());
      setPreview(result);
      Alert.alert(
        'Шаблон применен',
        `Добавлено задач: ${result.addedTasks}\nИзменено дней: ${result.replacedDays}\nПропущено конфликтов: ${result.skippedConflicts}`,
      );
      closeApplyModal();
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось применить шаблон.');
    } finally {
      setIsApplying(false);
    }
  }, [selectedTemplate, onApplyTemplate, buildApplyOptions, closeApplyModal]);

  const handleOpenEdit = useCallback((template: Template) => {
    setEditingTemplate(template);
    setRenameInput(template.name);
    const draft = cloneTemplate(template);
    setEditingTemplateDraft(draft);
    if (template.type === 'day') {
      setActiveTaskGroup('day');
    } else if (template.type === 'week') {
      setActiveTaskGroup('monday');
    } else {
      const monthDates = Object.keys(template.days).sort();
      setActiveTaskGroup(monthDates[0] || '');
    }
    setOpenColorPickerTaskIndex(null);
  }, []);

  const handleCloseEdit = useCallback(() => {
    setEditingTemplate(null);
    setEditingTemplateDraft(null);
    setRenameInput('');
    setActiveTaskGroup('day');
    setOpenColorPickerTaskIndex(null);
  }, []);

  const updateTasksInDraft = useCallback(
    (updater: (tasks: TemplateTaskInput[]) => TemplateTaskInput[]) => {
      setEditingTemplateDraft((prev) => {
        if (!prev) return prev;
        if (prev.type === 'day') {
          return { ...prev, tasks: updater(prev.tasks) };
        }
        if (prev.type === 'week') {
          const key = (activeTaskGroup || 'monday') as WeekdayId;
          const current = prev.days[key] || [];
          return {
            ...prev,
            days: {
              ...prev.days,
              [key]: updater(current),
            },
          };
        }
        if (!activeTaskGroup) return prev;
        const current = prev.days[activeTaskGroup] || [];
        return {
          ...prev,
          days: {
            ...prev.days,
            [activeTaskGroup]: updater(current),
          },
        };
      });
    },
    [activeTaskGroup],
  );

  const getCurrentDraftTasks = useCallback((): TemplateTaskInput[] => {
    if (!editingTemplateDraft) return [];
    if (editingTemplateDraft.type === 'day') {
      return editingTemplateDraft.tasks;
    }
    if (editingTemplateDraft.type === 'week') {
      return editingTemplateDraft.days[(activeTaskGroup || 'monday') as WeekdayId] || [];
    }
    return activeTaskGroup ? editingTemplateDraft.days[activeTaskGroup] || [] : [];
  }, [editingTemplateDraft, activeTaskGroup]);

  const handleTaskFieldChange = useCallback(
    (index: number, field: keyof TemplateTaskInput, value: string) => {
      updateTasksInDraft((tasks) =>
        tasks.map((task, taskIndex) => (taskIndex === index ? { ...task, [field]: value } : task)),
      );
    },
    [updateTasksInDraft],
  );

  const handleAddTaskToDraft = useCallback(() => {
    updateTasksInDraft((tasks) => [
      ...tasks,
      {
        title: '',
        startTime: '09:00',
        endTime: '10:00',
        category: 'custom',
        color: '#4CAF50',
      },
    ]);
  }, [updateTasksInDraft]);

  const handleDeleteTaskFromDraft = useCallback(
    (index: number) => {
      updateTasksInDraft((tasks) => tasks.filter((_, taskIndex) => taskIndex !== index));
    },
    [updateTasksInDraft],
  );

  const validateDraftTasks = useCallback((draft: Template): boolean => {
    const groups: Array<{ label: string; tasks: TemplateTaskInput[] }> = [];
    if (draft.type === 'day') {
      groups.push({ label: 'День', tasks: draft.tasks });
    } else if (draft.type === 'week') {
      (Object.keys(draft.days) as WeekdayId[]).forEach((weekdayId) => {
        groups.push({ label: WEEKDAY_LABELS[weekdayId], tasks: draft.days[weekdayId] || [] });
      });
    } else {
      Object.entries(draft.days).forEach(([date, tasks]) => {
        groups.push({ label: date, tasks });
      });
    }

    for (const group of groups) {
      for (let index = 0; index < group.tasks.length; index += 1) {
        const task = group.tasks[index];
        if (!task.title.trim()) {
          Alert.alert('Ошибка', `Пустое название в ${group.label}, задача ${index + 1}.`);
          return false;
        }
        if (!isValidTimeRange(task.startTime, task.endTime)) {
          Alert.alert('Ошибка', `Некорректное время в ${group.label}, задача ${index + 1}.`);
          return false;
        }
      }
    }

    return true;
  }, []);

  const handleSaveTemplateConfirm = useCallback(() => {
    if (!editingTemplate || !editingTemplateDraft) return;
    const nextName = renameInput.trim();
    if (!nextName) {
      Alert.alert('Ошибка', 'Название шаблона не может быть пустым.');
      return;
    }
    if (!validateDraftTasks(editingTemplateDraft)) {
      return;
    }
    onSaveTemplate({
      ...editingTemplateDraft,
      id: editingTemplate.id,
      name: nextName,
      updatedAt: new Date().toISOString(),
    });
    handleCloseEdit();
  }, [editingTemplate, editingTemplateDraft, renameInput, onSaveTemplate, handleCloseEdit, validateDraftTasks]);

  const handleDeleteConfirm = useCallback(() => {
    if (!editingTemplate) return;
    Alert.alert(
      'Удалить шаблон?',
      `Шаблон "${editingTemplate.name}" будет удален без возможности восстановления.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => {
            onDeleteTemplate(editingTemplate.id);
            handleCloseEdit();
          },
        },
      ],
    );
  }, [editingTemplate, onDeleteTemplate, handleCloseEdit]);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.8}>
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Шаблоны</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabsContainer}>
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.8}>
              <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {filteredTemplates.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Пока нет шаблонов</Text>
          <Text style={styles.emptySubtitle}>
            Создайте первый шаблон для вкладки "{TABS.find((tab) => tab.id === activeTab)?.label}".
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredTemplates}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <View style={styles.cardBadge}>
                  <Text style={styles.cardBadgeText}>
                    {item.type === 'day' ? 'День' : item.type === 'week' ? 'Неделя' : 'Месяц'}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardSubtitle}>{getTemplateSummary(item)}</Text>
              <Text style={styles.cardPreview}>{getTemplatePreview(item)}</Text>

              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.applyButton} onPress={() => openApplyModal(item)} activeOpacity={0.8}>
                  <Text style={styles.applyButtonText}>Применить</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => handleOpenEdit(item)} activeOpacity={0.8}>
                  <Text style={styles.secondaryButtonText}>Редактировать</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <View style={styles.footer}>
        <TouchableOpacity style={styles.createButton} onPress={() => onCreateTemplate(activeTab)} activeOpacity={0.85}>
          <Text style={styles.createButtonText}>+ Создать шаблон</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={Boolean(selectedTemplate)} animationType="slide" transparent onRequestClose={closeApplyModal}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback accessible={false}>
              <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Применение шаблона</Text>
              <TouchableOpacity onPress={closeApplyModal} activeOpacity={0.8}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag">
              {selectedTemplate && (
                <>
                  <Text style={styles.sectionLabel}>Шаблон</Text>
                  <Text style={styles.selectedTemplateName}>{selectedTemplate.name}</Text>

                  <Text style={styles.sectionLabel}>Куда применить</Text>
                  <View style={styles.optionList}>
                    {targetModeOptions.map((mode) => {
                      const isActive = mode.id === targetMode;
                      return (
                        <TouchableOpacity
                          key={mode.id}
                          style={[styles.optionButton, isActive && styles.optionButtonActive]}
                          onPress={() => {
                            setTargetMode(mode.id);
                            setPreview(null);
                          }}
                          activeOpacity={0.8}>
                          <Text style={[styles.optionButtonText, isActive && styles.optionButtonTextActive]}>
                            {mode.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={styles.sectionLabel}>Политика конфликтов</Text>
                  <View style={styles.optionList}>
                    {[
                      { id: 'empty_only' as const, label: 'Только в пустые дни' },
                      { id: 'replace' as const, label: 'Заменить день целиком' },
                      { id: 'merge_skip_conflicts' as const, label: 'Объединить, конфликты пропустить' },
                    ].map((policy) => {
                      const isActive = policy.id === applyPolicy;
                      return (
                        <TouchableOpacity
                          key={policy.id}
                          style={[styles.optionButton, isActive && styles.optionButtonActive]}
                          onPress={() => {
                            setApplyPolicy(policy.id);
                            setPreview(null);
                          }}
                          activeOpacity={0.8}>
                          <Text style={[styles.optionButtonText, isActive && styles.optionButtonTextActive]}>
                            {policy.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity style={styles.previewButton} onPress={handlePreviewPress} activeOpacity={0.85}>
                    <Text style={styles.previewButtonText}>Предпросмотр</Text>
                  </TouchableOpacity>

                  {preview && (
                    <View style={styles.previewCard}>
                      <Text style={styles.previewTitle}>Результат предпросмотра</Text>
                      <Text style={styles.previewLine}>Целевых дат: {preview.targetDatesCount}</Text>
                      <Text style={styles.previewLine}>Будет затронуто дней: {preview.affectedDates.length}</Text>
                      <Text style={styles.previewLine}>Добавится задач: {preview.addedTasks}</Text>
                      <Text style={styles.previewLine}>Заменится дней: {preview.replacedDays}</Text>
                      <Text style={styles.previewLine}>Пропущено конфликтов: {preview.skippedConflicts}</Text>
                      <Text style={styles.previewLine}>Без изменений: {preview.untouchedDays}</Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.confirmButton, (!preview || isApplying) && styles.confirmButtonDisabled]}
              onPress={handleApplyPress}
              activeOpacity={0.85}
              disabled={!preview || isApplying}>
              {isApplying ? (
                <ActivityIndicator color={colors.cardBackground} />
              ) : (
                <Text style={styles.confirmButtonText}>Подтвердить применение</Text>
              )}
            </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={Boolean(editingTemplate)} animationType="fade" transparent onRequestClose={handleCloseEdit}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.modalOverlayCentered}>
            <TouchableWithoutFeedback accessible={false}>
              <View style={styles.editModalCard}>
            <Text style={styles.editTitle}>Редактирование шаблона</Text>
            <Text style={styles.editLabel}>Название</Text>
            <TextInput
              value={renameInput}
              onChangeText={setRenameInput}
              style={styles.editInput}
              placeholder="Введите название"
              placeholderTextColor={colors.textTertiary}
              autoFocus
            />

            <Text style={styles.editLabel}>Задачи шаблона</Text>
            {editingTemplateDraft?.type === 'week' && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupSelectorRow}>
                {(Object.keys(WEEKDAY_LABELS) as WeekdayId[]).map((weekdayId) => {
                  const isActive = activeTaskGroup === weekdayId;
                  return (
                    <TouchableOpacity
                      key={weekdayId}
                      style={[styles.groupSelectorButton, isActive && styles.groupSelectorButtonActive]}
                      onPress={() => {
                        setActiveTaskGroup(weekdayId);
                        setOpenColorPickerTaskIndex(null);
                      }}
                      activeOpacity={0.85}>
                      <Text style={[styles.groupSelectorText, isActive && styles.groupSelectorTextActive]}>
                        {WEEKDAY_LABELS[weekdayId]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            {editingTemplateDraft?.type === 'month' && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupSelectorRow}>
                {Object.keys(editingTemplateDraft.days)
                  .sort()
                  .map((dateKey) => {
                    const isActive = activeTaskGroup === dateKey;
                    return (
                      <TouchableOpacity
                        key={dateKey}
                        style={[styles.groupSelectorButton, isActive && styles.groupSelectorButtonActive]}
                        onPress={() => {
                          setActiveTaskGroup(dateKey);
                          setOpenColorPickerTaskIndex(null);
                        }}
                        activeOpacity={0.85}>
                        <Text style={[styles.groupSelectorText, isActive && styles.groupSelectorTextActive]}>
                          {dateKey.slice(5)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>
            )}

            <ScrollView
              style={styles.tasksEditorContainer}
              contentContainerStyle={styles.tasksEditorContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag">
              {getCurrentDraftTasks().map((task, index) => (
                <View key={`${activeTaskGroup}-${index}`} style={styles.taskEditorCard}>
                  <View style={styles.taskEditorHeader}>
                    <Text style={styles.taskEditorTitle}>Задача {index + 1}</Text>
                    <TouchableOpacity onPress={() => handleDeleteTaskFromDraft(index)} activeOpacity={0.85}>
                      <Text style={styles.taskDeleteText}>Удалить</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    value={task.title}
                    onChangeText={(value) => handleTaskFieldChange(index, 'title', value)}
                    style={styles.taskInput}
                    placeholder="Название"
                    placeholderTextColor={colors.textTertiary}
                  />
                  <View style={styles.timeRow}>
                    <TextInput
                      value={task.startTime}
                      onChangeText={(value) => handleTaskFieldChange(index, 'startTime', value)}
                      style={[styles.taskInput, styles.timeInput]}
                      placeholder="09:00"
                      placeholderTextColor={colors.textTertiary}
                    />
                    <TextInput
                      value={task.endTime}
                      onChangeText={(value) => handleTaskFieldChange(index, 'endTime', value)}
                      style={[styles.taskInput, styles.timeInput]}
                      placeholder="10:00"
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                  <View style={styles.timeRow}>
                    <TextInput
                      value={task.category}
                      onChangeText={(value) => handleTaskFieldChange(index, 'category', value)}
                      style={[styles.taskInput, styles.categoryInput]}
                      placeholder="Категория"
                      placeholderTextColor={colors.textTertiary}
                    />
                    <TouchableOpacity
                      style={styles.colorPreviewButton}
                      onPress={() =>
                        setOpenColorPickerTaskIndex((prev) => (prev === index ? null : index))
                      }
                      activeOpacity={0.85}>
                      <View style={[styles.colorSwatch, { backgroundColor: task.color }]} />
                      <Text style={styles.colorPreviewText}>Цвет</Text>
                    </TouchableOpacity>
                  </View>
                  {openColorPickerTaskIndex === index && (
                    <View style={styles.colorPalette}>
                      {COLOR_OPTIONS.map((color) => {
                        const isSelected = task.color === color;
                        return (
                          <TouchableOpacity
                            key={`${index}-${color}`}
                            style={[styles.paletteColorButton, isSelected && styles.paletteColorButtonActive]}
                            onPress={() => {
                              handleTaskFieldChange(index, 'color', color);
                              setOpenColorPickerTaskIndex(null);
                            }}
                            activeOpacity={0.85}>
                            <View style={[styles.paletteColorSwatch, { backgroundColor: color }]} />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.addTaskButton} onPress={handleAddTaskToDraft} activeOpacity={0.85}>
              <Text style={styles.addTaskButtonText}>+ Добавить задачу</Text>
            </TouchableOpacity>

            <View style={styles.editActionsRow}>
              <TouchableOpacity style={styles.editSecondaryButton} onPress={handleCloseEdit} activeOpacity={0.85}>
                <Text style={styles.editSecondaryButtonText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.editPrimaryButton} onPress={handleSaveTemplateConfirm} activeOpacity={0.85}>
                <Text style={styles.editPrimaryButtonText}>Сохранить</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteConfirm} activeOpacity={0.85}>
              <Text style={styles.deleteButtonText}>Удалить шаблон</Text>
            </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.cardBackground,
    },
    backButton: {
      minWidth: 86,
    },
    backButtonText: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: FONT_SIZES.base,
    },
    title: {
      fontSize: FONT_SIZES.xl,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    headerSpacer: {
      width: 86,
    },
    tabsContainer: {
      flexDirection: 'row',
      marginHorizontal: SPACING.lg,
      marginTop: SPACING.lg,
      padding: SPACING.xs,
      borderRadius: 12,
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.border,
      gap: SPACING.xs,
    },
    tabButton: {
      flex: 1,
      paddingVertical: SPACING.sm,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabButtonActive: {
      backgroundColor: colors.primary,
    },
    tabButtonText: {
      fontSize: FONT_SIZES.base,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    tabButtonTextActive: {
      color: colors.cardBackground,
    },
    listContent: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.lg,
      paddingBottom: 140,
      gap: SPACING.md,
    },
    card: {
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: SPACING.lg,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.sm,
      gap: SPACING.md,
    },
    cardTitle: {
      flex: 1,
      fontSize: FONT_SIZES.lg,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    cardBadge: {
      borderRadius: 999,
      backgroundColor: colors.currentDayHighlight,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
    },
    cardBadgeText: {
      color: colors.textSecondary,
      fontWeight: '700',
      fontSize: FONT_SIZES.xs,
    },
    cardSubtitle: {
      color: colors.textSecondary,
      fontSize: FONT_SIZES.sm,
      marginBottom: SPACING.xs,
    },
    cardPreview: {
      color: colors.textTertiary,
      fontSize: FONT_SIZES.sm,
      marginBottom: SPACING.md,
    },
    cardActions: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    applyButton: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: SPACING.sm,
    },
    applyButtonText: {
      color: colors.cardBackground,
      fontSize: FONT_SIZES.base,
      fontWeight: '700',
    },
    secondaryButton: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: SPACING.sm,
    },
    secondaryButtonText: {
      color: colors.textSecondary,
      fontSize: FONT_SIZES.base,
      fontWeight: '600',
    },
    emptyState: {
      margin: SPACING.lg,
      marginTop: SPACING.xl,
      padding: SPACING.xl,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cardBackground,
      alignItems: 'center',
      gap: SPACING.sm,
    },
    emptyTitle: {
      color: colors.textPrimary,
      fontSize: FONT_SIZES.lg,
      fontWeight: '700',
    },
    emptySubtitle: {
      color: colors.textSecondary,
      fontSize: FONT_SIZES.base,
      textAlign: 'center',
    },
    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.cardBackground,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0, 0, 0, 0.35)',
    },
    modalOverlayCentered: {
      flex: 1,
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.35)',
      paddingHorizontal: SPACING.lg,
    },
    modalCard: {
      maxHeight: '86%',
      backgroundColor: colors.cardBackground,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      paddingBottom: SPACING.xl,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      color: colors.textPrimary,
      fontSize: FONT_SIZES.xl,
      fontWeight: '700',
    },
    modalClose: {
      color: colors.textSecondary,
      fontSize: FONT_SIZES.lg,
      fontWeight: '700',
    },
    modalContent: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.lg,
      gap: SPACING.md,
    },
    sectionLabel: {
      color: colors.textSecondary,
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    selectedTemplateName: {
      color: colors.textPrimary,
      fontSize: FONT_SIZES.lg,
      fontWeight: '700',
      marginBottom: SPACING.sm,
    },
    optionList: {
      gap: SPACING.sm,
      marginBottom: SPACING.sm,
    },
    optionButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      backgroundColor: colors.background,
    },
    optionButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    optionButtonText: {
      color: colors.textSecondary,
      fontWeight: '600',
      fontSize: FONT_SIZES.base,
    },
    optionButtonTextActive: {
      color: colors.cardBackground,
    },
    previewButton: {
      backgroundColor: colors.info,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: SPACING.sm,
      marginTop: SPACING.xs,
    },
    previewButtonText: {
      color: colors.cardBackground,
      fontWeight: '700',
      fontSize: FONT_SIZES.base,
    },
    previewCard: {
      marginTop: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: SPACING.md,
      backgroundColor: colors.background,
      gap: SPACING.xs,
    },
    previewTitle: {
      color: colors.textPrimary,
      fontSize: FONT_SIZES.base,
      fontWeight: '700',
      marginBottom: SPACING.xs,
    },
    previewLine: {
      color: colors.textSecondary,
      fontSize: FONT_SIZES.sm,
    },
    confirmButton: {
      marginHorizontal: SPACING.lg,
      marginTop: SPACING.md,
      backgroundColor: colors.success,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: SPACING.md,
    },
    confirmButtonDisabled: {
      opacity: 0.5,
    },
    confirmButtonText: {
      color: colors.cardBackground,
      fontWeight: '700',
      fontSize: FONT_SIZES.base,
    },
    editModalCard: {
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: SPACING.lg,
      maxHeight: '92%',
      gap: SPACING.sm,
    },
    editTitle: {
      color: colors.textPrimary,
      fontSize: FONT_SIZES.lg,
      fontWeight: '700',
      marginBottom: SPACING.xs,
    },
    editLabel: {
      color: colors.textSecondary,
      fontSize: FONT_SIZES.sm,
      fontWeight: '600',
    },
    editInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      color: colors.textPrimary,
      backgroundColor: colors.background,
      fontSize: FONT_SIZES.base,
    },
    editActionsRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
      marginTop: SPACING.md,
    },
    groupSelectorRow: {
      gap: SPACING.sm,
      paddingBottom: SPACING.sm,
    },
    groupSelectorButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      backgroundColor: colors.background,
    },
    groupSelectorButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    groupSelectorText: {
      color: colors.textSecondary,
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
    },
    groupSelectorTextActive: {
      color: colors.cardBackground,
    },
    tasksEditorContainer: {
      maxHeight: 260,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.background,
    },
    tasksEditorContent: {
      padding: SPACING.sm,
      gap: SPACING.sm,
    },
    taskEditorCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: SPACING.sm,
      gap: SPACING.xs,
      backgroundColor: colors.cardBackground,
    },
    taskEditorHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    taskEditorTitle: {
      color: colors.textPrimary,
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
    },
    taskDeleteText: {
      color: colors.danger,
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
    },
    taskInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      color: colors.textPrimary,
      backgroundColor: colors.background,
      fontSize: FONT_SIZES.sm,
    },
    timeRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    timeInput: {
      flex: 1,
    },
    categoryInput: {
      flex: 1,
    },
    colorPreviewButton: {
      minWidth: 96,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      backgroundColor: colors.background,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xs,
    },
    colorSwatch: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    colorPreviewText: {
      color: colors.textPrimary,
      fontSize: FONT_SIZES.sm,
      fontWeight: '600',
    },
    colorPalette: {
      marginTop: SPACING.xs,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.xs,
    },
    paletteColorButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    paletteColorButtonActive: {
      borderColor: colors.textPrimary,
      borderWidth: 2,
    },
    paletteColorSwatch: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: colors.border,
    },
    addTaskButton: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: SPACING.sm,
    },
    addTaskButtonText: {
      color: colors.textPrimary,
      fontSize: FONT_SIZES.base,
      fontWeight: '700',
    },
    editSecondaryButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: SPACING.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    editSecondaryButtonText: {
      color: colors.textSecondary,
      fontSize: FONT_SIZES.base,
      fontWeight: '600',
    },
    editPrimaryButton: {
      flex: 1,
      borderRadius: 10,
      paddingVertical: SPACING.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    editPrimaryButtonText: {
      color: colors.cardBackground,
      fontSize: FONT_SIZES.base,
      fontWeight: '700',
    },
    deleteButton: {
      marginTop: SPACING.sm,
      borderRadius: 10,
      paddingVertical: SPACING.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.danger,
    },
    deleteButtonText: {
      color: colors.cardBackground,
      fontSize: FONT_SIZES.base,
      fontWeight: '700',
    },
    createButton: {
      backgroundColor: colors.success,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: SPACING.md,
    },
    createButtonText: {
      color: colors.cardBackground,
      fontSize: FONT_SIZES.lg,
      fontWeight: '700',
    },
  });
