'use strict';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DEFAULT_POSITIONS = ['Server', 'Busser', 'Host', 'Bartender', 'Kitchen', 'Expo', 'To-Go', 'Manager'];

// ─── STATE ────────────────────────────────────────────────────────────────────
let state = {
    currentWeekStart: getMondayOfCurrentWeek(),
    employees: [],
    shifts: [],
    savedSchedules: [],
    gmailConnected: false,
    gmailConfigured: false,
    customPositions: [],
    selectedSavedScheduleId: null,
};

// ─── DATE UTILITIES ───────────────────────────────────────────────────────────

function getMondayOfCurrentWeek() {
    const now = new Date();
    const day = now.getDay(); // 0=Sun, 1=Mon, ...
    const diff = (day === 0 ? -6 : 1 - day);
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    return toDateString(monday);
}

function toDateString(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function addDays(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return toDateString(d);
}

function formatDateShort(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateLong(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    const suffix = hour >= 12 ? 'pm' : 'am';
    const displayH = hour % 12 || 12;
    return `${displayH}:${m}${suffix}`;
}

// ─── API HELPERS ──────────────────────────────────────────────────────────────

async function api(method, path, body) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

// ─── TOAST ────────────────────────────────────────────────────────────────────

function showToast(msg, type = 'info', duration = 3500) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    toast.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(1rem)';
        toast.style.transition = '0.3s';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ─── MODAL HELPERS ────────────────────────────────────────────────────────────

function openModal(id) {
    document.getElementById(id).classList.add('open');
}
function closeModal(id) {
    document.getElementById(id).classList.remove('open');
}

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.classList.remove('open');
    });
});

// ─── WEEK NAVIGATION ──────────────────────────────────────────────────────────

function updateWeekLabel() {
    const end = addDays(state.currentWeekStart, 6);
    document.getElementById('weekLabel').textContent =
        `${formatDateShort(state.currentWeekStart)} – ${formatDateShort(end)}`;
    document.getElementById('weekSub').textContent =
        `Week of ${formatDateLong(state.currentWeekStart)}`;
}

document.getElementById('prevWeekBtn').addEventListener('click', () => {
    state.currentWeekStart = addDays(state.currentWeekStart, -7);
    loadWeek();
});
document.getElementById('nextWeekBtn').addEventListener('click', () => {
    state.currentWeekStart = addDays(state.currentWeekStart, 7);
    loadWeek();
});

// ─── LOAD WEEK DATA ───────────────────────────────────────────────────────────

async function loadWeek() {
    updateWeekLabel();
    try {
        [state.employees, state.shifts] = await Promise.all([
            api('GET', '/api/employees'),
            api('GET', `/api/shifts?weekStart=${state.currentWeekStart}`),
        ]);
        renderSidebar();
        renderGrid();
    } catch (err) {
        showToast('Failed to load schedule: ' + err.message, 'error');
    }
}

// ─── GMAIL STATUS ─────────────────────────────────────────────────────────────

async function checkGmailStatus() {
    try {
        const status = await api('GET', '/auth/gmail/status');
        state.gmailConnected = status.connected;
        state.gmailConfigured = status.configured;
        updateGmailUI();
    } catch (_) { }
}

function updateGmailUI() {
    const btn = document.getElementById('gmailBtn');
    const text = document.getElementById('gmailBtnText');
    const sendBtn = document.getElementById('sendOutBtn');

    if (!state.gmailConfigured) {
        text.textContent = 'Gmail Not Setup';
        btn.title = 'Add GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET to .env';
        btn.disabled = true;
        sendBtn.style.display = 'none';
        return;
    }

    btn.disabled = false;
    if (state.gmailConnected) {
        text.textContent = 'Gmail Connected ✓';
        btn.classList.remove('btn-gmail');
        btn.classList.add('btn-ghost');
        sendBtn.style.display = 'inline-flex';
    } else {
        text.textContent = 'Connect Gmail';
        btn.classList.add('btn-gmail');
        btn.classList.remove('btn-ghost');
        sendBtn.style.display = 'none';
    }
}

