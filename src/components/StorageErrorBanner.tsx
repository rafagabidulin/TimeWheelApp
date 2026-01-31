// components/StorageErrorBanner.tsx
import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, SIZES } from '../constants/theme';

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

const styles = StyleSheet.create({
  container: {
    width: '90%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF3CD',
    borderRadius: SIZES.borderRadius,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.lg,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
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
    color: '#856404',
    flex: 1,
    flexWrap: 'wrap',
  },
  closeButton: {
    padding: SPACING.sm,
  },
  closeText: {
    fontSize: FONT_SIZES.base,
    color: '#856404',
    fontWeight: 'bold',
  },
});
