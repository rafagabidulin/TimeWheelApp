// constants/theme.ts
import React, { createContext, useContext, useMemo, useState } from 'react';
import { Dimensions, useColorScheme } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================================================
// РАЗМЕРЫ ЦИФЕРБЛАТА
// ============================================================================

/** Радиус циферблата — 42% от ширины экрана для более крупного отображения */
export const CLOCK_RADIUS = SCREEN_WIDTH * 0.42;

/** Смещение циферблата вниз/вверх для балансировки с заголовком */
export const CLOCK_CENTER_OFFSET = -10;

/** SVG высота и ширина */
export const SVG_SIZE = Math.round(Math.max(320, CLOCK_RADIUS * 2 + 64));

/** Центр X координата циферблата */
export const CENTER_X = SVG_SIZE / 2;

/** Центр Y координата циферблата (с учётом смещения) */
export const CENTER_Y = SVG_SIZE / 2 + CLOCK_CENTER_OFFSET;

// ============================================================================
// УГЛЫ (В РАДИАНАХ И ГРАДУСАХ)
// ============================================================================

/** SVG координата угла 0° находится справа, поэтому вычитаем 90° для верхней позиции */
export const ANGLE_TOP = -90;

// ============================================================================
// ЦВЕТА
// ============================================================================

export const LIGHT_COLORS = {
  primary: '#3B82F6',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  error: '#EF4444',
  info: '#38BDF8',
  secondary: '#6366F1',
  gold: '#FBBF24',
  brown: '#A16207',

  // Фоны
  background: '#F5F7FA',
  cardBackground: '#FFFFFF',
  modalOverlay: 'rgba(0, 0, 0, 0.5)',

  // Текст
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textLight: '#D1D5DB',

  // Границы
  border: '#E5E7EB',
  borderLight: '#F3F4F6',

  // Специальные
  clockBorder: '#E5E7EB',
  currentDayHighlight: '#EFF6FF',
  currentDayBorder: '#3B82F6',
} as const;

export const DARK_COLORS = {
  primary: '#6366F1',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  error: '#EF4444',
  info: '#38BDF8',
  secondary: '#8B5CF6',
  gold: '#FBBF24',
  brown: '#A16207',

  // Фоны
  background: '#0B0F1A',
  cardBackground: '#111827',
  modalOverlay: 'rgba(0, 0, 0, 0.6)',

  // Текст
  textPrimary: '#E5E7EB',
  textSecondary: '#9CA3AF',
  textTertiary: '#6B7280',
  textLight: '#4B5563',

  // Границы
  border: '#1F2937',
  borderLight: '#111827',

  // Специальные
  clockBorder: '#374151',
  currentDayHighlight: '#111827',
  currentDayBorder: '#6366F1',
} as const;

export const COLORS = LIGHT_COLORS;

export type ThemeColors = typeof LIGHT_COLORS;

export function getColors(scheme: 'light' | 'dark' | null | undefined): ThemeColors {
  return scheme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
}

type ThemeMode = 'system' | 'light' | 'dark';

type ThemeContextValue = {
  colors: ThemeColors;
  scheme: 'light' | 'dark';
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [mode, setMode] = useState<ThemeMode>('system');

  const scheme = mode === 'system' ? systemScheme : mode;
  const colors = useMemo(() => getColors(scheme), [scheme]);

  const toggleTheme = () => {
    setMode((prev) => {
      if (prev === 'system') {
        return systemScheme === 'dark' ? 'light' : 'dark';
      }
      return prev === 'dark' ? 'light' : 'dark';
    });
  };

  const value = useMemo(
    () => ({
      colors,
      scheme,
      mode,
      setMode,
      toggleTheme,
    }),
    [colors, scheme, mode],
  );

  return React.createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme() {
  const context = useContext(ThemeContext);
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  if (!context) {
    return {
      colors: getColors(scheme),
      scheme,
      mode: 'system' as ThemeMode,
      setMode: () => {},
      toggleTheme: () => {},
    };
  }

  return context;
}

// ============================================================================
// КАТЕГОРИИ И ИХ ЦВЕТА
// ============================================================================

export const CATEGORY_COLORS: Record<string, string> = {
  work: '#22C55E',
  food: '#FBBF24',
  sports: '#EF4444',
  study: '#6366F1',
  home: '#A16207',
  leisure: '#38BDF8',
  custom: '#3B82F6',
};

export const CATEGORY_OPTIONS = ['work', 'food', 'sports', 'study', 'home', 'leisure', 'custom'] as const;

export const COLOR_OPTIONS = [
  CATEGORY_COLORS.work,
  CATEGORY_COLORS.food,
  CATEGORY_COLORS.custom,
  CATEGORY_COLORS.sports,
  CATEGORY_COLORS.leisure,
  CATEGORY_COLORS.home,
  CATEGORY_COLORS.study,
  COLORS.warning,
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
  { id: 'monday' },
  { id: 'tuesday' },
  { id: 'wednesday' },
  { id: 'thursday' },
  { id: 'friday' },
  { id: 'saturday' },
  { id: 'sunday' },
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
