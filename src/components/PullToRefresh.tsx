// components/PullToRefresh.tsx
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, PanResponder, RefreshControl } from 'react-native';
import { COLORS, SPACING, FONT_SIZES } from '../constants/theme';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  refreshing?: boolean;
}

/**
 * Pull-to-Refresh компонент с нативным iOS стилем
 * Срабатывает при свайпе сверху вниз
 */
export default function PullToRefresh({
  onRefresh,
  children,
  refreshing: externalRefreshing = false,
}: PullToRefreshProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const panResponderRef = useRef<any>(null);
  const scrollOffsetRef = useRef(0);

  // Создаём PanResponder для обработки жестов
  if (!panResponderRef.current) {
    panResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => scrollOffsetRef.current === 0,
      onMoveShouldSetPanResponder: (evt, { dy }) => dy > 0 && scrollOffsetRef.current === 0,
      onPanResponderMove: (evt, { dy }) => {
        if (dy > 0 && scrollOffsetRef.current === 0) {
          setPullDistance(dy);
        }
      },
      onPanResponderRelease: (evt, { dy }) => {
        if (dy > 80 && scrollOffsetRef.current === 0) {
          // Trigger refresh
          handleRefresh();
        }
        setPullDistance(0);
      },
    });
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error('[PullToRefresh] Error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const refreshIndicatorRotation = pullDistance > 0 ? (pullDistance / 5) % 360 : 0;

  return (
    <View
      style={styles.container}
      {...(panResponderRef.current?.panHandlers || {})}>
      {/* ИНДИКАТОР REFRESH */}
      {(refreshing || pullDistance > 0) && (
        <Animated.View
          style={[
            styles.refreshIndicator,
            {
              opacity: Math.min(pullDistance / 80, 1),
            },
          ]}>
          <Text style={styles.refreshText}>
            {refreshing ? '⟳ Синхронизация...' : `⬇ Потяни для обновления (${pullDistance.toFixed(0)}px)`}
          </Text>
        </Animated.View>
      )}

      {/* КОНТЕНТ */}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  refreshIndicator: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  refreshText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
});