document.getElementById('gmailBtn').addEventListener('click', () => {
    if (state.gmailConnected) {
        if (confirm('Disconnect Gmail account?')) {
            api('POST', '/auth/gmail/disconnect').then(() => {
                state.gmailConnected = false;
                updateGmailUI();
                showToast('Gmail disconnected', 'info');
            });
        }
    } else {
        window.open('/auth/gmail', 'gmailAuth', 'width=500,height=650');
        const timer = setInterval(() => {
            checkGmailStatus().then(() => {
                if (state.gmailConnected) clearInterval(timer);
            });
        }, 2000);
        setTimeout(() => clearInterval(timer), 120000);
    }
});

// ─── SIDEBAR RENDERING ────────────────────────────────────────────────────────

function renderSidebar() {
    const list = document.getElementById('employeeList');
    if (state.employees.length === 0) {
        list.innerHTML = '<div class="empty-state"><span>👥</span><span>No employees yet.<br>Click "+ Add" to get started.</span></div>';
        return;
    }
    list.innerHTML = state.employees.map(emp => `
    <div class="employee-card" data-id="${emp.id}">
      <div class="employee-name">${escHtml(emp.name)}</div>
      <div class="employee-tags">${(emp.positions || []).map(p =>
        `<span class="position-tag">${escHtml(p)}</span>`
    ).join('')}</div>
      <div class="employee-email">${escHtml(emp.email)}</div>
      <div class="employee-actions">
        <button class="emp-action-btn" onclick="openEditEmployee(${emp.id})">Edit</button>
        <button class="emp-action-btn delete" onclick="confirmDeleteEmployee(${emp.id})">Delete</button>
      </div>
    </div>
  `).join('');
}

// ─── SCHEDULE GRID RENDERING ──────────────────────────────────────────────────

function renderGrid() {
    const grid = document.getElementById('scheduleGrid');

    if (state.employees.length === 0) {
        grid.style.gridTemplateColumns = '1fr';
        grid.innerHTML = '<div class="empty-grid-msg">Add employees to start building your schedule.</div>';
        return;
    }

    // 8 columns: name + 7 days
    grid.style.gridTemplateColumns = `160px repeat(7, 1fr)`;

    let html = '';

    // ── Header row ──
    html += '<div class="grid-header-cell name-col">Employee</div>';
    for (let d = 0; d < 7; d++) {
        const dayDate = addDays(state.currentWeekStart, d);
        html += `
      <div class="grid-header-cell">
        <span class="day-header-name">${DAYS[d]}</span>
        <span class="day-header-date">${formatDateShort(dayDate)}</span>
        <div class="day-header-accent day-accent-${d}"></div>
      </div>
    `;
    }

    // ── Employee rows ──
    for (const emp of state.employees) {
        html += `
      <div class="grid-name-cell">
        <span class="emp-name">${escHtml(emp.name)}</span>
        <span class="emp-pos">${(emp.positions || []).join(', ')}</span>
      </div>
    `;

        for (let d = 0; d < 7; d++) {
            const dayShifts = state.shifts.filter(s => s.employee_id === emp.id && s.day_of_week === d);
            html += `<div class="grid-cell day-${d}">`;
            for (const shift of dayShifts) {
                html += `
          <div class="shift-chip" onclick="openEditShift(${shift.id})" title="Click to edit">
            <span class="chip-position">${escHtml(shift.position)}</span>
            <span class="chip-time">${formatTime(shift.start_time)} – ${formatTime(shift.end_time)}</span>
          </div>
        `;
            }
            html += `<button class="add-shift-btn" onclick="openAddShift(${emp.id}, ${d})">+ Add Shift</button>`;
            html += '</div>';
        }
    }

    grid.innerHTML = html;
}

// ─── EMPLOYEE MODAL ───────────────────────────────────────────────────────────

function getAllPositions() {
    return [...new Set([...DEFAULT_POSITIONS, ...state.customPositions])];
}

