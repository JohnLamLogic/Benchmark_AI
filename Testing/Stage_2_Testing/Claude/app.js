/* ═══════════════════════════════════════════════════════════════════
   RestaurantOS — app.js
   Full application logic: IndexedDB, schedule grid, employee
   management, PDF export (jsPDF), no external API calls.
   ═══════════════════════════════════════════════════════════════════ */

'use strict';

/* ─── Constants ──────────────────────────────────────────────────────── */
const DB_NAME = 'RestaurantOS';
const DB_VERSION = 1;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Default position list (manager can add custom ones per employee)
const DEFAULT_POSITIONS = ['Host', 'Server', 'Busser', 'Bartender', 'Cook', 'Expo', 'Dishwasher', 'Manager'];

// Position colors (cyclical)
const POS_COLORS = [
    '#f59e0b', '#3b82f6', '#22c55e', '#ec4899', '#8b5cf6',
    '#06b6d4', '#f97316', '#10b981', '#e11d48', '#6366f1'
];

/* ─── State ──────────────────────────────────────────────────────────── */
let db;                         // IDBDatabase
let employees = [];           // [{id, name, email, positions:[]}]
let shifts = [];           // [{id, employeeId, day(0-6), start, end, position}]
let savedSchedules = [];        // [{id, weekStart(ISO), label, shifts:[...snapshot]}]
let currentWeekStart;           // Date (Monday of displayed week)
let customPositions = [...DEFAULT_POSITIONS]; // global list used across app
let pendingConfirm = null;     // callback for confirm modal
let pendingLoad = null;     // saved schedule for load modal

/* ─── DB Init ────────────────────────────────────────────────────────── */
function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = e => {
            const d = e.target.result;
            if (!d.objectStoreNames.contains('employees')) {
                d.createObjectStore('employees', { keyPath: 'id' });
            }
            if (!d.objectStoreNames.contains('shifts')) {
                d.createObjectStore('shifts', { keyPath: 'id' });
            }
            if (!d.objectStoreNames.contains('savedSchedules')) {
                d.createObjectStore('savedSchedules', { keyPath: 'id' });
            }
            if (!d.objectStoreNames.contains('settings')) {
                d.createObjectStore('settings', { keyPath: 'key' });
            }
        };
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = e => reject(e.target.error);
    });
}

function dbGetAll(storeName) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function dbPut(storeName, obj) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const req = tx.objectStore(storeName).put(obj);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function dbDelete(storeName, key) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const req = tx.objectStore(storeName).delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

function dbClear(storeName) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const req = tx.objectStore(storeName).clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

/* ─── Utilities ──────────────────────────────────────────────────────── */
function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function toMonday(date) {
    const d = new Date(date);
    const day = d.getDay();                       // 0=Sun … 6=Sat
    const diff = day === 0 ? -6 : 1 - day;       // shift to Monday
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(t) {    // "13:30" → "1:30 PM"
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function initials(name) {
    return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

function positionColor(pos) {
    const allPos = [...new Set(employees.flatMap(e => e.positions))];
    const idx = allPos.indexOf(pos);
    return POS_COLORS[idx >= 0 ? idx % POS_COLORS.length : 0];
}

function showToast(msg, type = '') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast' + (type ? ' ' + type : '');
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2800);
}

/* ─── Modal helpers ──────────────────────────────────────────────────── */
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-close, [data-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.modal || btn.closest('.modal-overlay').id));
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
        if (e.target === overlay) closeModal(overlay.id);
    });
});

/* ─── Navigation ─────────────────────────────────────────────────────── */
function setView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`view-${viewId}`).classList.add('active');
    document.querySelector(`[data-view="${viewId}"]`).classList.add('active');

    const titles = { schedule: 'Weekly Schedule', employees: 'Employees', history: 'Saved Schedules' };
    document.getElementById('pageTitle').textContent = titles[viewId] || '';

    if (viewId === 'schedule') renderSchedule();
    if (viewId === 'employees') renderEmployeeGrid();
    if (viewId === 'history') renderHistory();
}

document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        setView(btn.dataset.view);
        document.getElementById('sidebar').classList.remove('open');
    });
});

document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
});
document.getElementById('sidebarClose').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
});

/* ─── Week Navigation ────────────────────────────────────────────────── */
function updateWeekLabel() {
    const end = addDays(currentWeekStart, 6);
    document.getElementById('weekLabel').textContent =
        `${formatDate(currentWeekStart)} — ${formatDate(end)}`;
}

