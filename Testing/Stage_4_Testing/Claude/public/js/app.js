/* ============================================================
   Restaurant Scheduler - Complete Frontend Application
   ============================================================ */

'use strict';

// ---- State ----
let currentUser = null;
let currentWeekStart = null;       // ISO date string "YYYY-MM-DD"
let currentSchedule = null;        // {id, week_start, is_saved, shifts:[]}
let employees = [];                // array of employee objects
let editingShiftCell = null;       // {employeeId, dayOfWeek} for add modal
let editingShiftId = null;         // id of shift being edited
let editingEmployeeId = null;      // id of employee being edited
let pendingDeleteFn = null;        // callback for confirm modal
let currentTimeoffFilter = 'all';  // filter for time-off requests
let employeeCurrentWeekStart = null; // for employee schedule navigation

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Returns the Sunday of the week containing the given date as "YYYY-MM-DD"
 */
function getWeekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  return toISODateString(d);
}

/**
 * Format "YYYY-MM-DD" to "Jan 15, 2024"
 */
function formatDate(dateStr) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [year, month, day] = dateStr.split('-').map(Number);
  return `${months[month - 1]} ${day}, ${year}`;
}

/**
 * Format "YYYY-MM-DD" to "January 15, 2024"
 */
function formatDateLong(dateStr) {
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const [year, month, day] = dateStr.split('-').map(Number);
  return `${months[month - 1]} ${day}, ${year}`;
}

/**
 * Convert "14:00" to "2:00 PM"
 */
function formatTime(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Calculate decimal hours between two HH:MM times
 */
function calculateHours(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin < startMin) endMin += 24 * 60; // overnight
  return (endMin - startMin) / 60;
}

/**
 * Convert a Date to "YYYY-MM-DD"
 */
function toISODateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Add days to a date string, return new date string
 */
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toISODateString(d);
}

/**
 * Show a toast notification
 * @param {string} message
 * @param {string} type - 'success'|'error'|'warning'|'info'
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const icons = { success: '✓', error: '✗', warning: '⚠', info: 'ℹ' };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    toast.addEventListener('animationend', () => toast.remove());
  }, 3500);
}

/**
 * Show/hide loading overlay
 */
function setLoading(visible) {
  const overlay = document.getElementById('loading-overlay');
  if (visible) {
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
  }
}

/**
 * Fetch wrapper: handles JSON, auth errors
 */
async function api(method, path, body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  };
  if (body !== null) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(path, options);

  if (response.status === 401) {
    // Verify the session is truly gone before forcing a logout
    try {
      const check = await fetch('/api/auth/me', { credentials: 'include' });
      if (!check.ok) {
        currentUser = null;
        showLogin();
        throw new Error('Session expired. Please log in again.');
      }
      // Session is still valid — re-throw a generic auth error without logging out
      throw new Error('Authorization error. Please try again.');
    } catch (innerErr) {
      if (innerErr.message === 'Session expired. Please log in again.' ||
          innerErr.message === 'Authorization error. Please try again.') {
        throw innerErr;
      }
      currentUser = null;
      showLogin();
      throw new Error('Session expired. Please log in again.');
    }
  }

  const contentType = response.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.message || `Request failed: ${response.status}`);
    }
    return data;
  }

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response;
}

/**
 * Get initials from name
 */
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ============================================================
// MODAL HELPERS
// ============================================================

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('hidden');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('hidden');
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
}

// ============================================================
// AUTHENTICATION
// ============================================================

async function checkAuth() {
  try {
    const user = await api('GET', '/api/auth/me');
    currentUser = user;
    if (user.role === 'manager') {
      showManagerDashboard();
    } else {
      showEmployeeDashboard();
    }
  } catch (err) {
    showLogin();
  }
}