function renderPositionsGrid(selected = []) {
    const grid = document.getElementById('positionsGrid');
    const positions = getAllPositions();
    grid.innerHTML = positions.map(pos => {
        const checked = selected.includes(pos);
        return `
      <label class="pos-checkbox-label ${checked ? 'checked' : ''}" data-pos="${escHtml(pos)}">
        <input type="checkbox" value="${escHtml(pos)}" ${checked ? 'checked' : ''}
          onchange="this.closest('label').classList.toggle('checked', this.checked)">
        ${escHtml(pos)}
      </label>
    `;
    }).join('');
}

function getSelectedPositions() {
    return [...document.querySelectorAll('#positionsGrid input[type="checkbox"]:checked')]
        .map(cb => cb.value);
}

document.getElementById('addCustomPositionBtn').addEventListener('click', () => {
    const input = document.getElementById('customPositionInput');
    const val = input.value.trim();
    if (!val) return;
    if (!state.customPositions.includes(val) && !DEFAULT_POSITIONS.includes(val)) {
        state.customPositions.push(val);
    }
    const existing = getSelectedPositions();
    renderPositionsGrid([...existing, val]);
    updateShiftPositionSelect();
    input.value = '';
});

document.getElementById('customPositionInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('addCustomPositionBtn').click();
});

document.getElementById('addEmployeeBtn').addEventListener('click', () => {
    document.getElementById('employeeModalTitle').textContent = 'Add Employee';
    document.getElementById('employeeId').value = '';
    document.getElementById('empName').value = '';
    document.getElementById('empEmail').value = '';
    renderPositionsGrid([]);
    openModal('employeeModal');
});

window.openEditEmployee = (id) => {
    const emp = state.employees.find(e => e.id === id);
    if (!emp) return;
    document.getElementById('employeeModalTitle').textContent = 'Edit Employee';
    document.getElementById('employeeId').value = emp.id;
    document.getElementById('empName').value = emp.name;
    document.getElementById('empEmail').value = emp.email;
    // Add any positions from this employee not in defaults
    (emp.positions || []).forEach(p => {
        if (!DEFAULT_POSITIONS.includes(p) && !state.customPositions.includes(p)) {
            state.customPositions.push(p);
        }
    });
    renderPositionsGrid(emp.positions || []);
    openModal('employeeModal');
};

document.getElementById('closeEmployeeModal').addEventListener('click', () => closeModal('employeeModal'));
document.getElementById('cancelEmployeeModal').addEventListener('click', () => closeModal('employeeModal'));

document.getElementById('saveEmployeeBtn').addEventListener('click', async () => {
    const id = document.getElementById('employeeId').value;
    const name = document.getElementById('empName').value.trim();
    const email = document.getElementById('empEmail').value.trim();
    const positions = getSelectedPositions();

    if (!name || !email) { showToast('Name and email are required', 'error'); return; }
    if (positions.length === 0) { showToast('Select at least one position', 'error'); return; }

    try {
        if (id) {
            await api('PUT', `/api/employees/${id}`, { name, positions, email });
            showToast('Employee updated', 'success');
        } else {
            await api('POST', '/api/employees', { name, positions, email });
            showToast('Employee added', 'success');
        }
        closeModal('employeeModal');
        loadWeek();
    } catch (err) {
        showToast(err.message, 'error');
    }
});

window.confirmDeleteEmployee = (id) => {
    const emp = state.employees.find(e => e.id === id);
    if (!emp) return;
    if (confirm(`Delete "${emp.name}"? This will also remove all their shifts.`)) {
        api('DELETE', `/api/employees/${id}`)
            .then(() => { showToast('Employee deleted', 'success'); loadWeek(); })
            .catch(err => showToast(err.message, 'error'));
    }
};

// ─── SHIFT MODAL ──────────────────────────────────────────────────────────────

function updateShiftPositionSelect() {
    const sel = document.getElementById('shiftPosition');
    const current = sel.value;
    const positions = getAllPositions();
    sel.innerHTML = '<option value="">Select position...</option>' +
        positions.map(p => `<option value="${escHtml(p)}" ${p === current ? 'selected' : ''}>${escHtml(p)}</option>`).join('');
}

