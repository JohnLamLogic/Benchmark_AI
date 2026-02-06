// ==========================================
// Data Management
// ==========================================
let shifts = [];
let editingShiftId = null;
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ==========================================
// Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initializeCalendar();
    setupEventListeners();
    renderCalendar();
});

// ==========================================
// Calendar Initialization
// ==========================================
function initializeCalendar() {
    const weekGrid = document.getElementById('weekGrid');
    weekGrid.innerHTML = '';

    DAYS_OF_WEEK.forEach(day => {
        const dayColumn = document.createElement('div');
        dayColumn.className = 'day-column';
        dayColumn.setAttribute('data-day', day);

        dayColumn.innerHTML = `
            <div class="day-header">
                <div class="day-name">${day}</div>
                <div class="shift-count">0 shifts</div>
            </div>
            <div class="shifts-list" data-day="${day}">
                <div class="empty-state">No shifts scheduled</div>
            </div>
        `;

        weekGrid.appendChild(dayColumn);
    });
}

// ==========================================
// Event Listeners
// ==========================================
function setupEventListeners() {
    // Add Shift Button
    document.getElementById('addShiftBtn').addEventListener('click', openAddShiftModal);

    // Download PDF Button
    document.getElementById('downloadPdfBtn').addEventListener('click', downloadPDF);

    // Modal Close Buttons
    document.getElementById('closeModal').addEventListener('click', closeShiftModal);
    document.getElementById('cancelBtn').addEventListener('click', closeShiftModal);

    // Delete Modal Buttons
    document.getElementById('closeDeleteModal').addEventListener('click', closeDeleteModal);
    document.getElementById('cancelDeleteBtn').addEventListener('click', closeDeleteModal);
    document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDelete);

    // Form Submit
    document.getElementById('shiftForm').addEventListener('submit', handleFormSubmit);

    // Click outside modal to close
    window.addEventListener('click', (e) => {
        const shiftModal = document.getElementById('shiftModal');
        const deleteModal = document.getElementById('deleteModal');

        if (e.target === shiftModal) {
            closeShiftModal();
        }
        if (e.target === deleteModal) {
            closeDeleteModal();
        }
    });
}

// ==========================================
// Modal Functions
// ==========================================
function openAddShiftModal() {
    editingShiftId = null;
    document.getElementById('modalTitle').textContent = 'Add New Shift';
    document.getElementById('submitBtnText').textContent = 'Add Shift';
    document.getElementById('shiftForm').reset();
    document.getElementById('shiftModal').classList.add('active');
}

function openEditShiftModal(shiftId) {
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) return;

    editingShiftId = shiftId;
    document.getElementById('modalTitle').textContent = 'Edit Shift';
    document.getElementById('submitBtnText').textContent = 'Update Shift';

    document.getElementById('shiftId').value = shift.id;
    document.getElementById('employeeName').value = shift.employeeName;
    document.getElementById('dayOfWeek').value = shift.day;
    document.getElementById('startTime').value = shift.startTime;
    document.getElementById('endTime').value = shift.endTime;
    document.getElementById('position').value = shift.position;

    document.getElementById('shiftModal').classList.add('active');
}

function closeShiftModal() {
    document.getElementById('shiftModal').classList.remove('active');
    document.getElementById('shiftForm').reset();
    editingShiftId = null;
}

let shiftToDelete = null;

function openDeleteModal(shiftId) {
    shiftToDelete = shiftId;
    document.getElementById('deleteModal').classList.add('active');
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
    shiftToDelete = null;
}

function confirmDelete() {
    if (shiftToDelete) {
        deleteShift(shiftToDelete);
        closeDeleteModal();
    }
}

// ==========================================
// CRUD Operations
// ==========================================
function handleFormSubmit(e) {
    e.preventDefault();

    const formData = {
        employeeName: document.getElementById('employeeName').value.trim(),
        day: document.getElementById('dayOfWeek').value,
        startTime: document.getElementById('startTime').value,
        endTime: document.getElementById('endTime').value,
        position: document.getElementById('position').value
    };

    // Validation
    if (!formData.employeeName || !formData.day || !formData.startTime || !formData.endTime || !formData.position) {
        alert('Please fill in all fields');
        return;
    }

    if (formData.startTime >= formData.endTime) {
        alert('End time must be after start time');
        return;
    }

    if (editingShiftId) {
        updateShift(editingShiftId, formData);
    } else {
        addShift(formData);
    }

    closeShiftModal();
}

function addShift(shiftData) {
    const newShift = {
        id: generateId(),
        ...shiftData
    };

    shifts.push(newShift);
    renderCalendar();
}

