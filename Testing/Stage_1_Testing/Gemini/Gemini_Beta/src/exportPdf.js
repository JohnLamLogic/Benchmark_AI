import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; // Import as functional default
import { DAYS } from './utils';

export function downloadSchedulePdf(employees, shifts) {
    try {
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        // Title
        doc.setFontSize(22);
        try {
            doc.setTextColor(40, 40, 40);
        } catch (e) {
            console.warn('Set text color failed', e);
        }
        doc.text('Weekly Schedule', 14, 20);

        // Date Generated
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 28);

        // Prepare table data
        // Columns: Employee + Days
        const columns = ['Employee', ...DAYS];

        const rows = employees.map(emp => {
            const rowData = [emp.name];

            DAYS.forEach(day => {
                const dailyShifts = shifts.filter(s => s.employeeId === emp.id && s.day === day);
                if (dailyShifts.length > 0) {
                    // Join multiple shifts with a separator
                    const cellText = dailyShifts.map(shift =>
                        `${shift.time}\n[${shift.position}]`
                    ).join('\n---\n');

                    rowData.push(cellText);
                } else {
                    rowData.push('');
                }
            });

            return rowData;
        });

        // Use functional usage: autoTable(doc, options)
        autoTable(doc, {
            head: [columns],
            body: rows,
            startY: 35,
            theme: 'grid',
            headStyles: {
                fillColor: [99, 102, 241], // Indigo 500
                textColor: 255,
                fontSize: 10,
                halign: 'center',
                valign: 'middle'
            },
            styles: {
                fontSize: 8,
                cellPadding: 4,
                valign: 'middle',
                halign: 'center', // Center text
                overflow: 'linebreak'
            },
            columnStyles: {
                0: {
                    halign: 'left',
                    fontStyle: 'bold',
                    cellWidth: 35
                } // Employee column left-aligned
            },
            // Alternate row colors
            alternateRowStyles: {
                fillColor: [248, 250, 252]
            }
        });

        doc.save('weekly-schedule.pdf');
    } catch (error) {
        console.error("PDF Generation Error (Detailed):", error);
        alert(`Failed to generate PDF. Error: ${error.message}`);
    }
}
