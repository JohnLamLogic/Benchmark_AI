export interface EmployeeRecord {
  id: number;
  name: string;
  email: string;
  positions: string[];
  payRate: number;
  createdAt: string;
}

export interface ScheduleRecord {
  id: number;
  weekStart: string; // ISO date (Monday)
  createdAt: string;
}

export interface ShiftRecord {
  id: number;
  scheduleId: number;
  employeeId: number;
  day: number; // 0=Sunday
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  position: string;
  employeeName: string;
}

export type TimeOffStatus = 'pending' | 'approved' | 'denied';

export interface TimeOffRequest {
  id: number;
  employeeId: number;
  employeeName: string;
  date: string;
  reason: string;
  status: TimeOffStatus;
  managerNotes: string | null;
  respondedAt: string | null;
  createdAt: string;
}

export interface WeeklyHours {
  weekStart: string;
  totalMinutes: number;
}
