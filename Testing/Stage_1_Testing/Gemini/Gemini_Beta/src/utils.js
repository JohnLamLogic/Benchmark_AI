export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const POSITIONS = [
    'Server',
    'Host',
    'Busser',
    'Bartender',
    'Kitchen',
    'Manager'
];

export function generateId() {
    return Math.random().toString(36).substr(2, 9);
}