function updateShift(shiftId, shiftData) {
    const index = shifts.findIndex(s => s.id === shiftId);
    if (index !== -1) {
        shifts[index] = {
            id: shiftId,
            ...shiftData
        };
        renderCalendar();
    }
}

function deleteShift(shiftId) {
    shifts = shifts.filter(s => s.id !== shiftId);
    renderCalendar();
}

// ==========================================
// Rendering Functions
// ==========================================
function renderCalendar() {
    DAYS_OF_WEEK.forEach(day => {
        renderDay(day);
    });
}

function renderDay(day) {
    const dayShifts = shifts.filter(s => s.day === day);
    const shiftsList = document.querySelector(`.shifts-list[data-day="${day}"]`);
    const shiftCount = document.querySelector(`.day-column[data-day="${day}"] .shift-count`);

    // Update shift count
    shiftCount.textContent = `${dayShifts.length} shift${dayShifts.length !== 1 ? 's' : ''}`;

    // Clear current shifts
    shiftsList.innerHTML = '';

    if (dayShifts.length === 0) {
        shiftsList.innerHTML = '<div class="empty-state">No shifts scheduled</div>';
        return;
    }

    // Sort shifts by start time
    dayShifts.sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Render each shift
    dayShifts.forEach(shift => {
        const shiftCard = createShiftCard(shift);
        shiftsList.appendChild(shiftCard);
    });
}

function createShiftCard(shift) {
    const card = document.createElement('div');
    card.className = 'shift-card';
    card.setAttribute('data-position', shift.position);

    const timeFormatted = `${formatTime(shift.startTime)} - ${formatTime(shift.endTime)}`;

    card.innerHTML = `
        <div class="shift-header">
            <div class="employee-name">${escapeHtml(shift.employeeName)}</div>
            <button class="delete-btn" data-shift-id="${shift.id}" title="Delete shift">×</button>
        </div>
        <div class="shift-time">🕐 ${timeFormatted}</div>
        <div class="position-badge">${shift.position}</div>
    `;

    // Click card to edit
    card.addEventListener('click', (e) => {
        // Don't open edit if clicking delete button
        if (!e.target.classList.contains('delete-btn')) {
            openEditShiftModal(shift.id);
        }
    });

    // Delete button
    const deleteBtn = card.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openDeleteModal(shift.id);
    });

    return card;
}

// ==========================================
// PDF Generation
// ==========================================
function downloadPDF() {
    if (shifts.length === 0) {
        alert('No shifts to export. Please add some shifts first.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Title
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('Weekly Restaurant Schedule', 105, 20, { align: 'center' });

    // Date
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    doc.text(`Generated: ${currentDate}`, 105, 28, { align: 'center' });

    let yPos = 40;
    const leftMargin = 15;
    const pageHeight = doc.internal.pageSize.height;

    // Iterate through each day
    DAYS_OF_WEEK.forEach((day, dayIndex) => {
        const dayShifts = shifts.filter(s => s.day === day).sort((a, b) =>
            a.startTime.localeCompare(b.startTime)
        );

        // Check if we need a new page
        if (yPos > pageHeight - 60) {
            doc.addPage();
            yPos = 20;
        }

        // Day header
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(99, 102, 241);
        doc.text(day, leftMargin, yPos);
        yPos += 8;

        if (dayShifts.length === 0) {
            doc.setFontSize(10);
            doc.setFont(undefined, 'italic');
            doc.setTextColor(128, 128, 128);
            doc.text('No shifts scheduled', leftMargin + 5, yPos);
            yPos += 10;
        } else {
            doc.setTextColor(0, 0, 0);
            dayShifts.forEach(shift => {
                // Check if we need a new page
                if (yPos > pageHeight - 20) {
                    doc.addPage();
                    yPos = 20;
                }

                doc.setFontSize(10);
                doc.setFont(undefined, 'bold');
                doc.text(`• ${shift.employeeName}`, leftMargin + 5, yPos);

                doc.setFont(undefined, 'normal');
                const timeStr = `${formatTime(shift.startTime)} - ${formatTime(shift.endTime)}`;
                doc.text(timeStr, leftMargin + 60, yPos);
                doc.text(`[${shift.position}]`, leftMargin + 120, yPos);

                yPos += 6;
            });
            yPos += 4;
        }

        // Add separator line except after last day
        if (dayIndex < DAYS_OF_WEEK.length - 1) {
            doc.setDrawColor(200, 200, 200);
            doc.line(leftMargin, yPos, 195, yPos);
            yPos += 6;
        }
    });

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(`Page ${i} of ${pageCount}`, 105, pageHeight - 10, { align: 'center' });
    }

    // Save the PDF
    const fileName = `restaurant-schedule-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
}

// ==========================================
// Utility Functions
// ==========================================
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatTime(time24) {
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
