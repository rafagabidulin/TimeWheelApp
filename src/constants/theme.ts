// constants/theme.ts
import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================================================
// РАЗМЕРЫ ЦИФЕРБЛАТА
// ============================================================================

/** Радиус циферблата — 35% от ширины экрана для оптимального отображения */
export const CLOCK_RADIUS = SCREEN_WIDTH * 0.35;

/** Смещение циферблата вниз для балансировки с заголовком */
export const CLOCK_CENTER_OFFSET = 0;

/** Центр X координата циферблата */
export const CENTER_X = SCREEN_WIDTH / 2;

/** Центр Y координата циферблата (с учётом смещения) */
export const CENTER_Y = SCREEN_WIDTH / 2 + CLOCK_CENTER_OFFSET;

/** SVG высота и ширина */
export const SVG_SIZE = 400;

// ============================================================================
// УГЛЫ (В РАДИАНАХ И ГРАДУСАХ)
// ============================================================================

/** SVG координата угла 0° находится справа, поэтому вычитаем 90° для верхней позиции */
export const ANGLE_TOP = -90;

// ============================================================================
// ЦВЕТА
// ============================================================================

export const COLORS = {
  primary: '#2196F3',
  success: '#4CAF50',
  warning: '#FF9800',
  danger: '#F44336',
  error: '#E91E63',
  info: '#00BCD4',
  secondary: '#9C27B0',
  gold: '#FFC107',
  brown: '#795548',

  // Фоны
  background: '#F5F5F5',
  cardBackground: '#FFFFFF',
  modalOverlay: 'rgba(0, 0, 0, 0.5)',

  // Текст
  textPrimary: '#333333',
  textSecondary: '#666666',
  textTertiary: '#999999',
  textLight: '#CCCCCC',

  // Границы
  border: '#DDDDDD',
  borderLight: '#F0F0F0',

  // Специальные
  clockBorder: '#E0E0E0',
  currentDayHighlight: '#F0F7FF',
  currentDayBorder: '#2196F3',
} as const;

// ============================================================================
// КАТЕГОРИИ И ИХ ЦВЕТА
// ============================================================================

export const CATEGORY_COLORS: Record<string, string> = {
  work: COLORS.success,
  food: COLORS.gold,
  sports: COLORS.error,
  study: COLORS.secondary,
  home: COLORS.brown,
  leisure: COLORS.info,
  custom: COLORS.primary,
};

export const CATEGORY_OPTIONS = ['work', 'food', 'sports', 'study', 'home', 'leisure', 'custom'] as const;

export const COLOR_OPTIONS = [
  COLORS.success,
  COLORS.warning,
  COLORS.primary,
  COLORS.error,
  COLORS.gold,
  COLORS.brown,
  COLORS.info,
  COLORS.secondary,
] as const;

// ============================================================================
// РАЗМЕРЫ И ОТСТУПЫ
// ============================================================================

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const SIZES = {
  borderRadius: 8,
  borderRadiusLarge: 12,
  borderRadiusExtraLarge: 20,
  shadowRadius: 4,
} as const;

export const FONT_SIZES = {
  xs: 12,
  sm: 13,
  base: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  xxxl: 28,
} as const;

// ============================================================================
// ДНИ НЕДЕЛИ
// ============================================================================

export const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export const DAYS_DATA = [
  { id: 'monday', name: 'Пн' },
  { id: 'tuesday', name: 'Вт' },
  { id: 'wednesday', name: 'Ср' },
  { id: 'thursday', name: 'Чт' },
  { id: 'friday', name: 'Пт' },
  { id: 'saturday', name: 'Сб' },
  { id: 'sunday', name: 'Вс' },
] as const;

// ============================================================================
// ЭКРАН
// ============================================================================

export const SCREEN = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
} as const;

// ============================================================================
// ASYNCSTORAGE КЛЮЧИ
// ============================================================================

export const STORAGE_KEYS = {
  days: '@timewheel:days',
  lastSync: '@timewheel:lastSync',
} as const;

// ============================================================================
// ВРЕМЯ
// ============================================================================

/** Интервал обновления текущего времени (в миллисекундах) */
export const TIME_UPDATE_INTERVAL = 1000;

/** Время отсутствия приложения перед показом refresh */
export const APP_INACTIVE_THRESHOLD = 5000;
