const PDFDocument = require('pdfkit');

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Format a 24-hour time string to 12-hour AM/PM format
 */
function formatTime(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Format a date string like "2024-01-14" to "January 14, 2024"
 */
function formatDate(dateStr) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const [year, month, day] = dateStr.split('-').map(Number);
  return `${months[month - 1]} ${day}, ${year}`;
}

/**
 * Generate a PDF schedule for a given week
 * @param {string} weekStart - ISO date string "YYYY-MM-DD"
 * @param {Array} shifts - array of shift objects with employee_name, day_of_week, start_time, end_time, position
 * @param {Array} employees - array of employee objects
 * @returns {Promise<Buffer>} - PDF as a Buffer
 */
async function generateSchedulePDF(weekStart, shifts, employees) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 30,
        size: 'LETTER',
        layout: 'landscape'
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Colors
      const headerBg = '#8B1A1A';      // Dark red
      const headerText = '#FFFFFF';
      const altRowBg = '#FFF5F5';      // Light pink
      const rowBg = '#FFFFFF';
      const borderColor = '#CCCCCC';
      const titleColor = '#5C1010';
      const shiftColor = '#333333';
      const positionColor = '#8B1A1A';

      const pageWidth = doc.page.width - 60; // margins
      const startX = 30;
      let currentY = 30;

      // ---- Title ----
      doc.fontSize(20).fillColor(titleColor).font('Helvetica-Bold')
        .text(`Weekly Schedule`, startX, currentY, { align: 'center', width: pageWidth });
      currentY += 25;

      doc.fontSize(13).fillColor('#444444').font('Helvetica')
        .text(`Week of ${formatDate(weekStart)}`, startX, currentY, { align: 'center', width: pageWidth });
      currentY += 20;

      // Horizontal rule
      doc.moveTo(startX, currentY).lineTo(startX + pageWidth, currentY).strokeColor(headerBg).lineWidth(2).stroke();
      currentY += 10;

      // ---- Build schedule data ----
      // Get employees who actually have shifts
      const employeeIds = [...new Set(shifts.map(s => s.employee_id))];
      const scheduledEmployees = employees.filter(e => employeeIds.includes(e.id));

      if (scheduledEmployees.length === 0) {
        doc.fontSize(12).fillColor('#666666').font('Helvetica')
          .text('No shifts scheduled for this week.', startX, currentY, { align: 'center', width: pageWidth });
        doc.end();
        return;
      }

      // Build map: employeeId -> dayOfWeek -> [shifts]
      const shiftMap = {};
      for (const emp of scheduledEmployees) {
        shiftMap[emp.id] = {};
        for (let d = 0; d < 7; d++) {
          shiftMap[emp.id][d] = [];
        }
      }
      for (const shift of shifts) {
        if (shiftMap[shift.employee_id]) {
          shiftMap[shift.employee_id][shift.day_of_week].push(shift);
        }
      }

      // ---- Table dimensions ----
      const nameColWidth = 120;
      const dayColWidth = (pageWidth - nameColWidth) / 7;
      const rowHeight = 55;
      const headerHeight = 28;

      // Draw table header background
      doc.rect(startX, currentY, pageWidth, headerHeight)
        .fillColor(headerBg).fill();

      // Header text: Employee Name
      doc.fontSize(9).fillColor(headerText).font('Helvetica-Bold')
        .text('Employee', startX + 4, currentY + 9, { width: nameColWidth - 8, align: 'center' });

      // Header text: Days
      for (let d = 0; d < 7; d++) {
        const cellX = startX + nameColWidth + d * dayColWidth;
        doc.text(DAY_ABBR[d], cellX + 2, currentY + 9, { width: dayColWidth - 4, align: 'center' });
      }

      currentY += headerHeight;

      // Draw employee rows
      for (let i = 0; i < scheduledEmployees.length; i++) {
        const emp = scheduledEmployees[i];
        const bg = i % 2 === 0 ? rowBg : altRowBg;

        // Determine row height based on max shifts in any day
        let maxShiftsInDay = 1;
        for (let d = 0; d < 7; d++) {
          const dayShifts = shiftMap[emp.id][d];
          if (dayShifts.length > maxShiftsInDay) maxShiftsInDay = dayShifts.length;
        }
        const actualRowHeight = Math.max(rowHeight, maxShiftsInDay * 38);

        // Check if we need a new page
        if (currentY + actualRowHeight > doc.page.height - 40) {
          doc.addPage({ margin: 30, size: 'LETTER', layout: 'landscape' });
          currentY = 30;

          // Redraw header on new page
          doc.rect(startX, currentY, pageWidth, headerHeight).fillColor(headerBg).fill();
          doc.fontSize(9).fillColor(headerText).font('Helvetica-Bold')
            .text('Employee', startX + 4, currentY + 9, { width: nameColWidth - 8, align: 'center' });
          for (let d = 0; d < 7; d++) {
            const cellX = startX + nameColWidth + d * dayColWidth;
            doc.text(DAY_ABBR[d], cellX + 2, currentY + 9, { width: dayColWidth - 4, align: 'center' });
          }
          currentY += headerHeight;
        }

        // Row background
        doc.rect(startX, currentY, pageWidth, actualRowHeight)
          .fillColor(bg).fill();

        // Employee name cell
        doc.rect(startX, currentY, nameColWidth, actualRowHeight)
          .strokeColor(borderColor).lineWidth(0.5).stroke();
        doc.fontSize(9).fillColor('#222222').font('Helvetica-Bold')
          .text(emp.name, startX + 4, currentY + (actualRowHeight / 2) - 6, {
            width: nameColWidth - 8,
            align: 'left',
            ellipsis: true
          });

        // Day cells
        for (let d = 0; d < 7; d++) {
          const cellX = startX + nameColWidth + d * dayColWidth;
          doc.rect(cellX, currentY, dayColWidth, actualRowHeight)
            .strokeColor(borderColor).lineWidth(0.5).stroke();

          const dayShifts = shiftMap[emp.id][d];
          if (dayShifts.length > 0) {
            let shiftY = currentY + 6;
            for (const shift of dayShifts) {
              const timeStr = `${formatTime(shift.start_time)} - ${formatTime(shift.end_time)}`;

              // Small colored background for shift chip
              doc.rect(cellX + 2, shiftY - 2, dayColWidth - 4, 32)
                .fillColor('#FFE8E8').fill();
              doc.rect(cellX + 2, shiftY - 2, dayColWidth - 4, 32)
                .strokeColor('#CC7777').lineWidth(0.3).stroke();

              doc.fontSize(7).fillColor(shiftColor).font('Helvetica')
                .text(timeStr, cellX + 4, shiftY + 2, { width: dayColWidth - 8, align: 'center' });
              doc.fontSize(7).fillColor(positionColor).font('Helvetica-Bold')
                .text(shift.position, cellX + 4, shiftY + 13, { width: dayColWidth - 8, align: 'center' });

              shiftY += 36;
            }
          }
        }

        currentY += actualRowHeight;
      }

      // Bottom border
      doc.moveTo(startX, currentY).lineTo(startX + pageWidth, currentY)
        .strokeColor(borderColor).lineWidth(0.5).stroke();

      // Footer
      currentY += 15;
      const genDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
      doc.fontSize(8).fillColor('#888888').font('Helvetica')
        .text(`Generated on ${genDate}`, startX, currentY, { align: 'right', width: pageWidth });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateSchedulePDF };
