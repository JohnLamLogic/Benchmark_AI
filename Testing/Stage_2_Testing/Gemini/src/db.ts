import Dexie, { type EntityTable } from 'dexie';

export interface Employee {
    id: string;
    name: string;
    positions: string[];
    email: string;
}

export interface Shift {
    id: string;
    employeeId: string;
    dayOfWeek: number; // 0 for Sunday, 1 for Monday, etc.
    startTime: string; // HH:mm
    endTime: string; // HH:mm
    position: string;
}

export interface Schedule {
    id: string;
    weekStartDate: string; // YYYY-MM-DD
    shifts: Shift[];
}

const db = new Dexie('RestaurantScheduleDB') as Dexie & {
    employees: EntityTable<Employee, 'id'>;
    schedules: EntityTable<Schedule, 'id'>;
};

// Schema declaration
db.version(1).stores({
    employees: 'id, name',
    schedules: 'id, weekStartDate' // We store the whole schedule with its shifts as a single document
});

export { db };
