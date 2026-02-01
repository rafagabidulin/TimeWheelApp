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
}

export type AppStateStatus = 'active' | 'background' | 'inactive';
