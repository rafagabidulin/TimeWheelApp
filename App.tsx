import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  AppState,
  AppStateStatus,
  PanResponder,
  Animated,
} from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CLOCK_RADIUS = SCREEN_WIDTH * 0.35;
const CENTER_X = SCREEN_WIDTH / 2;
const CENTER_Y = SCREEN_WIDTH / 2 + 50;

interface Task {
  id: string;
  dayId: string;
  title: string;
  startTime: string;
  endTime: string;
  category: string;
  color: string;
}

interface Day {
  id: string;
  name: string;
  tasks: Task[];
}

interface FormData {
  title: string;
  startTime: string;
  endTime: string;
  color: string;
  category: string;
}

const mockDays: Day[] = [
  {
    id: 'monday',
    name: 'Пн',
    tasks: [
      {
        id: '1',
        dayId: 'monday',
        title: 'Завтрак',
        startTime: '08:00',
        endTime: '08:30',
        category: 'food',
        color: '#FFC107',
      },
      {
        id: '2',
        dayId: 'monday',
        title: 'Работа',
        startTime: '09:00',
        endTime: '13:00',
        category: 'work',
        color: '#4CAF50',
      },
      {
        id: '3',
        dayId: 'monday',
        title: 'Обед',
        startTime: '13:00',
        endTime: '14:00',
        category: 'food',
        color: '#FFC107',
      },
      {
        id: '4',
        dayId: 'monday',
        title: 'Проект',
        startTime: '14:00',
        endTime: '18:00',
        category: 'work',
        color: '#FF9800',
      },
      {
        id: '5',
        dayId: 'monday',
        title: 'Тренировка',
        startTime: '19:00',
        endTime: '20:00',
        category: 'sports',
        color: '#E91E63',
      },
    ],
  },
  {
    id: 'tuesday',
    name: 'Вт',
    tasks: [
      {
        id: '6',
        dayId: 'tuesday',
        title: 'Встреча',
        startTime: '10:00',
        endTime: '11:30',
        category: 'work',
        color: '#2196F3',
      },
      {
        id: '7',
        dayId: 'tuesday',
        title: 'Учёба',
        startTime: '12:00',
        endTime: '15:00',
        category: 'study',
        color: '#9C27B0',
      },
    ],
  },
  {
    id: 'wednesday',
    name: 'Ср',
    tasks: [
      {
        id: '8',
        dayId: 'wednesday',
        title: 'Работа',
        startTime: '08:00',
        endTime: '17:00',
        category: 'work',
        color: '#4CAF50',
      },
    ],
  },
  { id: 'thursday', name: 'Чт', tasks: [] },
  {
    id: 'friday',
    name: 'Пт',
    tasks: [
      {
        id: '9',
        dayId: 'friday',
        title: 'Презентация',
        startTime: '14:00',
        endTime: '16:00',
        category: 'work',
        color: '#F44336',
      },
    ],
  },
  {
    id: 'saturday',
    name: 'Сб',
    tasks: [
      {
        id: '10',
        dayId: 'saturday',
        title: 'Хозяйство',
        startTime: '10:00',
        endTime: '13:00',
        category: 'home',
        color: '#795548',
      },
      {
        id: '11',
        dayId: 'saturday',
        title: 'Друзья',
        startTime: '18:00',
        endTime: '22:00',
        category: 'leisure',
        color: '#00BCD4',
      },
    ],
  },
  {
    id: 'sunday',
    name: 'Вс',
    tasks: [
      {
        id: '12',
        dayId: 'sunday',
        title: 'Отдых',
        startTime: '00:00',
        endTime: '23:59',
        category: 'leisure',
        color: '#9C27B0',
      },
    ],
  },
];

const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function timeToHours(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h + m / 60;
}

function isValidTime(time: string): boolean {
  return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
}

function isValidTimeRange(startTime: string, endTime: string): boolean {
  if (!isValidTime(startTime) || !isValidTime(endTime)) return false;
  const start = timeToHours(startTime);
  const end = timeToHours(endTime);
  return start !== end;
}