document.getElementById('prevWeek').addEventListener('click', () => {
    currentWeekStart = addDays(currentWeekStart, -7);
    updateWeekLabel();
    renderSchedule();
});
document.getElementById('nextWeek').addEventListener('click', () => {
    currentWeekStart = addDays(currentWeekStart, 7);
    updateWeekLabel();
    renderSchedule();
});

/* ─── Schedule Render ────────────────────────────────────────────────── */
function renderSchedule() {
    const wrap = document.getElementById('scheduleGridWrap');

    if (employees.length === 0) {
        wrap.innerHTML = `
      <div class="no-employees-msg">
        <div class="big-icon">👥</div>
        <p>No employees yet. <a href="#" id="goEmpLink" style="color:var(--accent)">Add employees</a> to build the schedule.</p>
      </div>`;
        document.getElementById('goEmpLink')?.addEventListener('click', e => {
            e.preventDefault(); setView('employees');
        });
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build header
    let thead = '<thead><tr><th>Employee</th>';
    for (let i = 0; i < 7; i++) {
        const day = addDays(currentWeekStart, i);
        const isToday = day.getTime() === today.getTime();
        const cls = isToday ? ' today-col' : '';
        thead += `<th class="${cls}">${DAY_SHORT[day.getDay()]}<br><span style="font-size:11px;font-weight:400;opacity:.7">${day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></th>`;
    }
    thead += '</tr></thead>';

    // Build body
    let tbody = '<tbody>';
    employees.forEach(emp => {
        tbody += `<tr>
      <td>
        <div class="emp-name-cell">
          <div class="emp-avatar">${initials(emp.name)}</div>
          <div class="emp-info">
            <div class="name">${escHtml(emp.name)}</div>
            <div class="roles">${emp.positions.join(', ')}</div>
          </div>
        </div>
      </td>`;

        for (let i = 0; i < 7; i++) {
            const dayDate = addDays(currentWeekStart, i);
            const dayIdx = dayDate.getDay();   // 0=Sun … 6=Sat
            const dayShifts = shifts.filter(s => s.employeeId === emp.id && s.day === dayIdx
                && isSameWeek(s));

            tbody += `<td><div class="day-cell-content">`;

            dayShifts.forEach(shift => {
                const color = positionColor(shift.position);
                tbody += `
          <div class="shift-chip" data-id="${shift.id}">
            <div class="shift-chip-body">
              <div class="shift-time">${formatTime(shift.start)} – ${formatTime(shift.end)}</div>
              <div class="shift-pos"><span class="pos-dot" style="background:${color}"></span>${escHtml(shift.position)}</div>
            </div>
            <div class="shift-chip-actions">
              <button title="Edit shift" onclick="editShift('${shift.id}')">✏️</button>
              <button title="Delete shift" onclick="deleteShiftPrompt('${shift.id}')">🗑️</button>
            </div>
          </div>`;
            });

            tbody += `<button class="add-shift-btn" onclick="openAddShift('${emp.id}',${dayIdx})">＋ Add</button>`;
            tbody += `</div></td>`;
        }
        tbody += '</tr>';
    });
    tbody += '</tbody>';

    wrap.innerHTML = `<table>${thead}${tbody}</table>`;
}

// Determine if a shift belongs to currentWeekStart week
function isSameWeek(shift) {
    const shiftWeekStart = toMonday(new Date(shift.weekStart));
    return shiftWeekStart.getTime() === currentWeekStart.getTime();
}

function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ─── Shift CRUD ─────────────────────────────────────────────────────── */
function openAddShift(empId, dayIdx) {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;

    document.getElementById('shiftId').value = '';
    document.getElementById('shiftEmpId').value = empId;
    document.getElementById('shiftDay').value = dayIdx;
    document.getElementById('shiftModalTitle').textContent = 'Add Shift';
    document.getElementById('shiftEmpName').textContent = emp.name;
    document.getElementById('shiftDayLabel').textContent = DAYS[dayIdx];
    document.getElementById('shiftStart').value = '';
    document.getElementById('shiftEnd').value = '';

    populateShiftPositions(emp);
    openModal('shiftModal');
}

function editShift(shiftId) {
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) return;
    const emp = employees.find(e => e.id === shift.employeeId);
    if (!emp) return;

    document.getElementById('shiftId').value = shift.id;
    document.getElementById('shiftEmpId').value = shift.employeeId;
    document.getElementById('shiftDay').value = shift.day;
    document.getElementById('shiftModalTitle').textContent = 'Edit Shift';
    document.getElementById('shiftEmpName').textContent = emp.name;
    document.getElementById('shiftDayLabel').textContent = DAYS[shift.day];
    document.getElementById('shiftStart').value = shift.start;
    document.getElementById('shiftEnd').value = shift.end;

    populateShiftPositions(emp, shift.position);
    openModal('shiftModal');
}

function populateShiftPositions(emp, selected = '') {
    const sel = document.getElementById('shiftPosition');
    sel.innerHTML = '';
    emp.positions.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        if (p === selected) opt.selected = true;
        sel.appendChild(opt);
    });
}

document.getElementById('saveShiftBtn').addEventListener('click', async () => {
    const id = document.getElementById('shiftId').value;
    const empId = document.getElementById('shiftEmpId').value;
    const day = parseInt(document.getElementById('shiftDay').value);
    const start = document.getElementById('shiftStart').value;
    const end = document.getElementById('shiftEnd').value;
    const pos = document.getElementById('shiftPosition').value;

    if (!start || !end) { showToast('Please set start and end times.', 'error'); return; }
    if (start >= end) { showToast('End time must be after start time.', 'error'); return; }

    const shift = {
        id: id || uid(),
        employeeId: empId,
        day,
        start,
        end,
        position: pos,
        weekStart: currentWeekStart.toISOString()
    };

    await dbPut('shifts', shift);

    if (id) {
        const idx = shifts.findIndex(s => s.id === id);
        shifts[idx] = shift;
    } else {
        shifts.push(shift);
    }

    closeModal('shiftModal');
    renderSchedule();
    showToast(id ? 'Shift updated.' : 'Shift added.', 'success');
});

function deleteShiftPrompt(shiftId) {
    showConfirm('Delete Shift', 'Remove this shift from the schedule?', async () => {
        await dbDelete('shifts', shiftId);
        shifts = shifts.filter(s => s.id !== shiftId);
        renderSchedule();
        showToast('Shift deleted.', 'success');
    });
}

// Expose to inline onclick
window.editShift = editShift;
window.deleteShiftPrompt = deleteShiftPrompt;
window.openAddShift = openAddShift;

/* ─── Confirm Modal ──────────────────────────────────────────────────── */
function showConfirm(title, message, onOk) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    pendingConfirm = onOk;
    openModal('confirmModal');
}
document.getElementById('confirmOkBtn').addEventListener('click', () => {
    closeModal('confirmModal');
    if (pendingConfirm) { pendingConfirm(); pendingConfirm = null; }
});

/* ─── Schedule Save ──────────────────────────────────────────────────── */
document.getElementById('saveScheduleBtn').addEventListener('click', async () => {
    const weekShifts = shifts.filter(s => isSameWeek(s));
    if (weekShifts.length === 0) { showToast('Nothing to save — add shifts first.', 'error'); return; }

    const end = addDays(currentWeekStart, 6);
    const label = `${formatDate(currentWeekStart)} – ${formatDate(end)}`;

    // Remove existing saved schedule for same week if any
    const existing = savedSchedules.find(ss =>
        new Date(ss.weekStart).getTime() === currentWeekStart.getTime()
    );
    if (existing) {
        await dbDelete('savedSchedules', existing.id);
        savedSchedules = savedSchedules.filter(ss => ss.id !== existing.id);
    }

    const saved = {
        id: uid(),
        weekStart: currentWeekStart.toISOString(),
        label,
        savedAt: new Date().toISOString(),
        shifts: JSON.parse(JSON.stringify(weekShifts))
    };

    await dbPut('savedSchedules', saved);
    savedSchedules.unshift(saved);
    showToast('Schedule saved!', 'success');
});

