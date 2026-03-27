// db/store.js — Pure JavaScript JSON-file data store (no native dependencies)
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function createCollection(name) {
  const filePath = path.join(DATA_DIR, `${name}.json`);

  function load() {
    if (!fs.existsSync(filePath)) return { data: [], nextId: 1 };
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return { data: [], nextId: 1 };
    }
  }

  function save(store) {
    fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf8');
  }

  return {
    findAll(filterFn) {
      const { data } = load();
      if (!filterFn) return [...data];
      return data.filter(filterFn);
    },

    findOne(filterFn) {
      const { data } = load();
      return data.find(filterFn) || null;
    },

    findById(id) {
      const numId = parseInt(id, 10);
      return this.findOne(item => item.id === numId);
    },

    insert(item) {
      const store = load();
      const now = new Date().toISOString();
      const newItem = {
        ...item,
        id: store.nextId,
        created_at: item.created_at || now,
        updated_at: item.updated_at || now
      };
      store.data.push(newItem);
      store.nextId++;
      save(store);
      return { ...newItem };
    },

    update(id, updates) {
      const numId = parseInt(id, 10);
      const store = load();
      const idx = store.data.findIndex(item => item.id === numId);
      if (idx === -1) return null;
      store.data[idx] = { ...store.data[idx], ...updates, updated_at: new Date().toISOString() };
      save(store);
      return { ...store.data[idx] };
    },

    delete(id) {
      const numId = parseInt(id, 10);
      const store = load();
      const idx = store.data.findIndex(item => item.id === numId);
      if (idx === -1) return false;
      store.data.splice(idx, 1);
      save(store);
      return true;
    },

    deleteWhere(filterFn) {
      const store = load();
      const before = store.data.length;
      store.data = store.data.filter(item => !filterFn(item));
      save(store);
      return before - store.data.length;
    },

    count(filterFn) {
      const { data } = load();
      if (!filterFn) return data.length;
      return data.filter(filterFn).length;
    }
  };
}

function createSingleStore(name) {
  const filePath = path.join(DATA_DIR, `${name}.json`);
  return {
    get() {
      if (!fs.existsSync(filePath)) return null;
      try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
    },
    set(value) {
      fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
    },
    clear() {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  };
}

module.exports = {
  users: createCollection('users'),
  employees: createCollection('employees'),
  schedules: createCollection('schedules'),
  shifts: createCollection('shifts'),
  timeoff: createCollection('timeoff'),
  gmailTokens: createSingleStore('gmailTokens')
};
