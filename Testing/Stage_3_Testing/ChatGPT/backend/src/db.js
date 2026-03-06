const fs = require('fs');
const path = require('path');

const dataDir = path.resolve(__dirname, '..', 'data');
const dataFile = path.join(dataDir, 'state.json');
const initialState = {
  employees: [],
  schedules: [],
  shifts: []
};

fs.mkdirSync(dataDir, { recursive: true });

const ensureDataFile = () => {
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify(initialState, null, 2));
  }
};

const loadState = () => {
  ensureDataFile();
  const raw = fs.readFileSync(dataFile, 'utf-8') || '';
  if (!raw.trim()) {
    fs.writeFileSync(dataFile, JSON.stringify(initialState, null, 2));
    return { ...initialState };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      employees: Array.isArray(parsed.employees) ? parsed.employees : [],
      schedules: Array.isArray(parsed.schedules) ? parsed.schedules : [],
      shifts: Array.isArray(parsed.shifts) ? parsed.shifts : []
    };
  } catch (error) {
    fs.writeFileSync(dataFile, JSON.stringify(initialState, null, 2));
    return { ...initialState };
  }
};

const writeState = (state) => {
  ensureDataFile();
  const snapshot = {
    employees: Array.isArray(state.employees) ? state.employees : [],
    schedules: Array.isArray(state.schedules) ? state.schedules : [],
    shifts: Array.isArray(state.shifts) ? state.shifts : []
  };
  fs.writeFileSync(dataFile, JSON.stringify(snapshot, null, 2));
};

module.exports = {
  loadState,
  writeState
};
