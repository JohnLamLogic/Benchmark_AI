const API_BASE = '/api';
const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const state = {
  employees: [],
  entries: [],
  savedWeeks: [],
  weekStart: ''
};

const status = {
  timeoutId: null
};

document.addEventListener('DOMContentLoaded', () => {
  setupEventHandlers();
  initialize();
});

function setupEventHandlers() {
  const weekInput = document.getElementById('weekStart');
  weekInput.addEventListener('change', (event) => {
    const value = event.target.value;
    if (!value) return;
    state.weekStart = value;
    loadWeek(value);
  });

  document.getElementById('saveSchedule').addEventListener('click', saveSchedule);
  document.getElementById('downloadPdf').addEventListener('click', downloadPdf);
  document.getElementById('loadSavedSchedule').addEventListener('click', () => {
    const select = document.getElementById('previousSchedules');
    if (!select.value) {
      showStatus('Choose a saved week to load.', 'error');
      return;
    }
    state.weekStart = select.value;
    document.getElementById('weekStart').value = select.value;
    loadWeek(select.value, true);
  });

  document.getElementById('scheduleBody').addEventListener('click', handleScheduleClick);

  const shiftModal = document.getElementById('shiftModal');
  document.getElementById('closeModal').addEventListener('click', () => toggleModal(false));
  shiftModal.addEventListener('click', (event) => {
    if (event.target === shiftModal) {
      toggleModal(false);
    }
  });

  document.getElementById('shiftForm').addEventListener('submit', handleShiftSubmit);
  document.getElementById('deleteShift').addEventListener('click', removeCurrentShift);

  document.getElementById('employeeForm').addEventListener('submit', handleEmployeeSubmit);
  document.getElementById('resetEmployee').addEventListener('click', resetEmployeeForm);
  document.getElementById('employeeList').addEventListener('click', handleEmployeeListClick);
  document.getElementById('shiftBuilderForm').addEventListener('submit', handleShiftBuilderSubmit);
  document.getElementById('shiftEmployee').addEventListener('change', () => updateShiftBuilderPosition());
}

function initialize() {
  const monday = getMonday(new Date());
  state.weekStart = formatAsInputDate(monday);
  document.getElementById('weekStart').value = state.weekStart;
  loadEmployees();
  loadScheduleSummaries();
  loadWeek(state.weekStart);
}

function getMonday(source) {
  const date = new Date(source);
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  return date;
}

