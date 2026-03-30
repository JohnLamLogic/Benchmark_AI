export const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function normalizeWeekStart(dateValue: string | Date): string {
  const date = typeof dateValue === 'string' ? new Date(dateValue) : new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date for week start.');
  }

  const day = date.getDay();
  const mondayDate = new Date(date);
  mondayDate.setHours(0, 0, 0, 0);
  const shift = (day + 6) % 7; // how many days since Monday
  mondayDate.setDate(mondayDate.getDate() - shift);
  return mondayDate.toISOString().split('T')[0];
}

export function currentWeekStart(): string {
  return normalizeWeekStart(new Date());
}

export function minutesBetween(start: string, end: string): number {
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  return (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
}

export function formatMinutesAsHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString()}:${mins.toString().padStart(2, '0')}`;
}
