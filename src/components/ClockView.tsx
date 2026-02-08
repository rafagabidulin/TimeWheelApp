// components/ClockView.tsx
import React, { useMemo, memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText, Line, TSpan, Rect } from 'react-native-svg';
import { Task, Day } from '../types/types';
import { getAngle, getPathData, timeToHours } from '../utils/timeUtils';
import { getDateLocale } from '../i18n';
import {
  CLOCK_RADIUS,
  CENTER_X,
  CENTER_Y,
  SVG_SIZE,
  SPACING,
  FONT_SIZES,
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
export default memo(function ClockView({
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
  const centerCircleRadius = CLOCK_RADIUS * 0.36;

  const currentTaskTitle = useMemo(() => {
    if (!isCurrentDay) return '';
    const currentTask = currentDay.tasks.find((task) => {
      const start = timeToHours(task.startTime);
      let end = timeToHours(task.endTime);
      if (start > end) {
        end += 24;
        return currentHours >= start || currentHours < end;
      }
      return currentHours >= start && currentHours < end;
    });
    return currentTask?.title ?? '';
  }, [currentDay.tasks, currentHours, isCurrentDay]);

  const wrappedTaskLines = useMemo(() => {
    if (!currentTaskTitle) return [];
    const maxLines = 2;
    const maxCharsPerLine = Math.max(6, Math.floor((centerCircleRadius * 1.6) / (FONT_SIZES.sm * 0.6)));
    const words = currentTaskTitle.trim().split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const nextLine = currentLine ? `${currentLine} ${word}` : word;
      if (nextLine.length <= maxCharsPerLine) {
        currentLine = nextLine;
        continue;
      }
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        lines.push(word.slice(0, maxCharsPerLine));
        currentLine = word.slice(maxCharsPerLine);
      }
      if (lines.length >= maxLines) {
        break;
      }
    }

    if (lines.length < maxLines && currentLine) {
      lines.push(currentLine);
    }

    if (lines.length > maxLines) {
      lines.length = maxLines;
    }

    if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
      const lastIndex = lines.length - 1;
      const lastLine = lines[lastIndex];
      lines[lastIndex] =
        lastLine.length > maxCharsPerLine - 3
          ? `${lastLine.slice(0, Math.max(0, maxCharsPerLine - 3))}...`
          : `${lastLine}...`;
    }

    return lines;
  }, [currentTaskTitle, centerCircleRadius]);

  const showNoTaskLabel = isCurrentDay && !currentTaskTitle;

  // Кэшируем координаты текста для каждой задачи
  const taskTextCoordinates = useMemo(() => {
    const textRadius = CLOCK_RADIUS * 0.45;
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

  const hourLabels = useMemo(() => {
    const labelRadius = CLOCK_RADIUS * 1.08;
    return Array.from({ length: 24 }, (_, i) => {
      const angle = (i / 24) * 360 - 90;
      const rad = angle * (Math.PI / 180);
      const x = CENTER_X + labelRadius * Math.cos(rad);
      const y = CENTER_Y + labelRadius * Math.sin(rad);

      return (
        <SvgText
          key={`hour-${i}`}
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="middle"
          alignmentBaseline="middle"
          fontSize={FONT_SIZES.xs}
          fontWeight="bold"
          fill={colors.textPrimary}>
          {String(i).padStart(2, '0')}
        </SvgText>
      );
    });
  }, [colors.textPrimary]);

  const innerTicks = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => {
      const angle = (i / 24) * 360 - 90;
      const rad = angle * (Math.PI / 180);
      const innerRadius = CLOCK_RADIUS * 0.36;
      const outerRadius = CLOCK_RADIUS;
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
    });
  }, [colors.textSecondary]);

  const innerEdgeTicks = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => {
      const angle = (i / 24) * 360 - 90;
      const rad = angle * (Math.PI / 180);
      const innerRadius = CLOCK_RADIUS * 0.92;
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
    });
  }, [colors.textSecondary]);


  const formattedTime = currentTime.toLocaleTimeString(getDateLocale(), {
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
          {hourLabels}

          {/* ТОНКИЕ МЕТКИ ЧАСОВ ОТ ЦЕНТРАЛЬНОГО КРУГА */}
          {innerTicks}

          {/* КОРОТКИЕ МЕТКИ ОТ ГРАНИЦЫ ЦИФЕРБЛАТА ВНУТРЬ */}
          {innerEdgeTicks}

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
                  opacity="0.6"
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
                CENTER_X + CLOCK_RADIUS * 0.84 * Math.cos(angleRad)
              } ${CENTER_Y + CLOCK_RADIUS * 0.84 * Math.sin(angleRad)}`}
              stroke={colors.primary}
              opacity={0.8}
              strokeWidth="4"
              strokeLinecap="round"
            />
          )}

          {/* ЦЕНТРАЛЬНЫЙ КРУГ */}
          <Circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r={centerCircleRadius}
            fill={colors.cardBackground}
            stroke={colors.clockBorder}
            strokeWidth="2"
          />

          {/* ВРЕМЯ В ЦЕНТРЕ */}
          <SvgText
            x={CENTER_X}
            y={isCurrentDay ? CENTER_Y - 20 : CENTER_Y - 8}
            textAnchor="middle"
            dominantBaseline="middle"
            alignmentBaseline="middle"
            fontSize={isCurrentDay ? FONT_SIZES.xxl : FONT_SIZES.xxxl}
            fontWeight="bold"
            fill={colors.textPrimary}
            testID="clock-time">
            {formattedTime}
          </SvgText>

          {/* ДАТА В ЦЕНТРЕ */}
          <SvgText
            x={CENTER_X}
            y={isCurrentDay ? CENTER_Y - 6 : CENTER_Y + 12}
            textAnchor="middle"
            dominantBaseline="middle"
            alignmentBaseline="middle"
            fontSize={isCurrentDay ? FONT_SIZES.sm : FONT_SIZES.base}
            fontWeight="bold"
            fill={colors.textSecondary}
            testID="clock-date">
            {dateStr}
          </SvgText>

          {/* НАЗВАНИЕ ТЕКУЩЕЙ ЗАДАЧИ */}
          {!!wrappedTaskLines.length && (
            <SvgText
              x={CENTER_X}
              y={CENTER_Y + 24}
              textAnchor="middle"
              dominantBaseline="middle"
              alignmentBaseline="middle"
              fontSize={FONT_SIZES.lg}
              fontWeight="600"
              fill={colors.textPrimary}
              opacity={0.9}
              testID="clock-current-task">
              {wrappedTaskLines.map((line, index) => (
                <TSpan key={`task-line-${index}`} x={CENTER_X} dy={index === 0 ? 0 : 14}>
                  {line}
                </TSpan>
              ))}
            </SvgText>
          )}

          {showNoTaskLabel && (
            <SvgText
              x={CENTER_X}
              y={CENTER_Y + 22}
              textAnchor="middle"
              dominantBaseline="middle"
              alignmentBaseline="middle"
              fontSize={FONT_SIZES.xs}
              fontWeight="600"
              fill={colors.textSecondary}
              opacity={0.9}
              testID="clock-no-task">
              <TSpan x={CENTER_X} dy={0}>
                Нет текущей
              </TSpan>
              <TSpan x={CENTER_X} dy={12}>
                задачи
              </TSpan>
            </SvgText>
          )}
        </Svg>
      </View>
    </View>
  );
});

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