function formatAsInputDate(date) {
  const padded = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${padded(date.getMonth() + 1)}-${padded(date.getDate())}`;
}

async function loadEmployees() {
  try {
    const employees = await fetchJson(`${API_BASE}/employees`);
    const normalized = employees.map((employee) => ({
      ...employee,
      positions: ensurePositionsList(employee.positions)
    }));
    state.employees = normalized.sort((a, b) => a.name.localeCompare(b.name));
    renderEmployeeList();
    renderScheduleGrid();
    renderShiftBuilderOptions();
  } catch (err) {
    showStatus('Unable to load employees', 'error');
    console.error(err);
  }
}

async function loadScheduleSummaries() {
  try {
    const weeks = await fetchJson(`${API_BASE}/weeks`);
    state.savedWeeks = weeks.sort((a, b) => b.startDate.localeCompare(a.startDate));
    renderWeekOptions();
  } catch (err) {
    showStatus('Unable to load saved weeks', 'error');
    console.error(err);
  }
}

async function loadWeek(startDate, suppressMessage = false) {
  try {
    const week = await fetchJson(`${API_BASE}/weeks/${startDate}`);
    state.entries = (week.entries || []).map((entry) => convertEntry(entry));
    renderScheduleGrid();
    if (!suppressMessage) {
      showStatus('Loaded schedule for the selected week.', 'success');
    }
  } catch (err) {
    state.entries = [];
    renderScheduleGrid();
    showStatus('Starting a new schedule for that week.', 'info');
  }
}

function convertEntry(entry) {
  const localId = entry.localId || (entry.id ? `entry-${entry.id}` : generateLocalId());
  return { ...entry, localId };
}

function renderWeekOptions() {
  const select = document.getElementById('previousSchedules');
  select.innerHTML = '<option value="">Select a saved week</option>';
  state.savedWeeks.forEach((week) => {
    const option = document.createElement('option');
    option.value = week.startDate;
    option.textContent = `Week of ${formatFriendlyDate(week.startDate)}`;
    select.appendChild(option);
  });
}

function renderEmployeeList() {
  const container = document.getElementById('employeeList');
  container.innerHTML = '';
  if (!state.employees.length) {
    container.innerHTML = '<p class="panel-hint">Add staff to begin building the schedule.</p>';
    return;
  }
  state.employees.forEach((employee) => {
    const card = document.createElement('div');
    card.className = 'employee-card';
    const positionText =
      Array.isArray(employee.positions) && employee.positions.length
        ? employee.positions.join(', ')
        : 'No positions set';
    card.innerHTML = `
      <div>
        <h3>${employee.name}</h3>
        <small>${employee.email}</small>
        <div><small>${positionText}</small></div>
      </div>
      <div class="actions">
        <button type="button" data-action="edit-employee" data-id="${employee.id}">Edit</button>
        <button type="button" data-action="delete-employee" data-id="${employee.id}">Delete</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderScheduleGrid() {
  const body = document.getElementById('scheduleBody');
  body.innerHTML = '';
  if (!state.employees.length) {
    const row = document.createElement('tr');
    const placeholder = document.createElement('td');
    placeholder.colSpan = 8;
    placeholder.textContent = 'Add employees to begin planning shifts.';
    row.appendChild(placeholder);
    body.appendChild(row);
    return;
  }

  state.employees.forEach((employee) => {
    const row = document.createElement('tr');
    const info = document.createElement('td');
    info.className = 'employee-cell';
    const positionText =
      Array.isArray(employee.positions) && employee.positions.length
        ? employee.positions.join(', ')
        : 'No positions set';
    info.innerHTML = `<strong>${employee.name}</strong>
                      <small>${employee.email}</small>
                      <small>${positionText}</small>`;
    row.appendChild(info);

    WEEK_DAYS.forEach((day) => {
      const cell = document.createElement('td');
      const shiftsForCell = state.entries
        .filter((entry) => entry.employeeId === employee.id && entry.day === day)
        .sort((a, b) => a.start.localeCompare(b.start));

      const list = document.createElement('div');
      list.className = 'shifts-list';
      shiftsForCell.forEach((shift) => {
        const card = document.createElement('div');
        card.className = 'shift-card';
        const infoBlock = document.createElement('div');
        infoBlock.innerHTML = `<time>${shift.start} - ${shift.end}</time><span>${shift.position}</span>`;
        const actions = document.createElement('div');
        actions.className = 'shift-actions';
        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.dataset.action = 'edit-shift';
        editButton.dataset.shiftLocal = shift.localId;
        editButton.textContent = 'Edit';
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.dataset.action = 'remove-shift';
        removeButton.dataset.shiftLocal = shift.localId;
        removeButton.textContent = 'Remove';
        actions.append(editButton, removeButton);
        card.append(infoBlock, actions);
        list.appendChild(card);
      });

      const action = document.createElement('div');
      action.className = 'cell-actions';
      const addButton = document.createElement('button');
      addButton.type = 'button';
      addButton.dataset.action = 'add-shift';
      addButton.dataset.employeeId = employee.id;
      addButton.dataset.day = day;
      addButton.textContent = 'Add shift';
      action.appendChild(addButton);

      cell.appendChild(list);
      cell.appendChild(action);
      row.appendChild(cell);
    });

    body.appendChild(row);
  });
}

function handleScheduleClick(event) {
  const target = event.target.closest('button');
  if (!target) return;
  const action = target.dataset.action;
  if (action === 'add-shift') {
    openShiftModal(Number(target.dataset.employeeId), target.dataset.day);
    return;
  }
  if (action === 'edit-shift') {
    const shiftLocal = target.dataset.shiftLocal;
    const shift = state.entries.find((entry) => entry.localId === shiftLocal);
    if (shift) {
      openShiftModal(shift.employeeId, shift.day, shift);
    }
    return;
  }
  if (action === 'remove-shift') {
    const shiftLocal = target.dataset.shiftLocal;
    state.entries = state.entries.filter((entry) => entry.localId !== shiftLocal);
    renderScheduleGrid();
    showStatus('Shift removed', 'info');
  }
}

function openShiftModal(employeeId, day, shift = null) {
  const modal = document.getElementById('shiftModal');
  const heading = document.getElementById('modalHeading');
  const employeeName = document.getElementById('modalEmployeeName');
  const dayLabel = document.getElementById('modalDayLabel');
  const shiftIdInput = document.getElementById('modalShiftId');
  const employeeInput = document.getElementById('modalEmployeeId');
  const dayInput = document.getElementById('modalDay');
  const startInput = document.getElementById('modalStart');
  const endInput = document.getElementById('modalEnd');
  const positionInput = document.getElementById('modalPosition');
  const deleteButton = document.getElementById('deleteShift');

  const employee = state.employees.find((item) => item.id === employeeId);
  employeeInput.value = employeeId;
  dayInput.value = day;
  dayLabel.textContent = day;
  employeeName.textContent = employee ? employee.name : 'Unknown';
  if (shift) {
    heading.textContent = 'Edit shift';
    shiftIdInput.value = shift.localId;
    startInput.value = shift.start;
    endInput.value = shift.end;
    positionInput.value = shift.position;
    deleteButton.style.display = 'inline-flex';
  } else {
    heading.textContent = 'Add shift';
    shiftIdInput.value = '';
    startInput.value = '09:00';
    endInput.value = '13:00';
    positionInput.value = employee?.positions[0] || '';
    deleteButton.style.display = 'none';
  }

  toggleModal(true);
}

function toggleModal(show) {
  const modal = document.getElementById('shiftModal');
  modal.dataset.visible = show ? 'true' : 'false';
  if (!show) {
    document.getElementById('shiftForm').reset();
    document.getElementById('modalShiftId').value = '';
  }
}

function handleShiftSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const localId = form.shiftId.value || generateLocalId();
  const employeeId = Number(form.employeeId.value);
  const day = form.day.value;
  const start = form.start.value;
  const end = form.end.value;
  const position = form.position.value.trim();

  if (!employeeId || !day || !start || !end || !position) {
    showStatus('Fill in all shift fields', 'error');
    return;
  }

  const existingIndex = state.entries.findIndex((entry) => entry.localId === localId);
  const existing = state.entries[existingIndex];
  const payload = {
    localId,
    employeeId,
    day,
    start,
    end,
    position,
    id: existing ? existing.id : undefined
  };

  if (existing) {
    state.entries[existingIndex] = payload;
    showStatus('Shift updated', 'success');
  } else {
    state.entries.push(payload);
    showStatus('Shift added', 'success');
  }

  renderScheduleGrid();
  toggleModal(false);
}

