// components/ClockView.tsx
import React, { useMemo } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { Task, Day } from '../types/types';
import { getAngle, getAngleRadians, getPathData, timeToHours } from '../utils/timeUtils';
import {
  CLOCK_RADIUS,
  CENTER_X,
  CENTER_Y,
  SVG_SIZE,
  COLORS,
  SPACING,
  FONT_SIZES,
  ANGLE_TOP,
} from '../constants/theme';

interface ClockViewProps {
  currentTime: Date;
  selectedDate: Date;
  currentDay: Day;
  isCurrentDay: boolean;
  tasks: Task[];
  onTaskPress: (taskId: string) => void;
}

/**
 * Компонент визуализации циферблата с расписанием задач
 *
 * ОПТИМИЗАЦИЯ:
 * - useMemo для расчёта координат текста задач
 * - Отдельный Path для текущей стрелки времени
 * - Минимальное количество вычислений в рендере
 */
export default function ClockView({
  currentTime,
  selectedDate,
  currentDay,
  isCurrentDay,
  tasks,
  onTaskPress,
}: ClockViewProps) {
  const currentHours = useMemo(() => {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const seconds = currentTime.getSeconds();
    return hours + minutes / 60 + seconds / 3600;
  }, [currentTime]);

  // Вычисляем угол стрелки только при изменении времени
  const currentAngle = isCurrentDay ? getAngle(currentHours) : 0;
  const angleRad = (currentAngle - 90) * (Math.PI / 180);

  // Кэшируем координаты текста для каждой задачи
  const taskTextCoordinates = useMemo(() => {
    const textRadius = CLOCK_RADIUS * 0.65;
    return tasks.map((task) => {
      const startHours = timeToHours(task.startTime);
      let endHours = timeToHours(task.endTime);

      if (startHours > endHours) {
        endHours += 24;
      }

      const midHours = (startHours + endHours) / 2;
      const midAngle = getAngle(midHours);
      const midRad = (midAngle - 90) * (Math.PI / 180);

      return {
        x: CENTER_X + textRadius * Math.cos(midRad),
        y: CENTER_Y + textRadius * Math.sin(midRad),
      };
    });
  }, [tasks]);

  const formattedTime = currentTime.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const dateStr = `${currentDay.name} ${String(selectedDate.getDate()).padStart(2, '0')}`;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TimeWheel</Text>

      <View style={styles.clockContainer}>
        <Svg height={SVG_SIZE} width={SVG_SIZE} style={styles.svg}>
          {/* ВНЕШНЯЯ ГРАНИЦА ЦИФЕРБЛАТА */}
          <Circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r={CLOCK_RADIUS}
            fill="none"
            stroke={COLORS.clockBorder}
            strokeWidth="4"
          />

          {/* ЧАСОВЫЕ МЕТКИ (0-23) */}
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
                dominantBaseline="middle"
                fontSize={FONT_SIZES.xs}
                fontWeight="bold"
                fill={COLORS.textPrimary}>
                {String(i).padStart(2, '0')}
              </SvgText>
            );
          })}

          {/* ЗАДАЧИ НА ЦИФЕРБЛАТЕ */}
          {tasks.map((task, index) => {
            const startHours = timeToHours(task.startTime);
            let endHours = timeToHours(task.endTime);

            if (startHours > endHours) {
              endHours += 24;
            }

            const pathData = getPathData(startHours, endHours, CENTER_X, CENTER_Y, CLOCK_RADIUS);

            const isCurrentTask =
              isCurrentDay &&
              task.id ===
                currentDay.tasks.find((t) => {
                  const start = timeToHours(t.startTime);
                  const end = timeToHours(t.endTime);
                  if (start > end) {
                    return currentHours >= start || currentHours < end;
                  }
                  return currentHours >= start && currentHours < end;
                })?.id;

            const coords = taskTextCoordinates[index];

            return (
              <React.Fragment key={task.id}>
                <Path
                  d={pathData}
                  fill={task.color}
                  opacity={isCurrentTask ? '0.9' : '0.6'}
                  strokeWidth={isCurrentTask ? '2' : '0'}
                  stroke={isCurrentTask ? COLORS.textPrimary : 'transparent'}
                />
                <SvgText
                  x={coords.x}
                  y={coords.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={isCurrentTask ? FONT_SIZES.sm : FONT_SIZES.xs}
                  fontWeight={isCurrentTask ? '700' : '600'}
                  fill={COLORS.cardBackground}
                  opacity={isCurrentTask ? '1' : '0.85'}>
                  {task.title}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* ТЕКУЩАЯ СТРЕЛКА ВРЕМЕНИ */}
          {isCurrentDay && (
            <Path
              d={`M ${CENTER_X} ${CENTER_Y} L ${
                CENTER_X + (CLOCK_RADIUS - 20) * Math.cos(angleRad)
              } ${CENTER_Y + (CLOCK_RADIUS - 20) * Math.sin(angleRad)}`}
              stroke={COLORS.primary}
              strokeWidth="4"
              strokeLinecap="round"
            />
          )}

          {/* ЦЕНТРАЛЬНЫЙ КРУГ */}
          <Circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r="45"
            fill={COLORS.cardBackground}
            stroke={COLORS.clockBorder}
            strokeWidth="2"
          />

          {/* ВРЕМЯ В ЦЕНТРЕ */}
          <SvgText
            x={CENTER_X}
            y={CENTER_Y - 8}
            textAnchor="middle"
            fontSize={FONT_SIZES.xl}
            fontWeight="bold"
            fill={COLORS.textPrimary}>
            {formattedTime}
          </SvgText>

          {/* ДАТА В ЦЕНТРЕ */}
          <SvgText
            x={CENTER_X}
            y={CENTER_Y + 12}
            textAnchor="middle"
            fontSize={FONT_SIZES.xs}
            fontWeight="bold"
            fill={COLORS.textSecondary}>
            {dateStr}
          </SvgText>
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  clockContainer: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  svg: {
    shadowColor: COLORS.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
});
