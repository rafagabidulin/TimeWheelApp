import { v4 as uuidv4 } from 'uuid';
import {
  Day,
  Task,
  Template,
  TemplateApplyOptions,
  TemplateApplyPreview,
  TemplateTaskInput,
  WeekdayId,
} from '../types/types';
import { doTimeRangesOverlap, parseDateISO } from './timeUtils';

type DayNameResolver = (dateIso: string) => string;

const WEEKDAY_ORDER: WeekdayId[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

function getWeekdayId(dateIso: string): WeekdayId | null {
  const date = parseDateISO(dateIso);
  if (!date) return null;
  const jsDay = date.getDay(); // 0 = Sunday
  const index = jsDay === 0 ? 6 : jsDay - 1;
  return WEEKDAY_ORDER[index] || null;
}

function normalizeTargetDates(targetDates: string[]): string[] {
  const unique = new Set<string>();
  for (const dateIso of targetDates) {
    if (parseDateISO(dateIso)) {
      unique.add(dateIso);
    }
  }
  return [...unique].sort();
}

function getMonthTemplateMap(template: Template): Map<number, TemplateTaskInput[]> {
  if (template.type !== 'month') {
    return new Map();
  }

  const monthMap = new Map<number, TemplateTaskInput[]>();
  for (const [sourceDateIso, tasks] of Object.entries(template.days)) {
    const sourceDate = parseDateISO(sourceDateIso);
    if (!sourceDate || !Array.isArray(tasks)) continue;
    monthMap.set(sourceDate.getDate(), tasks);
  }

  return monthMap;
}

function getTemplateTasksForDate(
  template: Template,
  dateIso: string,
  monthTemplateMap?: Map<number, TemplateTaskInput[]>,
): TemplateTaskInput[] {
  if (template.type === 'day') {
    return template.tasks;
  }

  if (template.type === 'week') {
    const weekdayId = getWeekdayId(dateIso);
    return weekdayId ? template.days[weekdayId] || [] : [];
  }

  const targetDate = parseDateISO(dateIso);
  if (!targetDate) return [];
  const byDayOfMonth = monthTemplateMap || getMonthTemplateMap(template);
  return byDayOfMonth.get(targetDate.getDate()) || [];
}

function hasOverlapWithTasks(task: TemplateTaskInput, tasks: Array<Task | TemplateTaskInput>): boolean {
  return tasks.some((existing) =>
    doTimeRangesOverlap(task.startTime, task.endTime, existing.startTime, existing.endTime),
  );
}

function materializeTasks(dateIso: string, sourceTasks: TemplateTaskInput[]): Task[] {
  return sourceTasks.map((task) => ({
    ...task,
    id: `template-${uuidv4()}`,
    date: dateIso,
  }));
}

function buildPreviewBase(
  template: Template,
  options: TemplateApplyOptions,
  targetDatesCount: number,
): TemplateApplyPreview {
  return {
    templateId: template.id,
    policy: options.policy,
    targetDatesCount,
    affectedDates: [],
    addedTasks: 0,
    replacedDays: 0,
    skippedConflicts: 0,
    untouchedDays: 0,
  };
}

export function previewTemplateApplication(
  days: Day[],
  template: Template,
  options: TemplateApplyOptions,
): TemplateApplyPreview {
  const targetDates = normalizeTargetDates(options.targetDates);
  const preview = buildPreviewBase(template, options, targetDates.length);
  const dayMap = new Map(days.map((day) => [day.date, day]));
  const monthTemplateMap = template.type === 'month' ? getMonthTemplateMap(template) : undefined;

  for (const dateIso of targetDates) {
    const sourceTasks = getTemplateTasksForDate(template, dateIso, monthTemplateMap);
    if (sourceTasks.length === 0) {
      preview.untouchedDays += 1;
      continue;
    }

    const existingTasks = dayMap.get(dateIso)?.tasks || [];

    if (options.policy === 'empty_only') {
      if (existingTasks.length > 0) {
        preview.untouchedDays += 1;
        continue;
      }
      preview.affectedDates.push(dateIso);
      preview.addedTasks += sourceTasks.length;
      continue;
    }

    if (options.policy === 'replace') {
      preview.affectedDates.push(dateIso);
      if (existingTasks.length > 0) {
        preview.replacedDays += 1;
      }
      preview.addedTasks += sourceTasks.length;
      continue;
    }

    const acceptedTasks: TemplateTaskInput[] = [];
    let acceptedCount = 0;
    let skippedCount = 0;

    for (const task of sourceTasks) {
      const conflictsExisting = hasOverlapWithTasks(task, existingTasks);
      const conflictsAccepted = hasOverlapWithTasks(task, acceptedTasks);
      if (conflictsExisting || conflictsAccepted) {
        skippedCount += 1;
        continue;
      }
      acceptedTasks.push(task);
      acceptedCount += 1;
    }

    preview.skippedConflicts += skippedCount;
    if (acceptedCount > 0) {
      preview.affectedDates.push(dateIso);
      preview.addedTasks += acceptedCount;
    } else {
      preview.untouchedDays += 1;
    }
  }

  return preview;
}

export function applyTemplate(
  days: Day[],
  template: Template,
  options: TemplateApplyOptions,
  resolveDayName?: DayNameResolver,
): { days: Day[]; preview: TemplateApplyPreview } {
  const targetDates = normalizeTargetDates(options.targetDates);
  const preview = buildPreviewBase(template, options, targetDates.length);
  const dayMap = new Map<string, Day>(
    days.map((day) => [
      day.date,
      {
        ...day,
        tasks: [...day.tasks],
      },
    ]),
  );
  const monthTemplateMap = template.type === 'month' ? getMonthTemplateMap(template) : undefined;

  for (const dateIso of targetDates) {
    const sourceTasks = getTemplateTasksForDate(template, dateIso, monthTemplateMap);
    if (sourceTasks.length === 0) {
      preview.untouchedDays += 1;
      continue;
    }

    const existingDay = dayMap.get(dateIso);
    const existingTasks = existingDay?.tasks || [];

    if (options.policy === 'empty_only') {
      if (existingTasks.length > 0) {
        preview.untouchedDays += 1;
        continue;
      }

      const generatedTasks = materializeTasks(dateIso, sourceTasks);
      const dayName = existingDay?.name || resolveDayName?.(dateIso) || dateIso;
      dayMap.set(dateIso, {
        id: existingDay?.id || dateIso,
        name: dayName,
        date: dateIso,
        tasks: generatedTasks,
      });
      preview.affectedDates.push(dateIso);
      preview.addedTasks += generatedTasks.length;
      continue;
    }

    if (options.policy === 'replace') {
      const generatedTasks = materializeTasks(dateIso, sourceTasks);
      const dayName = existingDay?.name || resolveDayName?.(dateIso) || dateIso;
      dayMap.set(dateIso, {
        id: existingDay?.id || dateIso,
        name: dayName,
        date: dateIso,
        tasks: generatedTasks,
      });
      preview.affectedDates.push(dateIso);
      if (existingTasks.length > 0) {
        preview.replacedDays += 1;
      }
      preview.addedTasks += generatedTasks.length;
      continue;
    }

    const acceptedTasks: TemplateTaskInput[] = [];
    let skippedCount = 0;

    for (const task of sourceTasks) {
      const conflictsExisting = hasOverlapWithTasks(task, existingTasks);
      const conflictsAccepted = hasOverlapWithTasks(task, acceptedTasks);
      if (conflictsExisting || conflictsAccepted) {
        skippedCount += 1;
        continue;
      }
      acceptedTasks.push(task);
    }

    preview.skippedConflicts += skippedCount;
    if (acceptedTasks.length === 0) {
      preview.untouchedDays += 1;
      continue;
    }

    const generatedTasks = materializeTasks(dateIso, acceptedTasks);
    const mergedTasks = [...existingTasks, ...generatedTasks];
    const dayName = existingDay?.name || resolveDayName?.(dateIso) || dateIso;

    dayMap.set(dateIso, {
      id: existingDay?.id || dateIso,
      name: dayName,
      date: dateIso,
      tasks: mergedTasks,
    });
    preview.affectedDates.push(dateIso);
    preview.addedTasks += generatedTasks.length;
  }

  const affectedDateSet = new Set(preview.affectedDates);
  const untouchedOriginal = days.filter((day) => !affectedDateSet.has(day.date));
  const affected = [...dayMap.values()].filter((day) => affectedDateSet.has(day.date));
  const nextDays = [...untouchedOriginal, ...affected].sort((a, b) => a.date.localeCompare(b.date));

  return { days: nextDays, preview };
}