function removeCurrentShift() {
  const shiftLocal = document.getElementById('modalShiftId').value;
  if (!shiftLocal) {
    toggleModal(false);
    return;
  }
  state.entries = state.entries.filter((entry) => entry.localId !== shiftLocal);
  renderScheduleGrid();
  showStatus('Shift removed', 'info');
  toggleModal(false);
}

async function handleEmployeeSubmit(event) {
  event.preventDefault();
  const nameInput = document.getElementById('employeeName');
  const emailInput = document.getElementById('employeeEmail');
  const positionsInput = document.getElementById('employeePositions');
  const idInput = document.getElementById('employeeId');

  const payload = {
    name: nameInput.value.trim(),
    email: emailInput.value.trim(),
    positions: positionsInput.value.trim()
  };
  if (!payload.name || !payload.email || !payload.positions) {
    showStatus('Name, email, and positions are required', 'error');
    return;
  }

  const isEdit = Boolean(idInput.value);
  const endpoint = isEdit ? `${API_BASE}/employees/${idInput.value}` : `${API_BASE}/employees`;
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const response = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Unable to save employee');
    }
    await loadEmployees();
    resetEmployeeForm();
    showStatus(isEdit ? 'Employee updated' : 'Employee added', 'success');
  } catch (err) {
    showStatus(err.message, 'error');
  }
}

function resetEmployeeForm() {
  document.getElementById('employeeForm').reset();
  document.getElementById('employeeId').value = '';
}

