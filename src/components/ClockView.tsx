// components/ClockView.tsx
import React, { useMemo } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Svg, { Circle, Path, Text as SvgText, Line } from 'react-native-svg';
import { Task, Day } from '../types/types';
import { getAngle, getAngleRadians, getPathData, timeToHours } from '../utils/timeUtils';
import {
  CLOCK_RADIUS,
  CENTER_X,
  CENTER_Y,
  SVG_SIZE,
  SPACING,
  FONT_SIZES,
  ANGLE_TOP,
  useTheme,
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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
    const textRadius = 50;
    return tasks.map((task) => {
      const startHours = timeToHours(task.startTime);
      let endHours = timeToHours(task.endTime);

      if (startHours > endHours) {
        endHours += 24;
      }

      const midHours = (startHours + endHours) / 2;
      const midAngle = getAngle(midHours);
      const midRad = (midAngle - 90) * (Math.PI / 180);

      const x = CENTER_X + textRadius * Math.cos(midRad);
      const y = CENTER_Y + textRadius * Math.sin(midRad);

      return {
        x,
        y,
        angle: midAngle - 90,
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
      <View style={styles.clockContainer}>
        <Svg height={SVG_SIZE} width={SVG_SIZE} style={styles.svg}>
          {/* ВНЕШНЯЯ ГРАНИЦА ЦИФЕРБЛАТА */}
          <Circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r={CLOCK_RADIUS}
            fill="none"
            stroke={colors.clockBorder}
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
                fill={colors.textPrimary}>
                {String(i).padStart(2, '0')}
              </SvgText>
            );
          })}

          {/* ТОНКИЕ МЕТКИ ЧАСОВ ОТ ЦЕНТРАЛЬНОГО КРУГА */}
          {Array.from({ length: 24 }, (_, i) => {
            const angle = (i / 24) * 360 - 90;
            const rad = angle * (Math.PI / 180);
            const innerRadius = 45;
            const outerRadius = CLOCK_RADIUS - 47;
            const x1 = CENTER_X + innerRadius * Math.cos(rad);
            const y1 = CENTER_Y + innerRadius * Math.sin(rad);
            const x2 = CENTER_X + outerRadius * Math.cos(rad);
            const y2 = CENTER_Y + outerRadius * Math.sin(rad);

            return (
              <Line
                key={`tick-${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={colors.textSecondary}
                strokeWidth={1}
                opacity={0.25}
              />
            );
          })}

          {/* КОРОТКИЕ МЕТКИ ОТ ГРАНИЦЫ ЦИФЕРБЛАТА ВНУТРЬ */}
          {Array.from({ length: 24 }, (_, i) => {
            const angle = (i / 24) * 360 - 90;
            const rad = angle * (Math.PI / 180);
            const innerRadius = CLOCK_RADIUS - 10;
            const outerRadius = CLOCK_RADIUS;
            const x1 = CENTER_X + innerRadius * Math.cos(rad);
            const y1 = CENTER_Y + innerRadius * Math.sin(rad);
            const x2 = CENTER_X + outerRadius * Math.cos(rad);
            const y2 = CENTER_Y + outerRadius * Math.sin(rad);

            return (
              <Line
                key={`outer-tick-in-${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={colors.textSecondary}
                strokeWidth={1}
                opacity={0.25}
              />
            );
          })}

          {/* КОРОТКИЕ МЕТКИ С НАРУЖНОЙ СТОРОНЫ */}
          {Array.from({ length: 24 }, (_, i) => {
            const angle = (i / 24) * 360 - 90;
            const rad = angle * (Math.PI / 180);
            const innerRadius = CLOCK_RADIUS;
            const outerRadius = CLOCK_RADIUS + 10;
            const x1 = CENTER_X + innerRadius * Math.cos(rad);
            const y1 = CENTER_Y + innerRadius * Math.sin(rad);
            const x2 = CENTER_X + outerRadius * Math.cos(rad);
            const y2 = CENTER_Y + outerRadius * Math.sin(rad);

            return (
              <Line
                key={`outer-tick-out-${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={colors.textSecondary}
                strokeWidth={1}
                opacity={0.25}
              />
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
                stroke={isCurrentTask ? colors.textPrimary : 'transparent'}
                />
                <SvgText
                  x={coords.x}
                  y={coords.y}
                  textAnchor="start"
                  dominantBaseline="middle"
                  fontSize={isCurrentTask ? FONT_SIZES.sm : FONT_SIZES.xs}
                  fontWeight={isCurrentTask ? '700' : '600'}
                  fill={colors.cardBackground}
                  opacity={isCurrentTask ? '1' : '0.85'}
                  transform={`rotate(${coords.angle} ${coords.x} ${coords.y})`}
                  testID={`clock-task-${task.id}`}>
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
              stroke={colors.primary}
              strokeWidth="4"
              strokeLinecap="round"
            />
          )}

          {/* ЦЕНТРАЛЬНЫЙ КРУГ */}
          <Circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r="45"
            fill={colors.cardBackground}
            stroke={colors.clockBorder}
            strokeWidth="2"
          />

          {/* ВРЕМЯ В ЦЕНТРЕ */}
          <SvgText
            x={CENTER_X}
            y={CENTER_Y - 8}
            textAnchor="middle"
            fontSize={FONT_SIZES.xl}
            fontWeight="bold"
            fill={colors.textPrimary}
            testID="clock-time">
            {formattedTime}
          </SvgText>

          {/* ДАТА В ЦЕНТРЕ */}
          <SvgText
            x={CENTER_X}
            y={CENTER_Y + 12}
            textAnchor="middle"
            fontSize={FONT_SIZES.xs}
            fontWeight="bold"
            fill={colors.textSecondary}
            testID="clock-date">
            {dateStr}
          </SvgText>
        </Svg>
      </View>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  clockContainer: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  svg: {
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
});