function getAngle(hours: number): number {
  return (hours / 24) * 360;
}

function getPathData(startHours: number, endHours: number): string {
  const startAngle = getAngle(startHours);
  const endAngle = getAngle(endHours);
  const startRad = (startAngle - 90) * (Math.PI / 180);
  const endRad = (endAngle - 90) * (Math.PI / 180);

  const x1 = CENTER_X + CLOCK_RADIUS * Math.cos(startRad);
  const y1 = CENTER_Y + CLOCK_RADIUS * Math.sin(startRad);
  const x2 = CENTER_X + CLOCK_RADIUS * Math.cos(endRad);
  const y2 = CENTER_Y + CLOCK_RADIUS * Math.sin(endRad);

  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${CENTER_X} ${CENTER_Y} L ${x1} ${y1} A ${CLOCK_RADIUS} ${CLOCK_RADIUS} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

function getCurrentDayId(): string {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return daysOfWeek[adjustedDay];
}

// ============================================================================
// TIME PICKER
// ============================================================================

interface InlineTimePickerProps {
  time: string;
  onTimeChange: (time: string) => void;
  label: string;
}

function InlineTimePicker({ time, onTimeChange, label }: InlineTimePickerProps) {
  const [h, m] = time.split(':').map(Number);
  const [selectedHour, setSelectedHour] = useState(h);
  const [selectedMinute, setSelectedMinute] = useState(m);
  const prevTimeRef = useRef(time);

  useEffect(() => {
    if (time !== prevTimeRef.current) {
      const [newH, newM] = time.split(':').map(Number);
      setSelectedHour(newH);
      setSelectedMinute(newM);
      prevTimeRef.current = time;
    }
  }, [time]);

  useEffect(() => {
    const newTime = `${String(selectedHour).padStart(2, '0')}:${String(selectedMinute).padStart(
      2,
      '0',
    )}`;
    if (newTime !== prevTimeRef.current) {
      onTimeChange(newTime);
      prevTimeRef.current = newTime;
    }
  }, [selectedHour, selectedMinute, onTimeChange]);

  return (
    <View style={styles.inlineTimePickerContainer}>
      <Text style={styles.inlineTimePickerLabel}>{label}</Text>
      <View style={styles.inlineTimePickerContent}>
        <View style={styles.inlineTimePickerColumn}>
          <Text style={styles.inlineTimePickerColumnLabel}>Часы</Text>
          <ScrollView
            style={styles.inlineTimePickerScroll}
            showsVerticalScrollIndicator={true}
            scrollEventThrottle={16}>
            {Array.from({ length: 24 }, (_, i) => (
              <TouchableOpacity
                key={`h-${i}`}
                style={[
                  styles.inlineTimePickerItem,
                  selectedHour === i && styles.inlineTimePickerItemSelected,
                ]}
                onPress={() => setSelectedHour(i)}>
                <Text
                  style={[
                    styles.inlineTimePickerItemText,
                    selectedHour === i && styles.inlineTimePickerItemTextSelected,
                  ]}>
                  {String(i).padStart(2, '0')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <Text style={styles.inlineTimePickerSeparator}>:</Text>

        <View style={styles.inlineTimePickerColumn}>
          <Text style={styles.inlineTimePickerColumnLabel}>Минуты</Text>
          <ScrollView
            style={styles.inlineTimePickerScroll}
            showsVerticalScrollIndicator={true}
            scrollEventThrottle={16}>
            {Array.from({ length: 60 }, (_, i) => (
              <TouchableOpacity
                key={`m-${i}`}
                style={[
                  styles.inlineTimePickerItem,
                  selectedMinute === i && styles.inlineTimePickerItemSelected,
                ]}
                onPress={() => setSelectedMinute(i)}>
                <Text
                  style={[
                    styles.inlineTimePickerItemText,
                    selectedMinute === i && styles.inlineTimePickerItemTextSelected,
                  ]}>
                  {String(i).padStart(2, '0')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// SWIPE-ENABLED MODAL CONTENT
// ============================================================================

interface SwipeableModalContentProps {
  visible: boolean;
  onClose: () => void;
  onAdd: () => Promise<void>;
  onUpdate: () => Promise<void>;
  editingTaskId: string | null;
  currentDay: Day;
  formData: FormData;
  setFormData: (data: FormData) => void;
  colorOptions: string[];
  categoryOptions: string[];
}

function SwipeableModalContent({
  visible,
  onClose,
  onAdd,
  onUpdate,
  editingTaskId,
  currentDay,
  formData,
  setFormData,
  colorOptions,
  categoryOptions,
}: SwipeableModalContentProps) {
  const translateYRef = useRef(new Animated.Value(0)).current;
  const panResponderRef = useRef<any>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (visible) {
      translateYRef.setValue(0);
    }
  }, [visible, translateYRef]);

  if (!panResponderRef.current) {
    panResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        return evt.nativeEvent.pageY < 100;
      },
      onMoveShouldSetPanResponder: (evt, { dy }) => {
        return Math.abs(dy) > 5 && dy > 0;
      },
      onPanResponderMove: (evt, { dy }) => {
        if (dy > 0) {
          translateYRef.setValue(dy);
        }
      },
      onPanResponderRelease: (evt, { dy, vy }) => {
        if (dy > 100 || vy > 0.7) {
          Animated.timing(translateYRef, {
            toValue: SCREEN_HEIGHT,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onCloseRef.current();
          });
        } else {
          Animated.spring(translateYRef, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalOverlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        />

        <Animated.View
          style={[
            styles.modalContent,
            {
              transform: [{ translateY: translateYRef }],
            },
          ]}
          {...panResponderRef.current.panHandlers}>
          <View style={styles.swipeIndicator} />

          <ScrollView showsVerticalScrollIndicator={true} scrollEventThrottle={16}>
            <Text style={styles.modalTitle}>
              {editingTaskId ? 'Редактировать задачу' : 'Добавить задачу'}
            </Text>
            <Text style={styles.modalSubtitle}>День: {currentDay.name}</Text>

            <Text style={styles.formLabel}>Название</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Введите название"
              value={formData.title}
              onChangeText={(text) => setFormData({ ...formData, title: text })}
              placeholderTextColor="#CCC"
            />

            <InlineTimePicker
              time={formData.startTime}
              onTimeChange={(time) => setFormData({ ...formData, startTime: time })}
              label="Время начала"
            />

            <InlineTimePicker
              time={formData.endTime}
              onTimeChange={(time) => setFormData({ ...formData, endTime: time })}
              label="Время окончания"
            />

            <Text style={styles.formLabel}>Категория</Text>
            <View style={styles.categoryGrid}>
              {categoryOptions.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryOption,
                    formData.category === cat && styles.categoryOptionSelected,
                  ]}
                  onPress={() => setFormData({ ...formData, category: cat })}>
                  <Text
                    style={[
                      styles.categoryOptionText,
                      formData.category === cat && styles.categoryOptionTextSelected,
                    ]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.formLabel}>Цвет</Text>
            <View style={styles.colorGrid}>
              {colorOptions.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    formData.color === color && styles.colorOptionSelected,
                  ]}
                  onPress={() => setFormData({ ...formData, color })}
                />
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={onClose}>
                <Text style={styles.cancelButtonText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={editingTaskId ? onUpdate : onAdd}>
                <Text style={styles.saveButtonText}>
                  {editingTaskId ? 'Сохранить изменения' : 'Добавить'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ============================================================================
// MAIN APP
// ============================================================================

export default function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedDayId, setSelectedDayId] = useState(getCurrentDayId());
  const [days, setDays] = useState<Day[]>(mockDays);
  const [appState, setAppState] = useState<AppStateStatus>('active');

  const [modalVisible, setModalVisible] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    title: '',
    startTime: '09:00',
    endTime: '10:00',
    color: '#4CAF50',
    category: 'custom',
  });

  const appStateSubscription = useRef<any>(null);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setEditingTaskId(null);
    setFormData({
      title: '',
      startTime: '09:00',
      endTime: '10:00',
      color: '#4CAF50',
      category: 'custom',
    });
  }, []);

  const handleAddTask = useCallback(async () => {
    if (!formData.title.trim()) {
      Alert.alert('Ошибка', 'Введите название задачи');
      return;
    }

    if (!isValidTimeRange(formData.startTime, formData.endTime)) {
      Alert.alert('Ошибка', 'Введите корректное время');
      return;
    }

    const newTask: Task = {
      id: Date.now().toString(),
      dayId: selectedDayId,
      title: formData.title,
      startTime: formData.startTime,
      endTime: formData.endTime,
      category: formData.category,
      color: formData.color,
    };

    const updatedDays = days.map((day) => {
      if (day.id === selectedDayId) {
        return { ...day, tasks: [...day.tasks, newTask] };
      }
      return day;
    });

    setDays(updatedDays);
    await saveDaysToStorage(updatedDays);
    closeModal();
  }, [formData, selectedDayId, days, closeModal]);

  const handleEditTask = useCallback((task: Task) => {
    setFormData({
      title: task.title,
      startTime: task.startTime,
      endTime: task.endTime,
      color: task.color,
      category: task.category,
    });
    setEditingTaskId(task.id);
    setModalVisible(true);
  }, []);

  const handleSaveEditedTask = useCallback(async () => {
    if (!formData.title.trim()) {
      Alert.alert('Ошибка', 'Введите название задачи');
      return;
    }

    if (!isValidTimeRange(formData.startTime, formData.endTime)) {
      Alert.alert('Ошибка', 'Введите корректное время');
      return;
    }

    const updatedDays = days.map((day) => {
      return {
        ...day,
        tasks: day.tasks.map((task) => {
          if (task.id === editingTaskId) {
            return {
              ...task,
              title: formData.title,
              startTime: formData.startTime,
              endTime: formData.endTime,
              color: formData.color,
              category: formData.category,
            };
          }
          return task;
        }),
      };
    });

    setDays(updatedDays);
    await saveDaysToStorage(updatedDays);
    closeModal();
  }, [formData, editingTaskId, days, closeModal]);

  const handleDeleteTask = useCallback(
    (taskId: string) => {
      Alert.alert('Удалить задачу?', 'Это действие невозможно отменить', [
        { text: 'Отмена', onPress: () => {}, style: 'cancel' },
        {
          text: 'Удалить',
          onPress: async () => {
            const updatedDays = days.map((day) => {
              return {
                ...day,
                tasks: day.tasks.filter((task) => task.id !== taskId),
              };
            });
            setDays(updatedDays);
            await saveDaysToStorage(updatedDays);
          },
          style: 'destructive',
        },
      ]);
    },
    [days],
  );

  useEffect(() => {
    loadDaysFromStorage();
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      setAppState(nextAppState);
    };

    appStateSubscription.current = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      appStateSubscription.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (appState !== 'active') return;

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, [appState]);

  const loadDaysFromStorage = async () => {
    try {
      const stored = await AsyncStorage.getItem('@timewheel:days');
      if (stored) {
        setDays(JSON.parse(stored));
      } else {
        setDays(mockDays);
        await saveDaysToStorage(mockDays);
      }
    } catch (error) {
      console.error('Storage load error:', error);
      setDays(mockDays);
    }
  };

  const saveDaysToStorage = async (daysToSave: Day[]) => {
    try {
      await AsyncStorage.setItem('@timewheel:days', JSON.stringify(daysToSave));
    } catch (error) {
      console.error('Storage save error:', error);
    }
  };

  const colorOptions = [
    '#4CAF50',
    '#FF9800',
    '#2196F3',
    '#E91E63',
    '#FFC107',
    '#795548',
    '#00BCD4',
    '#9C27B0',
  ];
  const categoryOptions = ['work', 'food', 'sports', 'study', 'home', 'leisure', 'custom'];

  const hours = currentTime.getHours();
  const minutes = currentTime.getMinutes();
  const seconds = currentTime.getSeconds();
  const totalHours = hours + minutes / 60 + seconds / 3600;

  const currentDayId = getCurrentDayId();
  const isCurrentDay = selectedDayId === currentDayId;

  const { tasks, currentTask, nextTask, loadPercent } = useMemo(() => {
    const currentDay = days.find((d) => d.id === selectedDayId) || days[0];
    const sortedTasks = [...currentDay.tasks].sort(
      (a, b) => timeToHours(a.startTime) - timeToHours(b.startTime),
    );

    const current = sortedTasks.find((t) => {
      const start = timeToHours(t.startTime);
      const end = timeToHours(t.endTime);
      if (start > end) {
        return totalHours >= start || totalHours < end;
      }
      return totalHours >= start && totalHours < end;
    });

    const next = sortedTasks.find((t) => {
      const end = timeToHours(t.endTime);
      return end > totalHours;
    });

    const totalMin = sortedTasks.reduce((acc, task) => {
      const start = timeToHours(task.startTime);
      const end = timeToHours(task.endTime);
      return acc + (end - start) * 60;
    }, 0);

    return {
      tasks: sortedTasks,
      currentTask: isCurrentDay ? current : undefined,
      nextTask: isCurrentDay ? next : undefined,
      loadPercent: Math.round((totalMin / (24 * 60)) * 100),
    };
  }, [days, selectedDayId, totalHours, isCurrentDay]);

  const totalAngle = isCurrentDay ? getAngle(totalHours) : 0;
  const angleRad = (totalAngle - 90) * (Math.PI / 180);

  const currentDay = days.find((d) => d.id === selectedDayId) || days[0];

  const selectedDate = useMemo(() => {
    const date = new Date();
    const dayIndex = days.findIndex((d) => d.id === selectedDayId);
    const today = new Date();
    const currentDayIndex = daysOfWeek.indexOf(currentDayId);
    const dayDifference = dayIndex - currentDayIndex;
    date.setDate(today.getDate() + dayDifference);
    return date;
  }, [selectedDayId, days, currentDayId]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.weekSelector}>
        {days.map((day) => (
          <TouchableOpacity
            key={day.id}
            style={[styles.dayChip, selectedDayId === day.id && styles.selectedDayChip]}
            onPress={() => setSelectedDayId(day.id)}>
            <Text style={selectedDayId === day.id ? styles.selectedDayText : styles.dayText}>
              {day.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.title}>TimeWheel</Text>

      <View style={styles.clockContainer}>
        <Svg height="400" width="400" style={styles.svg}>
          <Circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r={CLOCK_RADIUS}
            fill="none"
            stroke="#E0E0E0"
            strokeWidth="4"
          />

          {Array.from({ length: 24 }, (_, i) => {
            const angle = (i / 24) * 360 - 90;
            const rad = angle * (Math.PI / 180);
            const x = CENTER_X + (CLOCK_RADIUS - 35) * Math.cos(rad);
            const y = CENTER_Y + (CLOCK_RADIUS - 35) * Math.sin(rad);
            return (
              <SvgText
                key={`hour-${i}`}
                x={x}
                y={y}
                textAnchor="middle"
                fontSize="13"
                fontWeight="bold"
                fill="#333">
                {String(i).padStart(2, '0')}
              </SvgText>
            );
          })}

          {tasks.map((task) => {
            const startHours = timeToHours(task.startTime);
            let endHours = timeToHours(task.endTime);

            if (startHours > endHours) {
              endHours += 24;
            }

            const pathData = getPathData(startHours, endHours);
            const isCurrentTask = isCurrentDay && task.id === currentTask?.id;

            const midHours = (startHours + endHours) / 2;
            const midAngle = getAngle(midHours);
            const midRad = (midAngle - 90) * (Math.PI / 180);
            const textRadius = CLOCK_RADIUS * 0.65;
            const textX = CENTER_X + textRadius * Math.cos(midRad);
            const textY = CENTER_Y + textRadius * Math.sin(midRad);

            return (
              <React.Fragment key={task.id}>
                <Path
                  d={pathData}
                  fill={task.color}
                  opacity={isCurrentTask ? '0.9' : '0.6'}
                  strokeWidth={isCurrentTask ? '2' : '0'}
                  stroke={isCurrentTask ? '#333' : 'transparent'}
                />
                <SvgText
                  x={textX}
                  y={textY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={isCurrentTask ? '12' : '11'}
                  fontWeight={isCurrentTask ? '700' : '600'}
                  fill="#FFF"
                  opacity={isCurrentTask ? '1' : '0.85'}>
                  {task.title}
                </SvgText>
              </React.Fragment>
            );
          })}

          {isCurrentDay && (
            <Path
              d={`M ${CENTER_X} ${CENTER_Y} L ${
                CENTER_X + (CLOCK_RADIUS - 20) * Math.cos(angleRad)
              } ${CENTER_Y + (CLOCK_RADIUS - 20) * Math.sin(angleRad)}`}
              stroke="#2196F3"
              strokeWidth="4"
              strokeLinecap="round"
            />
          )}

          <Circle cx={CENTER_X} cy={CENTER_Y} r="45" fill="#FFF" stroke="#E0E0E0" strokeWidth="2" />

          <SvgText
            x={CENTER_X}
            y={CENTER_Y - 8}
            textAnchor="middle"
            fontSize="18"
            fontWeight="bold"
            fill="#333">
            {isCurrentDay
              ? currentTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
              : '--:--'}
          </SvgText>

          <SvgText
            x={CENTER_X}
            y={CENTER_Y + 12}
            textAnchor="middle"
            fontSize="12"
            fontWeight="bold"
            fill="#666">
            {`${currentDay.name} ${String(selectedDate.getDate()).padStart(2, '0')}`}
          </SvgText>
        </Svg>
      </View>

      <View style={styles.taskListContainer}>
        {tasks.length > 0 ? (
          tasks.map((task) => {
            const isCurrentTask = isCurrentDay && task.id === currentTask?.id;

            return (
              <View key={task.id}>
                <TouchableOpacity
                  style={[styles.taskItem, isCurrentTask && styles.taskItemCurrent]}
                  onPress={() => handleEditTask(task)}
                  onLongPress={() => handleDeleteTask(task.id)}>
                  <View style={[styles.taskColorBar, { backgroundColor: task.color }]} />
                  <View style={styles.taskInfo}>
                    <Text style={[styles.taskTitle, isCurrentTask && styles.taskTitleCurrent]}>
                      {isCurrentTask ? '▶ ' : ''}
                      {task.title}
                    </Text>
                    <Text style={styles.taskTime}>
                      {task.startTime} – {task.endTime}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.taskDeleteButton}
                    onPress={() => handleDeleteTask(task.id)}>
                    <Text style={styles.taskDeleteIcon}>✕</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              </View>
            );
          })
        ) : (
          <Text style={styles.noTasks}>Нет задач на этот день</Text>
        )}
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
          <Text style={styles.addButtonText}>+ Добавить задачу</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.templateButton}>
          <Text style={styles.templateButtonText}>Шаблоны ▼</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.stats}>
        <Text style={styles.statsText}>Загрузка: {loadPercent}%</Text>
        {isCurrentDay ? (
          nextTask ? (
            <Text style={styles.nextTask}>
              ⏰ Следующая: {nextTask.title} {nextTask.startTime}
            </Text>
          ) : (
            <Text style={styles.nextTask}>⏰ Все задачи завершены</Text>
          )
        ) : (
          <Text style={styles.nextTask}>📅 Смотрите план на этот день</Text>
        )}
      </View>

      <SwipeableModalContent
        visible={modalVisible}
        onClose={closeModal}
        onAdd={handleAddTask}
        onUpdate={handleSaveEditedTask}
        editingTaskId={editingTaskId}
        currentDay={currentDay}
        formData={formData}
        setFormData={setFormData}
        colorOptions={colorOptions}
        categoryOptions={categoryOptions}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  contentContainer: { alignItems: 'center', paddingTop: 50, paddingBottom: 20 },

  weekSelector: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 10 },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 4,
    backgroundColor: 'white',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  selectedDayChip: { backgroundColor: '#2196F3', borderColor: '#2196F3' },
  dayText: { fontSize: 14, color: '#666' },
  selectedDayText: { fontSize: 14, color: 'white', fontWeight: 'bold' },

  title: { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 2 },
  clockContainer: { alignItems: 'center', marginBottom: 8, marginTop: -60 },
  svg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  taskListContainer: {
    width: '90%',
    marginBottom: 15,
    backgroundColor: 'white',
    borderRadius: 10,
    paddingVertical: 10,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  taskItemCurrent: { backgroundColor: '#F0F7FF', borderLeftWidth: 3, borderLeftColor: '#2196F3' },
  taskColorBar: { width: 4, height: 40, borderRadius: 2, marginRight: 12 },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: 14, fontWeight: '600', color: '#333' },
  taskTitleCurrent: { color: '#2196F3', fontWeight: '700' },
  taskTime: { fontSize: 12, color: '#999', marginTop: 2 },
  noTasks: { fontSize: 14, color: '#999', textAlign: 'center', paddingVertical: 20 },

  bottomBar: {
    flexDirection: 'row',
    width: '90%',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  addButtonText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  templateButton: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  templateButtonText: { color: '#666', fontWeight: '500', fontSize: 14 },

  stats: { alignItems: 'center' },
  statsText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  nextTask: { fontSize: 14, color: '#666', marginTop: 5 },

  taskDeleteButton: { padding: 8 },
  taskDeleteIcon: { fontSize: 16, color: '#E91E63' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalOverlayTouchable: { flex: 1, width: '100%' },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  modalSubtitle: { fontSize: 14, color: '#999', marginBottom: 20 },

  formLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 15, marginBottom: 8 },
  textInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#F9F9F9',
  },

  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, marginBottom: 15 },
  categoryOption: {
    width: '30%',
    paddingVertical: 8,
    marginRight: '3%',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    alignItems: 'center',
  },
  categoryOptionSelected: { borderColor: '#2196F3', borderWidth: 2, backgroundColor: '#E3F2FD' },
  categoryOptionText: { fontSize: 12, color: '#666' },
  categoryOptionTextSelected: { color: '#2196F3', fontWeight: '600' },

  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, marginBottom: 5 },
  colorOption: {
    width: '28%',
    height: 30,
    borderRadius: 12,
    margin: '2%',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: { borderColor: '#333', borderWidth: 3 },

  modalButtons: {
    flexDirection: 'row',
    marginTop: 15,
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: { backgroundColor: '#F0F0F0' },
  cancelButtonText: { color: '#666', fontWeight: '600', fontSize: 14 },
  saveButton: { backgroundColor: '#4CAF50' },
  saveButtonText: { color: 'white', fontWeight: '600', fontSize: 14 },

  inlineTimePickerContainer: { marginTop: 15, marginBottom: 15 },
  inlineTimePickerLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 10 },
  inlineTimePickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 10,
    height: 200,
  },
  inlineTimePickerColumn: { flex: 1, alignItems: 'center' },
  inlineTimePickerColumnLabel: { fontSize: 12, fontWeight: '600', color: '#999', marginBottom: 8 },
  inlineTimePickerScroll: { height: 150, width: '100%' },
  inlineTimePickerItem: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 3,
    borderRadius: 6,
  },
  inlineTimePickerItemSelected: { backgroundColor: '#2196F3' },
  inlineTimePickerItemText: { fontSize: 18, fontWeight: '500', color: '#666' },
  inlineTimePickerItemTextSelected: { color: 'white', fontWeight: '700' },
  inlineTimePickerSeparator: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    alignSelf: 'center',
  },

  swipeIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#CCC',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
});