window.openAddShift = (employeeId, dayOfWeek) => {
    const emp = state.employees.find(e => e.id === employeeId);
    if (!emp) return;

    document.getElementById('shiftModalTitle').textContent = 'Add Shift';
    document.getElementById('shiftId').value = '';
    document.getElementById('shiftEmployeeId').value = employeeId;
    document.getElementById('shiftDayOfWeek').value = dayOfWeek;
    document.getElementById('shiftStart').value = '09:00';
    document.getElementById('shiftEnd').value = '17:00';
    document.getElementById('shiftEmployeeInfo').innerHTML =
        `<strong>${escHtml(emp.name)}</strong> — ${DAYS[dayOfWeek]}, ${formatDateShort(addDays(state.currentWeekStart, dayOfWeek))}`;

    // Pre-populate position options from employee's positions
    const empPositions = emp.positions || [];
    const allPositions = [...new Set([...DEFAULT_POSITIONS, ...state.customPositions, ...empPositions])];
    const sel = document.getElementById('shiftPosition');
    sel.innerHTML = '<option value="">Select position...</option>' +
        allPositions.map(p =>
            `<option value="${escHtml(p)}">${escHtml(p)}</option>`
        ).join('');
    if (empPositions.length === 1) sel.value = empPositions[0];

    document.getElementById('deleteShiftBtn').style.display = 'none';
    openModal('shiftModal');
};

window.openEditShift = (shiftId) => {
    const shift = state.shifts.find(s => s.id === shiftId);
    if (!shift) return;
    const emp = state.employees.find(e => e.id === shift.employee_id);

    document.getElementById('shiftModalTitle').textContent = 'Edit Shift';
    document.getElementById('shiftId').value = shiftId;
    document.getElementById('shiftEmployeeId').value = shift.employee_id;
    document.getElementById('shiftDayOfWeek').value = shift.day_of_week;
    document.getElementById('shiftStart').value = shift.start_time;
    document.getElementById('shiftEnd').value = shift.end_time;
    document.getElementById('shiftEmployeeInfo').innerHTML =
        `<strong>${escHtml(emp ? emp.name : 'Employee')}</strong> — ${DAYS[shift.day_of_week]}, ${formatDateShort(addDays(state.currentWeekStart, shift.day_of_week))}`;

    const empPositions = emp ? (emp.positions || []) : [];
    const allPositions = [...new Set([...DEFAULT_POSITIONS, ...state.customPositions, ...empPositions, shift.position])];
    const sel = document.getElementById('shiftPosition');
    sel.innerHTML = '<option value="">Select position...</option>' +
        allPositions.map(p =>
            `<option value="${escHtml(p)}" ${p === shift.position ? 'selected' : ''}>${escHtml(p)}</option>`
        ).join('');

    document.getElementById('deleteShiftBtn').style.display = 'inline-flex';
    openModal('shiftModal');
};

document.getElementById('closeShiftModal').addEventListener('click', () => closeModal('shiftModal'));
document.getElementById('cancelShiftModal').addEventListener('click', () => closeModal('shiftModal'));

document.getElementById('saveShiftBtn').addEventListener('click', async () => {
    const id = document.getElementById('shiftId').value;
    const employeeId = document.getElementById('shiftEmployeeId').value;
    const dayOfWeek = parseInt(document.getElementById('shiftDayOfWeek').value);
    const startTime = document.getElementById('shiftStart').value;
    const endTime = document.getElementById('shiftEnd').value;
    const position = document.getElementById('shiftPosition').value;

    if (!startTime || !endTime || !position) { showToast('All fields are required', 'error'); return; }
    if (startTime >= endTime) { showToast('End time must be after start time', 'error'); return; }

    try {
        if (id) {
            await api('PUT', `/api/shifts/${id}`, { dayOfWeek, startTime, endTime, position });
            showToast('Shift updated', 'success');
        } else {
            await api('POST', '/api/shifts', {
                employeeId: parseInt(employeeId), weekStart: state.currentWeekStart,
                dayOfWeek, startTime, endTime, position,
            });
            showToast('Shift added', 'success');
        }
        closeModal('shiftModal');
        loadWeek();
    } catch (err) {
        showToast(err.message, 'error');
    }
});

