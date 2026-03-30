import { PDFDocument, StandardFonts, PDFFont } from 'pdf-lib';
import { ShiftRecord, EmployeeRecord } from './types';
import { DAY_LABELS } from './helpers';

interface LayoutState {
  page: ReturnType<PDFDocument['addPage']>;
  y: number;
  font: PDFFont;
  boldFont: PDFFont;
  pdfDoc: PDFDocument;
}

function ensureSpace(state: LayoutState, height: number) {
  if (state.y - height < 40) {
    state.page = state.pdfDoc.addPage([612, 792]);
    state.y = state.page.getHeight() - 40;
  }
}

export async function buildSchedulePdf(shifts: ShiftRecord[], employees: EmployeeRecord[], weekStart: string) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([612, 792]);
  const state: LayoutState = {
    page,
    y: page.getHeight() - 40,
    font,
    boldFont,
    pdfDoc
  };

  const drawText = (text: string, size: number, fontToUse: PDFFont = font, x = 50) => {
    state.page.drawText(text, {
      x,
      y: state.y,
      size,
      font: fontToUse
    });
  };

  const lineHeight = 16;
  drawText('Weekly Schedule', 18, boldFont);
  state.y -= lineHeight * 1.5;
  drawText(`Week beginning ${weekStart}`, 12);
  state.y -= lineHeight * 1.5;

  const scheduleByEmployee: Record<number, ShiftRecord[]> = {};
  shifts.forEach((shift) => {
    scheduleByEmployee[shift.employeeId] = scheduleByEmployee[shift.employeeId] || [];
    scheduleByEmployee[shift.employeeId].push(shift);
  });

  const sortedEmployees = [...employees].sort((a, b) => a.name.localeCompare(b.name));

  for (const employee of sortedEmployees) {
    ensureSpace(state, lineHeight * (DAY_LABELS.length + 3));
    drawText(employee.name, 14, boldFont);
    state.y -= lineHeight;
    drawText(`Positions: ${employee.positions.join(', ')}`, 10);
    state.y -= lineHeight;
    DAY_LABELS.forEach((dayLabel, dayIndex) => {
      const dayShifts = (scheduleByEmployee[employee.id] ?? []).filter((shift) => shift.day === dayIndex);
      const text =
        dayShifts.length === 0
          ? 'No assignment'
          : dayShifts.map((shift) => `${shift.startTime} - ${shift.endTime} (${shift.position})`).join(' • ');
      drawText(`${dayLabel}: ${text}`, 10);
      state.y -= lineHeight;
    });
    state.y -= lineHeight / 2;
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