function handleEmployeeListClick(event) {
  const target = event.target.closest('button');
  if (!target) return;
  const action = target.dataset.action;
  if (action === 'edit-employee') {
    const employee = state.employees.find((item) => item.id === Number(target.dataset.id));
    if (!employee) return;
    document.getElementById('employeeId').value = employee.id;
    document.getElementById('employeeName').value = employee.name;
    document.getElementById('employeeEmail').value = employee.email;
    document.getElementById('employeePositions').value = Array.isArray(employee.positions)
      ? employee.positions.join(', ')
      : '';
    return;
  }
  if (action === 'delete-employee') {
    const id = Number(target.dataset.id);
    if (!confirm('Remove this employee and their scheduled shifts?')) return;
    deleteEmployee(id);
  }
}

async function deleteEmployee(id) {
  try {
    const response = await fetch(`${API_BASE}/employees/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      throw new Error('Unable to remove employee');
    }
    state.entries = state.entries.filter((entry) => entry.employeeId !== id);
    showStatus('Employee removed', 'success');
    await loadEmployees();
    resetEmployeeForm();
  } catch (err) {
    showStatus(err.message, 'error');
  }
}

function handleShiftBuilderSubmit(event) {
  event.preventDefault();
  const employeeId = Number(document.getElementById('shiftEmployee').value);
  const day = document.getElementById('shiftDay').value;
  const start = document.getElementById('shiftStart').value;
  const end = document.getElementById('shiftEnd').value;
  const position = document.getElementById('shiftBuilderPosition').value.trim();

  if (!employeeId || !day || !start || !end || !position) {
    showStatus('Complete all shift fields before saving', 'error');
    return;
  }

  state.entries.push({
    localId: generateLocalId(),
    employeeId,
    day,
    start,
    end,
    position
  });
  renderScheduleGrid();
  showStatus('Shift added to schedule', 'success');
  resetShiftBuilderForm();
}

function renderShiftBuilderOptions() {
  const select = document.getElementById('shiftEmployee');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Select employee</option>';
  state.employees.forEach((employee) => {
    const option = document.createElement('option');
    option.value = employee.id;
    option.textContent = employee.name;
    select.appendChild(option);
  });
  select.value = current || '';
  updateShiftBuilderPosition();
}

function resetShiftBuilderForm() {
  const daySelect = document.getElementById('shiftDay');
  const startInput = document.getElementById('shiftStart');
  const endInput = document.getElementById('shiftEnd');
  const employeeSelect = document.getElementById('shiftEmployee');
  const positionInput = document.getElementById('shiftBuilderPosition');

  if (daySelect) daySelect.value = WEEK_DAYS[0];
  if (startInput) startInput.value = '09:00';
  if (endInput) endInput.value = '13:00';
  if (employeeSelect) employeeSelect.value = '';
  if (positionInput) positionInput.value = '';
}

function updateShiftBuilderPosition() {
  const select = document.getElementById('shiftEmployee');
  const positionInput = document.getElementById('shiftBuilderPosition');
  if (!select || !positionInput) return;
  const employeeId = Number(select.value);
  const employee = state.employees.find((item) => item.id === employeeId);
  positionInput.value = employee && employee.positions.length ? employee.positions[0] : '';
}

async function saveSchedule() {
  if (!state.weekStart) {
    showStatus('Pick the beginning of the week first', 'error');
    return;
  }
  try {
    const payload = {
      startDate: state.weekStart,
      entries: state.entries.map((entry) => {
        const clone = {
          employeeId: entry.employeeId,
          day: entry.day,
          start: entry.start,
          end: entry.end,
          position: entry.position
        };
        if (entry.id) {
          clone.id = entry.id;
        }
        return clone;
      })
    };
    const response = await fetch(`${API_BASE}/weeks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Unable to save schedule');
    }
    state.entries = (data.entries || []).map((entry) => convertEntry(entry));
    await loadScheduleSummaries();
    renderScheduleGrid();
    showStatus('Schedule saved successfully', 'success');
  } catch (err) {
    showStatus(err.message, 'error');
  }
}

async function downloadPdf() {
  if (!state.entries.length) {
    showStatus('Create at least one shift before downloading', 'error');
    return;
  }
  const lines = buildScheduleLines();
  const blob = buildSchedulePdf(lines);
  const fileName = `week-${state.weekStart || 'schedule'}.pdf`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
  showStatus('PDF ready for download', 'success');
}