document.getElementById('deleteShiftBtn').addEventListener('click', async () => {
    const id = document.getElementById('shiftId').value;
    if (!id || !confirm('Delete this shift?')) return;
    try {
        await api('DELETE', `/api/shifts/${id}`);
        showToast('Shift deleted', 'success');
        closeModal('shiftModal');
        loadWeek();
    } catch (err) {
        showToast(err.message, 'error');
    }
});

// ─── SAVE SCHEDULE MODAL ──────────────────────────────────────────────────────

document.getElementById('saveScheduleBtn').addEventListener('click', () => {
    if (state.shifts.length === 0) { showToast('No shifts to save this week', 'error'); return; }
    document.getElementById('scheduleName').value = '';
    openModal('saveScheduleModal');
});
document.getElementById('closeSaveModal').addEventListener('click', () => closeModal('saveScheduleModal'));
document.getElementById('cancelSaveModal').addEventListener('click', () => closeModal('saveScheduleModal'));

document.getElementById('confirmSaveBtn').addEventListener('click', async () => {
    const name = document.getElementById('scheduleName').value.trim();
    if (!name) { showToast('Please enter a schedule name', 'error'); return; }
    try {
        await api('POST', '/api/saved-schedules', { name, weekStart: state.currentWeekStart });
        showToast(`Schedule "${name}" saved!`, 'success');
        closeModal('saveScheduleModal');
        loadSavedSchedules();
    } catch (err) {
        showToast(err.message, 'error');
    }
});

// ─── LOAD SCHEDULE MODAL ──────────────────────────────────────────────────────

async function loadSavedSchedules() {
    try {
        state.savedSchedules = await api('GET', '/api/saved-schedules');
    } catch (_) { }
}

document.getElementById('loadScheduleBtn').addEventListener('click', async () => {
    await loadSavedSchedules();
    state.selectedSavedScheduleId = null;
    renderSavedSchedulesList();
    document.getElementById('loadTargetGroup').style.display = 'none';
    document.getElementById('confirmLoadBtn').style.display = 'none';
    document.getElementById('loadTargetWeek').value = state.currentWeekStart;
    openModal('loadScheduleModal');
});

function renderSavedSchedulesList() {
    const list = document.getElementById('savedSchedulesList');
    if (state.savedSchedules.length === 0) {
        list.innerHTML = '<div class="empty-state">No saved schedules yet.</div>';
        return;
    }
    list.innerHTML = state.savedSchedules.map(s => `
    <div class="saved-schedule-item ${state.selectedSavedScheduleId === s.id ? 'selected' : ''}"
         onclick="selectSavedSchedule(${s.id})">
      <div>
        <div class="saved-schedule-item-name">${escHtml(s.name)}</div>
        <div class="saved-schedule-item-meta">Week of ${formatDateShort(s.week_start)} &bull; Saved ${new Date(s.created_at).toLocaleDateString()}</div>
      </div>
      <button class="saved-schedule-delete-btn" onclick="event.stopPropagation(); deleteSavedSchedule(${s.id})" title="Delete this saved schedule">✕</button>
    </div>
  `).join('');
}

window.selectSavedSchedule = (id) => {
    state.selectedSavedScheduleId = id;
    renderSavedSchedulesList();
    document.getElementById('loadTargetGroup').style.display = 'block';
    document.getElementById('confirmLoadBtn').style.display = 'inline-flex';
};

window.deleteSavedSchedule = async (id) => {
    if (!confirm('Delete this saved schedule?')) return;
    try {
        await api('DELETE', `/api/saved-schedules/${id}`);
        await loadSavedSchedules();
        if (state.selectedSavedScheduleId === id) {
            state.selectedSavedScheduleId = null;
            document.getElementById('loadTargetGroup').style.display = 'none';
            document.getElementById('confirmLoadBtn').style.display = 'none';
        }
        renderSavedSchedulesList();
        showToast('Saved schedule deleted', 'info');
    } catch (err) { showToast(err.message, 'error'); }
};

document.getElementById('closeLoadModal').addEventListener('click', () => closeModal('loadScheduleModal'));
document.getElementById('cancelLoadModal').addEventListener('click', () => closeModal('loadScheduleModal'));