/* ─── History View ───────────────────────────────────────────────────── */
function renderHistory() {
    const list = document.getElementById('historyList');
    if (savedSchedules.length === 0) {
        list.innerHTML = `<div class="history-empty">📭 No saved schedules yet.</div>`;
        return;
    }
    list.innerHTML = savedSchedules.map(ss => {
        const saved = new Date(ss.savedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
        const shiftCount = ss.shifts.length;
        return `
      <div class="history-item">
        <div class="history-icon">📋</div>
        <div class="history-info">
          <div class="history-week">${escHtml(ss.label)}</div>
          <div class="history-meta">Saved ${saved} · ${shiftCount} shift${shiftCount !== 1 ? 's' : ''}</div>
        </div>
        <div class="history-actions">
          <button class="btn btn-primary btn-sm" onclick="promptLoadSchedule('${ss.id}')">Load</button>
          <button class="btn btn-ghost btn-sm" onclick="deleteSchedulePrompt('${ss.id}')">🗑️</button>
        </div>
      </div>`;
    }).join('');
}

function promptLoadSchedule(id) {
    const ss = savedSchedules.find(s => s.id === id);
    if (!ss) return;
    pendingLoad = ss;
    document.getElementById('loadScheduleDetail').textContent = ss.label;
    // Pre-fill date picker with today so the user just changes it if needed
    const todayISO = new Date().toISOString().slice(0, 10);
    document.getElementById('loadTargetWeek').value = todayISO;
    openModal('loadScheduleModal');
}

document.getElementById('confirmLoadBtn').addEventListener('click', async () => {
    if (!pendingLoad) return;

    // Read the user-chosen target date and derive the Monday of that week
    const targetDateVal = document.getElementById('loadTargetWeek').value;
    if (!targetDateVal) {
        showToast('Please select a week to load the schedule into.', 'error');
        return;
    }

    closeModal('loadScheduleModal');

    const ss = pendingLoad;
    pendingLoad = null;

    // Derive the Monday of the chosen target week
    // Use local date parsing (YYYY-MM-DD) to avoid timezone offset issues
    const [yr, mo, dy] = targetDateVal.split('-').map(Number);
    const targetMonday = toMonday(new Date(yr, mo - 1, dy));

    // Navigate the schedule view to that week
    currentWeekStart = targetMonday;
    updateWeekLabel();

    // Remove any existing shifts already in the target week
    const toRemove = shifts.filter(s => {
        const ws = toMonday(new Date(s.weekStart));
        return ws.getTime() === targetMonday.getTime();
    });
    for (const s of toRemove) await dbDelete('shifts', s.id);
    shifts = shifts.filter(s => !toRemove.find(r => r.id === s.id));

    // Insert the saved shifts with new IDs, stamped to the target week
    for (const orig of ss.shifts) {
        const newShift = { ...orig, id: uid(), weekStart: targetMonday.toISOString() };
        await dbPut('shifts', newShift);
        shifts.push(newShift);
    }

    setView('schedule');
    const targetLabel = `${formatDate(targetMonday)} – ${formatDate(addDays(targetMonday, 6))}`;
    showToast(`Schedule loaded into week of ${targetLabel}`, 'success');
});

function deleteSchedulePrompt(id) {
    showConfirm('Delete Saved Schedule', 'This cannot be undone. Continue?', async () => {
        await dbDelete('savedSchedules', id);
        savedSchedules = savedSchedules.filter(ss => ss.id !== id);
        renderHistory();
        showToast('Saved schedule deleted.', 'success');
    });
}

window.promptLoadSchedule = promptLoadSchedule;
window.deleteSchedulePrompt = deleteSchedulePrompt;

/* ─── Employee Management ────────────────────────────────────────────── */
function renderEmployeeGrid() {
    const grid = document.getElementById('employeeGrid');
    if (employees.length === 0) {
        grid.innerHTML = `<div class="no-employees-msg" style="grid-column:1/-1">
      <div class="big-icon">👤</div>
      <p>No employees yet. Click <strong>Add Employee</strong> to get started.</p>
    </div>`;
        return;
    }
    grid.innerHTML = employees.map(emp => {
        const badges = emp.positions.map(p => {
            const c = positionColor(p);
            return `<span class="position-badge" style="background:${c}22;color:${c};border:1px solid ${c}55">${escHtml(p)}</span>`;
        }).join('');
        return `
      <div class="employee-card">
        <div class="emp-card-avatar">${initials(emp.name)}</div>
        <div class="emp-card-info">
          <div class="emp-card-name">${escHtml(emp.name)}</div>
          <div class="emp-card-email">${escHtml(emp.email || 'No email')}</div>
          <div class="emp-card-positions">${badges}</div>
        </div>
        <div class="emp-card-actions">
          <button class="btn-icon" title="Edit" onclick="openEditEmployee('${emp.id}')">✏️</button>
          <button class="btn-icon danger" title="Delete" onclick="deleteEmployeePrompt('${emp.id}')">🗑️</button>
        </div>
      </div>`;
    }).join('');
}

document.getElementById('addEmployeeBtn').addEventListener('click', () => {
    openEmployeeModal(null);
});

function openEmployeeModal(empId) {
    const emp = empId ? employees.find(e => e.id === empId) : null;
    document.getElementById('empModalTitle').textContent = emp ? 'Edit Employee' : 'Add Employee';
    document.getElementById('empId').value = emp ? emp.id : '';
    document.getElementById('empName').value = emp ? emp.name : '';
    document.getElementById('empEmail').value = emp ? (emp.email || '') : '';
    renderPositionCheckboxes(emp ? emp.positions : []);
    openModal('employeeModal');
}

function renderPositionCheckboxes(selected = []) {
    const wrap = document.getElementById('positionCheckboxes');
    wrap.innerHTML = customPositions.map(p => {
        const isChecked = selected.includes(p);
        return `
      <label class="pos-check-label ${isChecked ? 'checked' : ''}">
        <input type="checkbox" value="${escHtml(p)}" ${isChecked ? 'checked' : ''} onchange="togglePosCheck(this)"/>
        ${escHtml(p)}
      </label>`;
    }).join('');
}

function togglePosCheck(cb) {
    cb.closest('.pos-check-label').classList.toggle('checked', cb.checked);
}
window.togglePosCheck = togglePosCheck;

document.getElementById('addCustomPositionBtn').addEventListener('click', () => {
    const input = document.getElementById('customPositionInput');
    const val = input.value.trim();
    if (!val) return;
    if (customPositions.includes(val)) { showToast('Position already exists.', 'error'); return; }
    customPositions.push(val);
    input.value = '';
    // Add checkbox and check it
    const wrap = document.getElementById('positionCheckboxes');
    const label = document.createElement('label');
    label.className = 'pos-check-label checked';
    label.innerHTML = `<input type="checkbox" value="${escHtml(val)}" checked onchange="togglePosCheck(this)"/>${escHtml(val)}`;
    wrap.appendChild(label);
});

document.getElementById('saveEmployeeBtn').addEventListener('click', async () => {
    const id = document.getElementById('empId').value;
    const name = document.getElementById('empName').value.trim();
    const email = document.getElementById('empEmail').value.trim();

    if (!name) { showToast('Employee name is required.', 'error'); return; }

    const checked = [...document.querySelectorAll('#positionCheckboxes input:checked')];
    const positions = checked.map(cb => cb.value);
    if (positions.length === 0) { showToast('Select at least one position.', 'error'); return; }

    const emp = { id: id || uid(), name, email, positions };
    await dbPut('employees', emp);

    if (id) {
        const idx = employees.findIndex(e => e.id === id);
        employees[idx] = emp;
    } else {
        employees.push(emp);
    }

    closeModal('employeeModal');
    renderEmployeeGrid();
    showToast(id ? 'Employee updated.' : 'Employee added.', 'success');
});

function openEditEmployee(id) { openEmployeeModal(id); }
window.openEditEmployee = openEditEmployee;

function deleteEmployeePrompt(id) {
    const emp = employees.find(e => e.id === id);
    showConfirm('Delete Employee', `Remove "${emp?.name}" and all their shifts?`, async () => {
        // Remove all shifts for this employee
        const empShifts = shifts.filter(s => s.employeeId === id);
        for (const s of empShifts) await dbDelete('shifts', s.id);
        shifts = shifts.filter(s => s.employeeId !== id);

        await dbDelete('employees', id);
        employees = employees.filter(e => e.id !== id);

        renderEmployeeGrid();
        showToast('Employee removed.', 'success');
    });
}
window.deleteEmployeePrompt = deleteEmployeePrompt;

/* ─── PDF Export ─────────────────────────────────────────────────────── */
document.getElementById('downloadPdfBtn').addEventListener('click', () => {
    generatePDF();
});

function generatePDF() {
    if (typeof window.jspdf === 'undefined' && typeof jsPDF === 'undefined') {
        showToast('PDF library not loaded. Please ensure libs/jspdf.umd.min.js is present.', 'error');
        return;
    }

    const J = window.jspdf ? window.jspdf.jsPDF : jsPDF;
    const doc = new J({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const pageW = 297, pageH = 210;
    const margin = 12;
    const colW = (pageW - margin * 2 - 50) / 7;  // 7 day columns
    const empColW = 50;
    const rowH = 9;
    const headerH = 14;

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 33, 48);
    const end = addDays(currentWeekStart, 6);
    doc.text(`Weekly Schedule: ${formatDate(currentWeekStart)} – ${formatDate(end)}`, margin, margin + 6);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Generated ${new Date().toLocaleString()}`, margin, margin + 11);

    // Header row
    const tableTop = margin + 18;
    doc.setFillColor(15, 17, 23);
    doc.rect(margin, tableTop, empColW + colW * 7, headerH, 'F');

    doc.setTextColor(232, 234, 240);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Employee', margin + 3, tableTop + 9);

    for (let i = 0; i < 7; i++) {
        const day = addDays(currentWeekStart, i);
        const x = margin + empColW + colW * i;
        doc.text(
            `${DAY_SHORT[day.getDay()]} ${day.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}`,
            x + colW / 2, tableTop + 9, { align: 'center' }
        );
    }

    // Rows
    let y = tableTop + headerH;
    doc.setTextColor(30, 33, 48);

    employees.forEach((emp, eIdx) => {
        const empShiftsByDay = [];
        let maxShifts = 1;
        for (let i = 0; i < 7; i++) {
            const dayDate = addDays(currentWeekStart, i);
            const dayIdx = dayDate.getDay();
            const dayShifts = shifts.filter(s => s.employeeId === emp.id && s.day === dayIdx && isSameWeek(s));
            empShiftsByDay.push(dayShifts);
            if (dayShifts.length > maxShifts) maxShifts = dayShifts.length;
        }

        const rowHeight = Math.max(rowH, maxShifts * 8 + 4);

        // Row background
        if (eIdx % 2 === 0) {
            doc.setFillColor(243, 244, 248);
        } else {
            doc.setFillColor(255, 255, 255);
        }
        doc.rect(margin, y, empColW + colW * 7, rowHeight, 'F');

        // Employee name cell
        doc.setFillColor(22, 24, 32);
        doc.rect(margin, y, empColW, rowHeight, 'F');
        doc.setTextColor(232, 234, 240);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');

        // Truncate name for PDF
        const shortName = emp.name.length > 18 ? emp.name.slice(0, 16) + '…' : emp.name;
        doc.text(shortName, margin + 3, y + 6);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(107, 120, 144);
        const rolesStr = emp.positions.join(', ');
        const shortRoles = rolesStr.length > 24 ? rolesStr.slice(0, 22) + '…' : rolesStr;
        doc.text(shortRoles, margin + 3, y + 11);

        // Day cells
        doc.setTextColor(30, 33, 48);
        for (let i = 0; i < 7; i++) {
            const x = margin + empColW + colW * i;
            const cellShifts = empShiftsByDay[i];

            cellShifts.forEach((shift, sIdx) => {
                const sy = y + 4 + sIdx * 8;
                doc.setFontSize(7.5);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(50, 50, 50);
                doc.text(`${formatTime(shift.start)}–${formatTime(shift.end)}`, x + 2, sy);
                doc.setFontSize(6.5);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(100, 100, 100);
                doc.text(shift.position, x + 2, sy + 4);
            });
        }

        // Grid lines
        doc.setDrawColor(220, 220, 228);
        doc.setLineWidth(0.2);
        // Vertical lines
        for (let i = 0; i <= 7; i++) {
            const lx = margin + empColW + colW * i;
            doc.line(lx, y, lx, y + rowHeight);
        }
        doc.line(margin, y, margin, y + rowHeight);
        doc.line(margin + empColW + colW * 7, y, margin + empColW + colW * 7, y + rowHeight);
        // Bottom
        doc.line(margin, y + rowHeight, margin + empColW + colW * 7, y + rowHeight);

        y += rowHeight;

        // Page break
        if (y + rowH > pageH - margin && eIdx < employees.length - 1) {
            doc.addPage();
            y = margin + 10;
        }
    });

    // Outer border
    doc.setDrawColor(15, 17, 23);
    doc.setLineWidth(0.5);

    const filename = `schedule_${currentWeekStart.toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
    showToast('PDF downloaded!', 'success');
}

/* ─── Bootstrap ──────────────────────────────────────────────────────── */
async function init() {
    db = await openDB();

    [employees, shifts, savedSchedules] = await Promise.all([
        dbGetAll('employees'),
        dbGetAll('shifts'),
        dbGetAll('savedSchedules')
    ]);

    // Build global positions list from existing employees
    employees.forEach(e => {
        e.positions.forEach(p => {
            if (!customPositions.includes(p)) customPositions.push(p);
        });
    });

    // Sort saved schedules newest first
    savedSchedules.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

    // Set current week
    currentWeekStart = toMonday(new Date());
    updateWeekLabel();

    setView('schedule');
}

init().catch(err => {
    console.error('RestaurantOS init error:', err);
    document.body.innerHTML = `<div style="padding:40px;font-family:sans-serif;color:red">
    <h2>App failed to start</h2><p>${err.message}</p>
  </div>`;
});
