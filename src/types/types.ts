// types/index.ts
export interface Task {
  id: string;
  dayId: string;
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
  selectedDayId: string;
  days: Day[];
  appState: AppStateStatus;
  setSelectedDayId: (dayId: string) => void;
  addTask: (formData: FormData) => Promise<void>;
  updateTask: (taskId: string, formData: FormData) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  loadDaysFromStorage: () => Promise<void>;
  currentDay: Day;
  isCurrentDay: boolean;
  tasks: Task[];
  currentTask: Task | undefined;
  nextTask: Task | undefined;
  loadPercent: number;
}

export type AppStateStatus = 'active' | 'background' | 'inactive';