function buildScheduleLines() {
  const employeeMap = new Map(state.employees.map((item) => [item.id, item]));
  const ordered = [...state.entries].sort((a, b) => {
    if (a.employeeId !== b.employeeId) return a.employeeId - b.employeeId;
    const dayComparison = WEEK_DAYS.indexOf(a.day) - WEEK_DAYS.indexOf(b.day);
    if (dayComparison !== 0) return dayComparison;
    return a.start.localeCompare(b.start);
  });

  if (!ordered.length) {
    return ['No shifts scheduled yet.'];
  }

  return ordered.map((entry) => {
    const employee = employeeMap.get(entry.employeeId);
    const employeeName = employee ? employee.name : 'Unknown';
    return `${employeeName} — ${entry.day}: ${entry.start}–${entry.end} (${entry.position})`;
  });
}

function buildSchedulePdf(lines) {
  const pageLines = chunkLines(lines, 32);
  const streams = pageLines.map((page, index) => createPageStream(page, index, pageLines.length));
  const pdfString = buildPdfDocument(streams);
  return new Blob([pdfString], { type: 'application/pdf' });
}

function chunkLines(lines, size) {
  if (!lines.length) return [[]];
  const pages = [];
  for (let index = 0; index < lines.length; index += size) {
    pages.push(lines.slice(index, index + size));
  }
  return pages.length ? pages : [[]];
}

function createPageStream(lines, index, totalPages) {
  const header = index === 0 ? `Schedule for the week of ${formatFriendlyDate(state.weekStart)}` : 'Continued schedule';
  let stream = '';
  let y = 770;
  stream += `BT /F1 16 Tf 40 ${y} Td (${escapePdf(header)}) Tj ET\n`;
  y -= 28;
  stream += `BT /F1 12 Tf 40 ${y} Td (${escapePdf(`Generated ${formatFriendlyDate(new Date().toISOString())}`)}) Tj ET\n`;
  y -= 24;
  lines.forEach((line) => {
    stream += `BT /F1 11 Tf 40 ${y} Td (${escapePdf(line)}) Tj ET\n`;
    y -= 18;
  });
  stream += `BT /F1 10 Tf 500 30 Td (${escapePdf(`Page ${index + 1} of ${totalPages}`)}) Tj ET\n`;
  return stream;
}

function buildPdfDocument(streams) {
  const objects = [];
  objects.push({ id: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' });
  const contentIds = [];
  const pageIds = [];
  let nextId = 4;
  streams.forEach(() => {
    contentIds.push(nextId++);
    pageIds.push(nextId++);
  });
  objects.push({
    id: 2,
    body: `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`
  });
  objects.push({ id: 3, body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>' });

  streams.forEach((stream, idx) => {
    const contentId = contentIds[idx];
    const length = getUtf8Length(stream);
    objects.push({
      id: contentId,
      body: `<< /Length ${length} >>\nstream\n${stream}\nendstream`
    });
    const pageId = pageIds[idx];
    objects.push({
      id: pageId,
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`
    });
  });

  objects.sort((a, b) => a.id - b.id);
  let pdf = '%PDF-1.3\n';
  const offsets = {};
  objects.forEach((object) => {
    offsets[object.id] = pdf.length;
    pdf += `${object.id} 0 obj\n${object.body}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  const totalObjects = objects.length;
  pdf += 'xref\n';
  pdf += `0 ${totalObjects + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let id = 1; id <= totalObjects; id += 1) {
    const offset = offsets[id] || 0;
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return pdf;
}

function getUtf8Length(str) {
  return new TextEncoder().encode(str).length;
}

function escapePdf(value) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function formatFriendlyDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function showStatus(message, type = 'info') {
  const toast = document.getElementById('statusToast');
  toast.textContent = message;
  toast.classList.add('visible');
  status.timeoutId && clearTimeout(status.timeoutId);
  status.timeoutId = setTimeout(() => toast.classList.remove('visible'), 3200);
}

function fetchJson(url, options = {}) {
  return fetch(url, options).then((response) => {
    if (!response.ok) {
      throw new Error('Network error');
    }
    return response.json();
  });
}

function generateLocalId() {
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function ensurePositionsList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}