function showLogin() {
  document.getElementById('login-section').classList.remove('hidden');
  document.getElementById('manager-dashboard').classList.add('hidden');
  document.getElementById('employee-dashboard').classList.add('hidden');
  document.getElementById('login-error').classList.add('hidden');
  document.getElementById('login-username').focus();
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  errorEl.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Signing in...';

  try {
    const user = await api('POST', '/api/auth/login', { username, password });
    currentUser = user;
    document.getElementById('login-section').classList.add('hidden');

    if (user.role === 'manager') {
      showManagerDashboard();
    } else {
      showEmployeeDashboard();
    }
  } catch (err) {
    errorEl.textContent = err.message || 'Invalid username or password.';
    errorEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

async function handleLogout() {
  try {
    await api('POST', '/api/auth/logout');
  } catch (err) {
    // Ignore logout errors
  }
  currentUser = null;
  currentSchedule = null;
  employees = [];
  showLogin();
}

// ============================================================
// MANAGER DASHBOARD
// ============================================================

function showManagerDashboard() {
  document.getElementById('login-section').classList.add('hidden');
  document.getElementById('employee-dashboard').classList.add('hidden');
  document.getElementById('manager-dashboard').classList.remove('hidden');

  document.getElementById('manager-username-display').textContent = currentUser.username;
  document.getElementById('settings-username').textContent = currentUser.username;

  // Default to schedule tab
  switchManagerTab('schedule');

  // Load initial data
  loadEmployees().then(() => {
    currentWeekStart = getWeekStart(new Date());
    loadSchedule(currentWeekStart);
  });

  // Check for OAuth redirect
  checkOAuthRedirect();
}

function switchManagerTab(tab) {
  // Update nav tabs
  document.querySelectorAll('#manager-nav .nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  // Show/hide tab content
  ['schedule', 'employees', 'timeoff', 'settings'].forEach(t => {
    const el = document.getElementById(`manager-tab-${t}`);
    if (el) {
      el.classList.toggle('active', t === tab);
      el.classList.toggle('hidden', t !== tab);
    }
  });

  // Load data for tab
  if (tab === 'employees') {
    loadEmployees();
  } else if (tab === 'timeoff') {
    loadTimeOffRequests();
  } else if (tab === 'settings') {
    checkGmailStatus();
  }
}

// ============================================================
// SCHEDULE FUNCTIONS (MANAGER)
// ============================================================

async function loadSchedule(weekStart) {
  setLoading(true);
  try {
    const [scheduleData, empData] = await Promise.all([
      api('GET', `/api/schedules/${weekStart}`),
      employees.length > 0 ? Promise.resolve(employees) : api('GET', '/api/employees')
    ]);

    if (!employees.length) employees = empData;
    currentSchedule = scheduleData;
    currentWeekStart = weekStart;

    // Update week label
    const weekEnd = addDays(weekStart, 6);
    document.getElementById('week-label').textContent =
      `Week of ${formatDate(weekStart)} – ${formatDate(weekEnd)}`;

    renderScheduleGrid(scheduleData, employees);
  } catch (err) {
    showToast(`Failed to load schedule: ${err.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

function renderScheduleGrid(schedule, empList) {
  const table = document.getElementById('schedule-table');
  if (!table) return;

  // Build shift lookup: employeeId -> dayOfWeek -> [shifts]
  const shiftMap = {};
  for (const emp of empList) {
    shiftMap[emp.id] = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  }
  if (schedule && schedule.shifts) {
    for (const shift of schedule.shifts) {
      if (shiftMap[shift.employee_id]) {
        shiftMap[shift.employee_id][shift.day_of_week].push(shift);
      }
    }
  }

  // Build table HTML
  let html = '<thead><tr>';
  html += '<th>Employee</th>';
  for (const day of DAY_ABBR) {
    html += `<th>${day}</th>`;
  }
  html += '</tr></thead><tbody>';

  if (empList.length === 0) {
    html += `<tr><td colspan="8" class="empty-state">
      <span class="empty-state-icon">👥</span>
      <p>No employees yet.</p>
      <small>Add employees in the Employees tab first.</small>
    </td></tr>`;
  } else {
    for (const emp of empList) {
      html += `<tr>`;
      html += `<td>${escapeHtml(emp.name)}</td>`;

      for (let d = 0; d < 7; d++) {
        const dayShifts = (shiftMap[emp.id] || {})[d] || [];
        html += `<td>`;
        html += `<div class="shift-cell">`;

        for (const shift of dayShifts) {
          html += renderShiftChip(shift);
        }

        // Add shift button
        html += `<button class="add-shift-btn"
          data-employee-id="${emp.id}"
          data-day="${d}"
          title="Add shift for ${escapeHtml(emp.name)} on ${DAYS[d]}">+</button>`;

        html += `</div></td>`;
      }

      html += `</tr>`;
    }
  }

  html += '</tbody>';
  table.innerHTML = html;
}

function renderShiftChip(shift) {
  const timeStr = `${formatTime(shift.start_time)} – ${formatTime(shift.end_time)}`;
  return `
    <div class="shift-chip" data-shift-id="${shift.id}">
      <div class="shift-chip-time">${escapeHtml(timeStr)}</div>
      <div class="shift-chip-position">${escapeHtml(shift.position)}</div>
      ${shift.notes ? `<div class="shift-chip-time" style="font-style:italic;font-weight:400">${escapeHtml(shift.notes)}</div>` : ''}
      <div class="shift-chip-actions">
        <button class="shift-chip-btn edit-btn" data-shift-id="${shift.id}" title="Edit shift">✎</button>
        <button class="shift-chip-btn delete-btn" data-shift-id="${shift.id}" title="Delete shift">✕</button>
      </div>
    </div>
  `;
}

function openAddShiftModal(employeeId, dayOfWeek) {
  editingShiftId = null;
  editingShiftCell = { employeeId, dayOfWeek };

  const emp = employees.find(e => e.id == employeeId);
  const empName = emp ? emp.name : 'Employee';

  document.getElementById('shift-modal-title').textContent = 'Add Shift';
  document.getElementById('shift-id').value = '';
  document.getElementById('shift-employee-id').value = employeeId;
  document.getElementById('shift-day-of-week').value = dayOfWeek;
  document.getElementById('shift-schedule-id').value = currentSchedule ? currentSchedule.id : '';
  document.getElementById('shift-employee-display').textContent = empName;
  document.getElementById('shift-day-display').textContent = DAYS[dayOfWeek];
  document.getElementById('shift-start-time').value = '09:00';
  document.getElementById('shift-end-time').value = '17:00';
  document.getElementById('shift-position').value = '';
  document.getElementById('shift-notes').value = '';

  // Pre-select employee's first position if available
  if (emp && emp.positions) {
    let positions = [];
    try { positions = JSON.parse(emp.positions); } catch (e) {}
    if (positions.length > 0) {
      document.getElementById('shift-position').value = positions[0];
    }
  }

  document.getElementById('shift-save-btn').textContent = 'Add Shift';
  openModal('shift-modal');
  setTimeout(() => document.getElementById('shift-start-time').focus(), 100);
}

function openEditShiftModal(shiftId) {
  editingShiftId = shiftId;

  if (!currentSchedule || !currentSchedule.shifts) return;
  const shift = currentSchedule.shifts.find(s => s.id == shiftId);
  if (!shift) return;

  const emp = employees.find(e => e.id == shift.employee_id);
  const empName = emp ? emp.name : shift.employee_name || 'Employee';

  document.getElementById('shift-modal-title').textContent = 'Edit Shift';
  document.getElementById('shift-id').value = shift.id;
  document.getElementById('shift-employee-id').value = shift.employee_id;
  document.getElementById('shift-day-of-week').value = shift.day_of_week;
  document.getElementById('shift-schedule-id').value = shift.schedule_id;
  document.getElementById('shift-employee-display').textContent = empName;
  document.getElementById('shift-day-display').textContent = DAYS[shift.day_of_week];
  document.getElementById('shift-start-time').value = shift.start_time;
  document.getElementById('shift-end-time').value = shift.end_time;
  document.getElementById('shift-position').value = shift.position;
  document.getElementById('shift-notes').value = shift.notes || '';

  document.getElementById('shift-save-btn').textContent = 'Update Shift';
  openModal('shift-modal');
}

async function saveShift(e) {
  e.preventDefault();
  const shiftId = document.getElementById('shift-id').value;
  const employeeId = parseInt(document.getElementById('shift-employee-id').value);
  const dayOfWeek = parseInt(document.getElementById('shift-day-of-week').value);
  const scheduleId = parseInt(document.getElementById('shift-schedule-id').value);
  const startTime = document.getElementById('shift-start-time').value;
  const endTime = document.getElementById('shift-end-time').value;
  const position = document.getElementById('shift-position').value;
  const notes = document.getElementById('shift-notes').value.trim();

  if (!position) {
    showToast('Please select a position.', 'warning');
    return;
  }

  const btn = document.getElementById('shift-save-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    if (shiftId) {
      // Update
      await api('PUT', `/api/shifts/${shiftId}`, {
        employee_id: employeeId,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        position,
        notes
      });
      showToast('Shift updated successfully.', 'success');
    } else {
      // Create
      await api('POST', '/api/shifts', {
        schedule_id: scheduleId || undefined,
        week_start: currentWeekStart,
        employee_id: employeeId,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        position,
        notes
      });
      showToast('Shift added successfully.', 'success');
    }

    closeModal('shift-modal');
    await loadSchedule(currentWeekStart);
  } catch (err) {
    showToast(`Failed to save shift: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = shiftId ? 'Update Shift' : 'Add Shift';
  }
}

async function deleteShift(shiftId) {
  openConfirmModal(
    'Delete Shift',
    'Are you sure you want to delete this shift? This cannot be undone.',
    async () => {
      try {
        await api('DELETE', `/api/shifts/${shiftId}`);
        showToast('Shift deleted.', 'success');
        await loadSchedule(currentWeekStart);
      } catch (err) {
        showToast(`Failed to delete shift: ${err.message}`, 'error');
      }
    }
  );
}

function prevWeek() {
  if (!currentWeekStart) return;
  const newWeek = addDays(currentWeekStart, -7);
  loadSchedule(newWeek);
}

function nextWeek() {
  if (!currentWeekStart) return;
  const newWeek = addDays(currentWeekStart, 7);
  loadSchedule(newWeek);
}

async function saveSchedule() {
  if (!currentWeekStart) return;
  setLoading(true);
  try {
    await api('POST', `/api/schedules/${currentWeekStart}/save`);
    showToast('Schedule saved successfully!', 'success');
    await loadSchedule(currentWeekStart);
  } catch (err) {
    showToast(`Failed to save schedule: ${err.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

async function loadPreviousSchedule() {
  setLoading(true);
  try {
    const schedules = await api('GET', '/api/schedules');
    const select = document.getElementById('saved-schedules-select');

    if (schedules.length === 0) {
      select.innerHTML = '<option value="">No saved schedules available</option>';
    } else {
      select.innerHTML = `<option value="">Select a week...</option>` +
        schedules.map(s => {
          const weekEnd = addDays(s.week_start, 6);
          return `<option value="${escapeHtml(s.week_start)}">
            ${formatDate(s.week_start)} – ${formatDate(weekEnd)}
          </option>`;
        }).join('');
    }

    openModal('load-schedule-modal');
  } catch (err) {
    showToast(`Failed to load saved schedules: ${err.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

async function confirmLoadSchedule() {
  const sourceWeek = document.getElementById('saved-schedules-select').value;
  if (!sourceWeek) {
    showToast('Please select a schedule to load.', 'warning');
    return;
  }

  closeModal('load-schedule-modal');
  setLoading(true);

  try {
    await api('POST', `/api/schedules/${currentWeekStart}/load/${sourceWeek}`);
    showToast('Schedule loaded successfully!', 'success');
    await loadSchedule(currentWeekStart);
  } catch (err) {
    showToast(`Failed to load schedule: ${err.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

async function downloadPDF() {
  if (!currentWeekStart) return;
  setLoading(true);
  try {
    const response = await fetch(`/api/email/pdf/${currentWeekStart}`, {
      credentials: 'include'
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to generate PDF');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schedule-${currentWeekStart}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('PDF downloaded!', 'success');
  } catch (err) {
    showToast(`Failed to download PDF: ${err.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

async function sendEmails() {
  if (!currentWeekStart) return;

  // Check Gmail status first
  try {
    const status = await api('GET', '/api/email/status');
    if (!status.connected) {
      showToast('Gmail is not connected. Please connect Gmail in Settings.', 'warning');
      switchManagerTab('settings');
      return;
    }
  } catch (err) {
    showToast('Could not check Gmail status.', 'error');
    return;
  }

  setLoading(true);
  try {
    const result = await api('POST', '/api/email/send', { week_start: currentWeekStart });
    showToast(result.message || 'Emails sent!', 'success');
    if (result.errors && result.errors.length > 0) {
      result.errors.forEach(e => showToast(`Failed for ${e.employee}: ${e.error}`, 'warning'));
    }
  } catch (err) {
    showToast(`Failed to send emails: ${err.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

// ============================================================
// EMPLOYEE MANAGEMENT (MANAGER VIEW)
// ============================================================

async function loadEmployees() {
  try {
    employees = await api('GET', '/api/employees');
    // Only render if on employees tab
    const tab = document.getElementById('manager-tab-employees');
    if (tab && !tab.classList.contains('hidden')) {
      renderEmployees(employees);
    }
  } catch (err) {
    showToast(`Failed to load employees: ${err.message}`, 'error');
  }
}

function renderEmployees(empList) {
  const container = document.getElementById('employees-list');
  if (!container) return;

  if (empList.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1">
        <span class="empty-state-icon">👥</span>
        <p>No employees yet.</p>
        <small>Click "Add Employee" to get started.</small>
      </div>`;
    return;
  }

  container.innerHTML = empList.map(emp => {
    let positions = [];
    try { positions = JSON.parse(emp.positions || '[]'); } catch (e) {}

    const posTagsHtml = positions.length > 0
      ? positions.map(p => `<span class="position-tag">${escapeHtml(p)}</span>`).join('')
      : '<span class="text-muted" style="font-size:12px">No positions assigned</span>';

    return `
      <div class="employee-card">
        <div class="employee-card-header">
          <div style="display:flex;align-items:center;gap:12px;flex:1">
            <div class="employee-avatar">${getInitials(emp.name)}</div>
            <div class="employee-info">
              <div class="employee-name">${escapeHtml(emp.name)}</div>
              <div class="employee-email">${escapeHtml(emp.email)}</div>
            </div>
          </div>
          <div class="employee-card-actions">
            <button class="btn btn-secondary btn-sm" data-edit-emp="${emp.id}" title="Edit">✎ Edit</button>
            <button class="btn btn-danger btn-sm" data-delete-emp="${emp.id}" title="Delete">✕</button>
          </div>
        </div>
        <div class="employee-positions">${posTagsHtml}</div>
        <div class="employee-pay">
          <span>Pay Rate:</span>
          <span class="employee-pay-rate">$${parseFloat(emp.pay_rate || 0).toFixed(2)}/hr</span>
        </div>
      </div>
    `;
  }).join('');
}

function openAddEmployeeModal() {
  editingEmployeeId = null;
  document.getElementById('employee-modal-title').textContent = 'Add Employee';
  document.getElementById('employee-id').value = '';
  document.getElementById('emp-name').value = '';
  document.getElementById('emp-email').value = '';
  document.getElementById('emp-pay-rate').value = '';
  document.getElementById('employee-password-hint').classList.add('hidden');
  document.getElementById('employee-save-btn').textContent = 'Add Employee';

  // Uncheck all positions
  document.querySelectorAll('#positions-checkboxes input[type="checkbox"]').forEach(cb => {
    cb.checked = false;
  });

  openModal('employee-modal');
  setTimeout(() => document.getElementById('emp-name').focus(), 100);
}

function openEditEmployeeModal(id) {
  const emp = employees.find(e => e.id == id);
  if (!emp) return;

  editingEmployeeId = id;
  document.getElementById('employee-modal-title').textContent = 'Edit Employee';
  document.getElementById('employee-id').value = emp.id;
  document.getElementById('emp-name').value = emp.name;
  document.getElementById('emp-email').value = emp.email;
  document.getElementById('emp-pay-rate').value = emp.pay_rate || 0;
  document.getElementById('employee-password-hint').classList.add('hidden');
  document.getElementById('employee-save-btn').textContent = 'Update Employee';

  // Check appropriate positions
  let positions = [];
  try { positions = JSON.parse(emp.positions || '[]'); } catch (e) {}

  document.querySelectorAll('#positions-checkboxes input[type="checkbox"]').forEach(cb => {
    cb.checked = positions.includes(cb.value);
  });

  openModal('employee-modal');
}

async function saveEmployee(e) {
  e.preventDefault();
  const empId = document.getElementById('employee-id').value;
  const name = document.getElementById('emp-name').value.trim();
  const email = document.getElementById('emp-email').value.trim();
  const payRate = parseFloat(document.getElementById('emp-pay-rate').value) || 0;

  const positions = [];
  document.querySelectorAll('#positions-checkboxes input[type="checkbox"]:checked').forEach(cb => {
    positions.push(cb.value);
  });

  if (!name || !email) {
    showToast('Name and email are required.', 'warning');
    return;
  }

  const btn = document.getElementById('employee-save-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    if (empId) {
      await api('PUT', `/api/employees/${empId}`, { name, email, positions, pay_rate: payRate });
      showToast('Employee updated successfully.', 'success');
    } else {
      const newEmp = await api('POST', '/api/employees', { name, email, positions, pay_rate: payRate });

      // Show password hint
      const rawPassword = name.toLowerCase().replace(/\s+/g, '');
      document.getElementById('hint-username').textContent = email;
      document.getElementById('hint-password').textContent = rawPassword;
      document.getElementById('employee-password-hint').classList.remove('hidden');

      showToast(`Employee "${name}" added. Login: ${email} / ${rawPassword}`, 'success');
    }

    await loadEmployees();

    if (!empId) {
      // Keep modal open to show password hint
      document.getElementById('emp-name').value = '';
      document.getElementById('emp-email').value = '';
      document.getElementById('emp-pay-rate').value = '';
      document.querySelectorAll('#positions-checkboxes input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
      });
      document.getElementById('employee-id').value = '';
      document.getElementById('employee-modal-title').textContent = 'Add Employee';
      document.getElementById('employee-save-btn').textContent = 'Add Employee';
    } else {
      closeModal('employee-modal');
    }
  } catch (err) {
    showToast(`Failed to save employee: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = empId ? 'Update Employee' : 'Add Employee';
  }
}

async function deleteEmployee(id) {
  const emp = employees.find(e => e.id == id);
  const name = emp ? emp.name : 'this employee';

  openConfirmModal(
    'Delete Employee',
    `Are you sure you want to delete "${name}"? This will also delete all their shifts and time-off requests. This cannot be undone.`,
    async () => {
      try {
        await api('DELETE', `/api/employees/${id}`);
        showToast(`Employee "${name}" deleted.`, 'success');
        await loadEmployees();
        // Reload schedule if visible
        if (currentWeekStart) await loadSchedule(currentWeekStart);
      } catch (err) {
        showToast(`Failed to delete employee: ${err.message}`, 'error');
      }
    }
  );
}

// ============================================================
// TIME OFF REQUESTS (MANAGER VIEW)
// ============================================================

async function loadTimeOffRequests() {
  setLoading(true);
  try {
    const requests = await api('GET', '/api/timeoff');
    renderTimeOffRequests(requests);
  } catch (err) {
    showToast(`Failed to load time off requests: ${err.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

function renderTimeOffRequests(requests) {
  const container = document.getElementById('timeoff-list');
  if (!container) return;

  const filtered = currentTimeoffFilter === 'all'
    ? requests
    : requests.filter(r => r.status === currentTimeoffFilter);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">📅</span>
        <p>No ${currentTimeoffFilter === 'all' ? '' : currentTimeoffFilter + ' '}requests found.</p>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(req => {
    const statusClass = `status-${req.status}`;
    const statusLabel = req.status.charAt(0).toUpperCase() + req.status.slice(1);

    const actionButtons = req.status === 'pending' ? `
      <button class="btn btn-success btn-sm" data-approve="${req.id}">✓ Approve</button>
      <button class="btn btn-danger btn-sm" data-deny="${req.id}">✕ Deny</button>
    ` : '';

    return `
      <div class="timeoff-card" data-request-id="${req.id}">
        <div class="timeoff-card-body">
          <div class="timeoff-header">
            <span class="timeoff-employee">${escapeHtml(req.employee_name)}</span>
            <span class="timeoff-date">📅 ${formatDate(req.request_date)}</span>
            <span class="status-badge ${statusClass}">${statusLabel}</span>
          </div>
          <div class="timeoff-reason">${escapeHtml(req.reason)}</div>
          ${req.manager_notes ? `<div class="timeoff-manager-notes">Manager: ${escapeHtml(req.manager_notes)}</div>` : ''}
          <div style="font-size:11px;color:var(--color-text-muted);margin-top:6px">
            Submitted: ${formatDate(req.created_at ? req.created_at.split('T')[0].split(' ')[0] : req.request_date)}
          </div>
        </div>
        ${actionButtons ? `<div class="timeoff-actions">${actionButtons}</div>` : ''}
      </div>
    `;
  }).join('');
}

async function approveRequest(id) {
  try {
    await api('PUT', `/api/timeoff/${id}`, {
      status: 'approved',
      manager_notes: ''
    });
    showToast('Request approved.', 'success');
    loadTimeOffRequests();
  } catch (err) {
    showToast(`Failed to approve request: ${err.message}`, 'error');
  }
}

async function denyRequest(id) {
  // Prompt for notes
  const notes = prompt('Enter a reason for denying this request (optional):') || '';
  try {
    await api('PUT', `/api/timeoff/${id}`, {
      status: 'denied',
      manager_notes: notes
    });
    showToast('Request denied.', 'success');
    loadTimeOffRequests();
  } catch (err) {
    showToast(`Failed to deny request: ${err.message}`, 'error');
  }
}

// ============================================================
// GMAIL / SETTINGS
// ============================================================

async function checkGmailStatus() {
  try {
    const status = await api('GET', '/api/email/status');
    const dot = document.getElementById('gmail-status-dot');
    const text = document.getElementById('gmail-status-text');
    const actionsDiv = document.getElementById('gmail-actions');

    if (status.connected) {
      dot.className = 'status-dot connected';
      text.textContent = 'Connected';
      actionsDiv.innerHTML = `
        <button id="connect-gmail-btn" class="btn btn-secondary btn-sm">Re-authorize</button>
        <button id="disconnect-gmail-btn" class="btn btn-danger btn-sm">Disconnect</button>
      `;
      document.getElementById('disconnect-gmail-btn')?.addEventListener('click', disconnectGmail);
    } else {
      dot.className = 'status-dot disconnected';
      text.textContent = 'Not connected';
      actionsDiv.innerHTML = `<button id="connect-gmail-btn" class="btn btn-primary">Connect Gmail</button>`;
    }

    document.getElementById('connect-gmail-btn')?.addEventListener('click', connectGmail);
  } catch (err) {
    console.warn('Could not check Gmail status:', err.message);
  }
}

async function connectGmail() {
  try {
    const data = await api('GET', '/api/email/oauth/url');
    window.location.href = data.url;
  } catch (err) {
    showToast(`Failed to initiate Gmail connection: ${err.message}`, 'error');
  }
}

async function disconnectGmail() {
  try {
    await api('DELETE', '/api/email/disconnect');
    showToast('Gmail disconnected.', 'success');
    checkGmailStatus();
  } catch (err) {
    showToast(`Failed to disconnect Gmail: ${err.message}`, 'error');
  }
}

function checkOAuthRedirect() {
  const hash = window.location.hash;
  if (!hash.includes('settings')) return;

  const params = new URLSearchParams(hash.replace(/^#settings\??/, ''));
  const oauthStatus = params.get('oauth');
  const oauthMessage = params.get('message');

  if (oauthStatus === 'success') {
    switchManagerTab('settings');
    showToast('Gmail connected successfully!', 'success');
    const notice = document.getElementById('gmail-oauth-notice');
    notice.textContent = 'Gmail connected successfully! You can now send schedule emails.';
    notice.className = 'oauth-notice success';
    notice.classList.remove('hidden');
    checkGmailStatus();
  } else if (oauthStatus === 'error') {
    switchManagerTab('settings');
    const msg = oauthMessage || 'OAuth authorization failed.';
    showToast(`Gmail connection failed: ${msg}`, 'error');
    const notice = document.getElementById('gmail-oauth-notice');
    notice.textContent = `Connection failed: ${msg}`;
    notice.className = 'oauth-notice error';
    notice.classList.remove('hidden');
  }

  // Clean up URL
  history.replaceState(null, '', window.location.pathname);
}

// ============================================================
// EMPLOYEE DASHBOARD
// ============================================================

function showEmployeeDashboard() {
  document.getElementById('login-section').classList.add('hidden');
  document.getElementById('manager-dashboard').classList.add('hidden');
  document.getElementById('employee-dashboard').classList.remove('hidden');

  document.getElementById('employee-username-display').textContent = currentUser.username;

  // Default to schedule tab
  switchEmployeeTab('schedule');

  employeeCurrentWeekStart = getWeekStart(new Date());
  loadEmployeeSchedule(employeeCurrentWeekStart);
}

function switchEmployeeTab(tab) {
  document.querySelectorAll('#employee-nav .nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  ['schedule', 'timeoff', 'hours'].forEach(t => {
    const el = document.getElementById(`employee-tab-${t}`);
    if (el) {
      el.classList.toggle('active', t === tab);
      el.classList.toggle('hidden', t !== tab);
    }
  });

  if (tab === 'timeoff') {
    loadMyTimeOffRequests();
  } else if (tab === 'hours') {
    loadMyHours();
  }
}

async function loadEmployeeSchedule(weekStart) {
  setLoading(true);
  try {
    const schedule = await api('GET', `/api/schedules/${weekStart}`);
    employeeCurrentWeekStart = weekStart;

    const weekEnd = addDays(weekStart, 6);
    document.getElementById('emp-week-label').textContent =
      `Week of ${formatDate(weekStart)} – ${formatDate(weekEnd)}`;

    renderEmployeeSchedule(schedule);
  } catch (err) {
    showToast(`Failed to load schedule: ${err.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

function renderEmployeeSchedule(schedule) {
  const container = document.getElementById('employee-schedule-view');
  if (!container) return;

  const empId = currentUser.employee_id;
  const myShifts = (schedule && schedule.shifts)
    ? schedule.shifts.filter(s => s.employee_id == empId)
    : [];

  // Group by day
  const byDay = {};
  for (let d = 0; d < 7; d++) byDay[d] = [];
  for (const shift of myShifts) {
    byDay[shift.day_of_week].push(shift);
  }

  if (myShifts.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:48px 20px">
        <span class="empty-state-icon">📅</span>
        <p>No shifts scheduled for this week.</p>
        <small>Check back later or contact your manager.</small>
      </div>`;
    return;
  }

  container.innerHTML = DAYS.map((dayName, d) => {
    const shifts = byDay[d];
    let shiftsHtml;

    if (shifts.length === 0) {
      shiftsHtml = `<span class="emp-day-off">Day off</span>`;
    } else {
      shiftsHtml = shifts.map(shift => `
        <div class="emp-shift-chip">
          <div class="emp-shift-time">${formatTime(shift.start_time)} – ${formatTime(shift.end_time)}</div>
          <div class="emp-shift-position">${escapeHtml(shift.position)}</div>
          ${shift.notes ? `<div style="font-size:11px;color:var(--color-text-muted);margin-top:2px">${escapeHtml(shift.notes)}</div>` : ''}
        </div>
      `).join('');
    }

    const isToday = (() => {
      const today = new Date();
      const dayDate = new Date(employeeCurrentWeekStart + 'T00:00:00');
      dayDate.setDate(dayDate.getDate() + d);
      return today.toDateString() === dayDate.toDateString();
    })();

    return `
      <div class="emp-schedule-day${isToday ? ' today' : ''}" style="${isToday ? 'background:var(--color-accent-light);' : ''}">
        <div class="emp-day-label">${dayName}${isToday ? ' <span style="font-size:10px;color:var(--color-primary)">(Today)</span>' : ''}</div>
        <div class="emp-day-shifts">${shiftsHtml}</div>
      </div>
    `;
  }).join('');
}

function empPrevWeek() {
  if (!employeeCurrentWeekStart) return;
  loadEmployeeSchedule(addDays(employeeCurrentWeekStart, -7));
}

function empNextWeek() {
  if (!employeeCurrentWeekStart) return;
  loadEmployeeSchedule(addDays(employeeCurrentWeekStart, 7));
}

// ============================================================
// EMPLOYEE TIME OFF
// ============================================================

async function loadMyTimeOffRequests() {
  setLoading(true);
  try {
    const requests = await api('GET', '/api/timeoff');
    renderMyRequests(requests);
  } catch (err) {
    showToast(`Failed to load requests: ${err.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

function renderMyRequests(requests) {
  const container = document.getElementById('my-timeoff-list');
  if (!container) return;

  if (requests.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">📝</span>
        <p>No requests submitted yet.</p>
      </div>`;
    return;
  }

  container.innerHTML = requests.map(req => {
    const statusClass = `status-${req.status}`;
    const statusLabel = req.status.charAt(0).toUpperCase() + req.status.slice(1);

    return `
      <div class="timeoff-card">
        <div class="timeoff-card-body">
          <div class="timeoff-header">
            <span class="timeoff-date">📅 ${formatDate(req.request_date)}</span>
            <span class="status-badge ${statusClass}">${statusLabel}</span>
          </div>
          <div class="timeoff-reason">${escapeHtml(req.reason)}</div>
          ${req.manager_notes ? `<div class="timeoff-manager-notes">Manager: ${escapeHtml(req.manager_notes)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function submitTimeOffRequest(e) {
  e.preventDefault();
  const requestDate = document.getElementById('timeoff-date').value;
  const reason = document.getElementById('timeoff-reason').value.trim();

  if (!requestDate || !reason) {
    showToast('Please fill in all fields.', 'warning');
    return;
  }

  const btn = e.target.querySelector('[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  try {
    await api('POST', '/api/timeoff', { request_date: requestDate, reason });
    showToast('Time off request submitted!', 'success');
    e.target.reset();
    await loadMyTimeOffRequests();
  } catch (err) {
    showToast(`Failed to submit request: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit Request';
  }
}

// ============================================================
// EMPLOYEE HOURS
// ============================================================

async function loadMyHours() {
  if (!currentUser.employee_id) return;
  setLoading(true);
  try {
    const data = await api('GET', `/api/shifts/hours/${currentUser.employee_id}`);
    renderHoursTable(data);
  } catch (err) {
    showToast(`Failed to load hours: ${err.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

function renderHoursTable(data) {
  const container = document.getElementById('employee-hours-container');
  if (!container) return;

  const weeks = data.weeks || [];

  if (weeks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">⏱️</span>
        <p>No hours recorded yet.</p>
      </div>`;
    return;
  }

  const totalHours = weeks.reduce((sum, w) => sum + w.hours, 0);
  const payRate = data.pay_rate || 0;
  const totalPay = totalHours * payRate;

  container.innerHTML = `
    <div class="hours-summary">
      <div class="hours-summary-item">
        <span class="hours-summary-value">${totalHours.toFixed(1)}</span>
        <span class="hours-summary-label">Total Hours</span>
      </div>
      ${payRate > 0 ? `
      <div class="hours-summary-item">
        <span class="hours-summary-value">$${payRate.toFixed(2)}</span>
        <span class="hours-summary-label">Pay Rate/hr</span>
      </div>
      <div class="hours-summary-item">
        <span class="hours-summary-value">$${totalPay.toFixed(2)}</span>
        <span class="hours-summary-label">Est. Total Pay</span>
      </div>` : ''}
    </div>
    <div class="hours-table-wrapper">
      <table class="hours-table">
        <thead>
          <tr>
            <th>Week</th>
            <th>Hours</th>
            ${payRate > 0 ? '<th>Est. Pay</th>' : ''}
            <th>Shifts</th>
          </tr>
        </thead>
        <tbody>
          ${weeks.map(w => {
            const weekEnd = addDays(w.week_start, 6);
            const estPay = w.hours * payRate;
            return `
              <tr>
                <td>${formatDate(w.week_start)} – ${formatDate(weekEnd)}</td>
                <td><strong>${w.hours.toFixed(1)}</strong></td>
                ${payRate > 0 ? `<td>$${estPay.toFixed(2)}</td>` : ''}
                <td>${w.shifts.length}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ============================================================
// CONFIRM MODAL
// ============================================================

function openConfirmModal(title, message, onConfirm) {
  document.getElementById('confirm-modal-title').textContent = title;
  document.getElementById('confirm-modal-message').textContent = message;
  pendingDeleteFn = onConfirm;
  openModal('confirm-modal');
}

// ============================================================
// HTML ESCAPE
// ============================================================

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================
// EVENT LISTENERS
// ============================================================

function initEventListeners() {
  // Login form
  document.getElementById('login-form')?.addEventListener('submit', handleLogin);

  // Logout buttons
  document.getElementById('manager-logout-btn')?.addEventListener('click', handleLogout);
  document.getElementById('employee-logout-btn')?.addEventListener('click', handleLogout);

  // Manager nav tabs
  document.querySelectorAll('#manager-nav .nav-tab').forEach(btn => {
    btn.addEventListener('click', () => switchManagerTab(btn.dataset.tab));
  });

  // Employee nav tabs
  document.querySelectorAll('#employee-nav .nav-tab').forEach(btn => {
    btn.addEventListener('click', () => switchEmployeeTab(btn.dataset.tab));
  });

  // Schedule navigation
  document.getElementById('prev-week')?.addEventListener('click', prevWeek);
  document.getElementById('next-week')?.addEventListener('click', nextWeek);
  document.getElementById('save-schedule')?.addEventListener('click', saveSchedule);
  document.getElementById('load-schedule')?.addEventListener('click', loadPreviousSchedule);
  document.getElementById('download-pdf')?.addEventListener('click', downloadPDF);
  document.getElementById('send-emails')?.addEventListener('click', sendEmails);

  // Employee schedule navigation
  document.getElementById('emp-prev-week')?.addEventListener('click', empPrevWeek);
  document.getElementById('emp-next-week')?.addEventListener('click', empNextWeek);

  // Schedule table: add/edit/delete shift (event delegation)
  document.getElementById('schedule-table')?.addEventListener('click', (e) => {
    // Add shift button
    const addBtn = e.target.closest('.add-shift-btn');
    if (addBtn) {
      const empId = parseInt(addBtn.dataset.employeeId);
      const day = parseInt(addBtn.dataset.day);
      openAddShiftModal(empId, day);
      return;
    }

    // Edit shift button
    const editBtn = e.target.closest('.shift-chip-btn.edit-btn');
    if (editBtn) {
      const shiftId = parseInt(editBtn.dataset.shiftId);
      openEditShiftModal(shiftId);
      return;
    }

    // Delete shift button
    const deleteBtn = e.target.closest('.shift-chip-btn.delete-btn');
    if (deleteBtn) {
      const shiftId = parseInt(deleteBtn.dataset.shiftId);
      deleteShift(shiftId);
      return;
    }
  });

  // Shift form submit
  document.getElementById('shift-form')?.addEventListener('submit', saveShift);

  // Add employee button
  document.getElementById('add-employee-btn')?.addEventListener('click', openAddEmployeeModal);

  // Employee list: edit/delete (event delegation)
  document.getElementById('employees-list')?.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-edit-emp]');
    if (editBtn) {
      openEditEmployeeModal(parseInt(editBtn.dataset.editEmp));
      return;
    }

    const deleteBtn = e.target.closest('[data-delete-emp]');
    if (deleteBtn) {
      deleteEmployee(parseInt(deleteBtn.dataset.deleteEmp));
      return;
    }
  });

  // Employee form submit
  document.getElementById('employee-form')?.addEventListener('submit', saveEmployee);

  // Time off: approve/deny (event delegation)
  document.getElementById('timeoff-list')?.addEventListener('click', (e) => {
    const approveBtn = e.target.closest('[data-approve]');
    if (approveBtn) {
      approveRequest(parseInt(approveBtn.dataset.approve));
      return;
    }

    const denyBtn = e.target.closest('[data-deny]');
    if (denyBtn) {
      denyRequest(parseInt(denyBtn.dataset.deny));
      return;
    }
  });

  // Time off filters
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTimeoffFilter = btn.dataset.filter;
      loadTimeOffRequests();
    });
  });

  // Employee time off form
  document.getElementById('timeoff-request-form')?.addEventListener('submit', submitTimeOffRequest);

  // Load schedule modal confirm
  document.getElementById('confirm-load-btn')?.addEventListener('click', confirmLoadSchedule);

  // Confirm delete modal
  document.getElementById('confirm-delete-btn')?.addEventListener('click', () => {
    closeModal('confirm-modal');
    if (typeof pendingDeleteFn === 'function') {
      pendingDeleteFn();
      pendingDeleteFn = null;
    }
  });

  // Close modals via close buttons (data-modal attribute)
  document.querySelectorAll('[data-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.dataset.modal;
      closeModal(modalId);
    });
  });

  // Close modals clicking overlay background
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.add('hidden');
      }
    });
  });

  // Close modals on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllModals();
  });

  // Name input in employee modal: update password hint dynamically
  document.getElementById('emp-name')?.addEventListener('input', () => {
    const hintEl = document.getElementById('hint-password');
    if (hintEl) {
      const name = document.getElementById('emp-name').value.trim();
      hintEl.textContent = name.toLowerCase().replace(/\s+/g, '');
    }
  });
}

// ============================================================
// INIT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  checkAuth();
});