document.getElementById('confirmLoadBtn').addEventListener('click', async () => {
    const targetWeekStart = document.getElementById('loadTargetWeek').value;
    if (!targetWeekStart) { showToast('Select a target week', 'error'); return; }
    if (!state.selectedSavedScheduleId) { showToast('Select a saved schedule first', 'error'); return; }

    // Normalize targetWeekStart to Monday
    const d = new Date(targetWeekStart + 'T00:00:00');
    const dow = d.getDay();
    const offset = dow === 0 ? -6 : 1 - dow;
    d.setDate(d.getDate() + offset);
    const monday = toDateString(d);

    try {
        const result = await api('POST', `/api/saved-schedules/${state.selectedSavedScheduleId}/load`, {
            targetWeekStart: monday,
        });
        showToast(`Loaded ${result.shiftsLoaded} shifts into week of ${formatDateShort(monday)}`, 'success');
        closeModal('loadScheduleModal');
        state.currentWeekStart = monday;
        loadWeek();
    } catch (err) { showToast(err.message, 'error'); }
});

// ─── PDF DOWNLOAD ─────────────────────────────────────────────────────────────

document.getElementById('downloadPdfBtn').addEventListener('click', () => {
    const url = `/api/pdf?weekStart=${state.currentWeekStart}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `schedule_${state.currentWeekStart}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Downloading PDF...', 'info');
});

// ─── SEND EMAIL MODAL ─────────────────────────────────────────────────────────

document.getElementById('sendOutBtn').addEventListener('click', () => {
    const list = document.getElementById('recipientList');
    document.getElementById('sendResult').style.display = 'none';

    if (state.employees.length === 0) {
        showToast('No employees to email', 'error');
        return;
    }

    list.innerHTML = state.employees.map(emp => `
    <div class="recipient-row" data-id="${emp.id}">
      <span class="rname">${escHtml(emp.name)}</span>
      <span class="remail">${escHtml(emp.email)}</span>
      <span class="recipient-status status-pending">Pending</span>
    </div>
  `).join('');

    openModal('sendEmailModal');
});
document.getElementById('closeSendModal').addEventListener('click', () => closeModal('sendEmailModal'));
document.getElementById('cancelSendModal').addEventListener('click', () => closeModal('sendEmailModal'));

document.getElementById('confirmSendBtn').addEventListener('click', async () => {
    const btn = document.getElementById('confirmSendBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Sending...';

    try {
        const result = await api('POST', '/api/email/send', { weekStart: state.currentWeekStart });
        const rows = document.querySelectorAll('.recipient-row');
        result.results.forEach(r => {
            rows.forEach(row => {
                const nameEl = row.querySelector('.rname');
                if (nameEl && nameEl.textContent === r.name) {
                    const statusEl = row.querySelector('.recipient-status');
                    statusEl.className = `recipient-status ${r.status === 'sent' ? 'status-sent' : 'status-failed'}`;
                    statusEl.textContent = r.status === 'sent' ? 'Sent ✓' : 'Failed';
                }
            });
        });

        const sentCount = result.results.filter(r => r.status === 'sent').length;
        const failCount = result.results.filter(r => r.status === 'failed').length;
        const resultEl = document.getElementById('sendResult');
        resultEl.style.display = 'block';
        resultEl.className = `send-result ${failCount === 0 ? 'success' : 'error'}`;
        resultEl.textContent = failCount === 0
            ? `✓ Successfully sent to all ${sentCount} employee(s).`
            : `Sent: ${sentCount} | Failed: ${failCount}. Check server logs for details.`;

        showToast(`Emails sent to ${sentCount} employee(s)`, sentCount > 0 ? 'success' : 'error');
    } catch (err) {
        const resultEl = document.getElementById('sendResult');
        resultEl.style.display = 'block';
        resultEl.className = 'send-result error';
        resultEl.textContent = '✕ ' + err.message;
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send Emails';
    }
});

// ─── UTILS ────────────────────────────────────────────────────────────────────

function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

async function init() {
    await loadWeek();
    await checkGmailStatus();
    await loadSavedSchedules();

    // Poll Gmail status every 30s
    setInterval(checkGmailStatus, 30000);
}

init();
