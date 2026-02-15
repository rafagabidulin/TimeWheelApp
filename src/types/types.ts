// types/index.ts
export interface Task {
  id: string;
  date: string; // ISO дата (YYYY-MM-DD)
  title: string;
  startTime: string;
  endTime: string;
  category: string;
  color: string;
  calendarEventId?: string;
}

export type TemplateTaskInput = Omit<Task, 'id' | 'date' | 'calendarEventId'>;

export type TemplateType = 'day' | 'week' | 'month';
export type TemplateApplyPolicy = 'empty_only' | 'replace' | 'merge_skip_conflicts';
export type WeekdayId =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface TemplateBase {
  id: string;
  name: string;
  type: TemplateType;
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
  description?: string;
}

export interface DayTemplate extends TemplateBase {
  type: 'day';
  tasks: TemplateTaskInput[];
}

export interface WeekTemplate extends TemplateBase {
  type: 'week';
  days: Record<WeekdayId, TemplateTaskInput[]>;
}

export interface MonthTemplate extends TemplateBase {
  type: 'month';
  // Ключ — ISO дата (YYYY-MM-DD), чтобы хранить конкретные даты месяца.
  days: Record<string, TemplateTaskInput[]>;
}

export type Template = DayTemplate | WeekTemplate | MonthTemplate;

export interface TemplateApplyDateRange {
  from: string; // ISO дата (YYYY-MM-DD)
  to: string; // ISO дата (YYYY-MM-DD)
}

export interface TemplateApplyOptions {
  policy: TemplateApplyPolicy;
  targetDates: string[]; // ISO даты, рассчитанные на уровне UI/сервиса
  range?: TemplateApplyDateRange;
  weekdays?: WeekdayId[];
}

export interface TemplateApplyPreview {
  templateId: string;
  policy: TemplateApplyPolicy;
  targetDatesCount: number;
  affectedDates: string[];
  addedTasks: number;
  replacedDays: number;
  skippedConflicts: number;
  untouchedDays: number;
}

export interface Day {
  id: string;
  name: string;
  date: string; // ISO дата (YYYY-MM-DD)
  tasks: Task[];
}

export interface FormData {
  title: string;
  startTime: string;
  endTime: string;
  color: string;
  category: string;
}

export interface TaskContextValue {
  currentTime: Date;
  selectedDate: string;
  selectedDateObj: Date;
  days: Day[];
  weekDays: Day[];
  appState: AppStateStatus;
  setSelectedDate: (date: string) => void;
  addTask: (formData: FormData, options?: { allowOverlap?: boolean }) => Promise<void>;
  updateTask: (
    taskId: string,
    formData: FormData,
    options?: { allowOverlap?: boolean },
  ) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  loadDaysFromStorage: () => Promise<void>;
  currentDay: Day;
  isCurrentDay: boolean;
  tasks: Task[];
  currentTask: Task | undefined;
  nextTask: Task | undefined;
  loadPercent: number;
  applyWeeklyTemplate: () => Promise<number>;
  previewTemplateApply: (template: Template, options: TemplateApplyOptions) => TemplateApplyPreview;
  applyTemplateWithOptions: (
    template: Template,
    options: TemplateApplyOptions,
  ) => Promise<TemplateApplyPreview>;
}

export type AppStateStatus = 'active' | 'background' | 'inactive';
