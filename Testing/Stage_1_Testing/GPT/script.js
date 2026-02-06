const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const schedule = [];

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `shift-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

const dayGrid = document.querySelector('.grid');
const dayTemplate = document.getElementById('day-template');
const form = document.getElementById('shift-form');
const emptyState = document.getElementById('empty-state');
const exportButton = document.getElementById('export-schedule');
const submitButton = document.getElementById('submit-button');

function buildWeek() {
  dayGrid.innerHTML = '';
  days.forEach((day) => {
    const clone = dayTemplate.content.cloneNode(true);
    const dayColumn = clone.querySelector('.day-column');
    dayColumn.dataset.day = day;
    dayColumn.querySelector('h3').textContent = day;
    dayGrid.appendChild(clone);
  });
}

function renderSchedule() {
  const grouped = {};
  days.forEach((day) => {
    grouped[day] = [];
  });
  schedule.forEach((shift) => {
    if (grouped[shift.day]) {
      grouped[shift.day].push(shift);
    }
  });
  let hasShifts = false;
  days.forEach((day) => {
    const column = dayGrid.querySelector(`.day-column[data-day="${day}"]`);
    const shiftContainer = column.querySelector('.shifts');
    shiftContainer.innerHTML = '';
    grouped[day]
      .sort((a, b) => a.start.localeCompare(b.start))
      .forEach((shift) => {
        hasShifts = true;
        shiftContainer.appendChild(renderShiftCard(shift));
      });
    const countLabel = column.querySelector('.day-date');
    const count = grouped[day].length;
    countLabel.textContent = count ? `${count} shift${count === 1 ? '' : 's'}` : 'No shifts yet';
  });
  emptyState.style.display = hasShifts ? 'none' : 'block';
}

function renderShiftCard(shift) {
  const card = document.createElement('div');
  card.className = 'shift-card';
  card.dataset.id = shift.id;

  const nameTitle = document.createElement('strong');
  nameTitle.textContent = shift.name;
  card.appendChild(nameTitle);

  const timeMeta = document.createElement('div');
  timeMeta.className = 'shift-meta';
  timeMeta.textContent = `${shift.start} – ${shift.end}`;
  card.appendChild(timeMeta);

  const positionMeta = document.createElement('div');
  positionMeta.className = 'shift-meta';
  positionMeta.textContent = shift.position;
  card.appendChild(positionMeta);

  const actions = document.createElement('div');
  actions.className = 'shift-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'edit';
  editBtn.type = 'button';
  editBtn.textContent = 'Edit';
  editBtn.dataset.action = 'edit';
  editBtn.dataset.shiftId = shift.id;

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete';
  deleteBtn.type = 'button';
  deleteBtn.textContent = 'Remove';
  deleteBtn.dataset.action = 'delete';
  deleteBtn.dataset.shiftId = shift.id;

  actions.append(editBtn, deleteBtn);
  card.appendChild(actions);

  return card;
}

function populateForm(shift) {
  document.getElementById('shift-id').value = shift.id;
  document.getElementById('name').value = shift.name;
  document.getElementById('position').value = shift.position;
  document.getElementById('day').value = shift.day;
  document.getElementById('start').value = shift.start;
  document.getElementById('end').value = shift.end;
  submitButton.textContent = 'Update Shift';
}

function deleteShift(id) {
  const index = schedule.findIndex((shift) => shift.id === id);
  if (index > -1) {
    schedule.splice(index, 1);
    renderSchedule();
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const id = formData.get('shift-id');
  const newShift = {
    id: id || generateId(),
    name: formData.get('name').trim(),
    position: formData.get('position').trim(),
    day: formData.get('day'),
    start: formData.get('start'),
    end: formData.get('end'),
  };

  if (!newShift.name || !newShift.position || !newShift.day || !newShift.start || !newShift.end) {
    return;
  }

  if (newShift.start >= newShift.end) {
    alert('End time must be after start time.');
    return;
  }

  if (id) {
    const idx = schedule.findIndex((shift) => shift.id === id);
    schedule[idx] = newShift;
  } else {
    schedule.push(newShift);
  }

  form.reset();
  document.getElementById('shift-id').value = '';
  submitButton.textContent = 'Add to Schedule';
  renderSchedule();
});

form.addEventListener('reset', () => {
  document.getElementById('shift-id').value = '';
  submitButton.textContent = 'Add to Schedule';
});

exportButton.addEventListener('click', async () => {
  const schedulePanel = document.getElementById('week-schedule');
  if (schedule.length === 0) {
    alert('Add at least one shift before downloading.');
    return;
  }
  const { jsPDF } = window.jspdf;
  const canvas = await html2canvas(schedulePanel, { backgroundColor: '#ffffff' });
  const imageData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('landscape', 'pt', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
  pdf.addImage(imageData, 'PNG', 0, 0, canvas.width * ratio, canvas.height * ratio);
  const filename = `Weekly-Schedule-${new Date().toISOString().split('T')[0]}.pdf`;
  pdf.save(filename);
});

buildWeek();
renderSchedule();

dayGrid.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button || !dayGrid.contains(button)) return;
  const action = button.dataset.action;
  const id = button.dataset.shiftId;
  if (action === 'edit') {
    const shift = schedule.find((entry) => entry.id === id);
    if (shift) {
      populateForm(shift);
    }
  } else if (action === 'delete') {
    deleteShift(id);
  }
});
