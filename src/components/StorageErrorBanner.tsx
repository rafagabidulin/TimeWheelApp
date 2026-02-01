// components/StorageErrorBanner.tsx
import React, { useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { SPACING, FONT_SIZES, SIZES, useTheme } from '../constants/theme';

interface StorageErrorBannerProps {
  message: string;
  onDismiss: () => void;
}

/**
 * Компонент уведомления об ошибке хранилища
 * Показывается в случае проблем с AsyncStorage
 */
export default function StorageErrorBanner({
  message,
  onDismiss,
}: StorageErrorBannerProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
      <TouchableOpacity style={styles.closeButton} onPress={onDismiss}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (
  colors: ReturnType<typeof useTheme>['colors'],
  scheme: ReturnType<typeof useTheme>['scheme'],
) =>
  StyleSheet.create({
  container: {
    width: '90%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: scheme === 'dark' ? '#2B1F10' : '#FFF3CD',
    borderRadius: SIZES.borderRadius,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.md,
  },
  icon: {
    fontSize: FONT_SIZES.lg,
  },
  message: {
    fontSize: FONT_SIZES.sm,
    color: scheme === 'dark' ? '#FCD34D' : '#856404',
    flex: 1,
    flexWrap: 'wrap',
  },
  closeButton: {
    padding: SPACING.sm,
  },
  closeText: {
    fontSize: FONT_SIZES.base,
    color: scheme === 'dark' ? '#FCD34D' : '#856404',
    fontWeight: 'bold',
  },
});
