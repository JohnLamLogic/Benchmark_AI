const PDFDocument = require('pdfkit');

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const summarizeShifts = (shiftRows) => {
  if (!shiftRows || shiftRows.length === 0) {
    return 'Off';
  }

  return shiftRows
    .map((shift) => {
      const time = shift.startTime || shift.endTime ? `${shift.startTime || 'TBD'}-${shift.endTime || 'TBD'}` : 'Time TBD';
      return `${shift.position} (${time})${shift.note ? ` — ${shift.note}` : ''}`;
    })
    .join('\n');
};

const buildShiftMap = (employees, shifts) => {
  const map = {};
  employees.forEach((employee) => {
    map[employee.id] = {};
  });

  shifts.forEach((shift) => {
    const entry = map[shift.employeeId];
    if (!entry) {
      return;
    }

    entry[shift.day] = entry[shift.day] || [];
    entry[shift.day].push(shift);
  });

  return map;
};

const buildSchedulePdf = async (schedule, employees, shifts) => {
  const shiftMap = buildShiftMap(employees, shifts);
  const doc = new PDFDocument({ size: 'LETTER', margin: 40 });
  const buffers = [];

  return new Promise((resolve, reject) => {
    doc.on('error', reject);
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));

    const tableLeft = doc.page.margins.left;
    const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = tableWidth / 8;
    const headerHeight = 30;
    const baseY = doc.y;

    doc.fontSize(18).text('Weekly Staff Schedule', { align: 'center' });
    const startDate = new Date(schedule.weekStart);
    const endDate = new Date(schedule.weekStart);
    endDate.setDate(endDate.getDate() + 6);
    const weekLabel = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
    doc.fontSize(12).text(`Week of ${weekLabel}`, { align: 'center' });
    doc.moveDown(1);

    let cursorY = doc.y;

    const drawRow = (rowY, height, textFn) => {
      for (let col = 0; col < 8; col += 1) {
        doc.rect(tableLeft + colWidth * col, rowY, colWidth, height).stroke();
        if (textFn) {
          doc.fontSize(10);
          const cellX = tableLeft + colWidth * col;
          const content = textFn(col);
          const padding = 4;
          doc.text(content, cellX + padding, rowY + padding, { width: colWidth - padding * 2, height: height - padding * 2 });
        }
      }
    };

    drawRow(cursorY, headerHeight, (col) => {
      if (col === 0) {
        return 'Employee';
      }
      return DAY_NAMES[col - 1];
    });
    cursorY += headerHeight;

    const rowHeight = 70;
    employees.forEach((employee) => {
      if (cursorY + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        cursorY = doc.y;
        drawRow(cursorY, headerHeight, (col) => (col === 0 ? 'Employee' : DAY_NAMES[col - 1]));
        cursorY += headerHeight;
      }

      const employeeShiftMap = shiftMap[employee.id] || {};

      drawRow(cursorY, rowHeight, (col) => {
        if (col === 0) {
          return `${employee.name}\n${employee.positions.join(', ')}`;
        }
        const dayIndex = col - 1;
        return summarizeShifts(employeeShiftMap[dayIndex]);
      });
      cursorY += rowHeight;
    });

    doc.end();
  });
};

module.exports = {
  buildSchedulePdf,
  DAY_NAMES
};
