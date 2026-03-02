require('dotenv').config();
const express = require('express');
const path = require('path');
const PDFDocument = require('pdfkit');
const db = require('./database');
const gmail = require('./gmail');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── EMPLOYEE ROUTES ──────────────────────────────────────────────────────────

app.get('/api/employees', (req, res) => {
    res.json(db.getAllEmployees());
});

app.post('/api/employees', (req, res) => {
    const { name, positions, email } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });
    const id = db.createEmployee(name, positions || [], email);
    res.json({ id, name, positions: positions || [], email });
});

app.put('/api/employees/:id', (req, res) => {
    const { name, positions, email } = req.body;
    const id = parseInt(req.params.id);
    if (!db.getEmployeeById(id)) return res.status(404).json({ error: 'Employee not found' });
    db.updateEmployee(id, name, positions || [], email);
    res.json({ id, name, positions: positions || [], email });
});

app.delete('/api/employees/:id', (req, res) => {
    const id = parseInt(req.params.id);
    if (!db.getEmployeeById(id)) return res.status(404).json({ error: 'Employee not found' });
    db.deleteEmployee(id);
    res.json({ success: true });
});

// ─── SHIFT ROUTES ─────────────────────────────────────────────────────────────

app.get('/api/shifts', (req, res) => {
    const { weekStart } = req.query;
    if (!weekStart) return res.status(400).json({ error: 'weekStart required' });
    res.json(db.getShiftsForWeek(weekStart));
});

app.post('/api/shifts', (req, res) => {
    const { employeeId, weekStart, dayOfWeek, startTime, endTime, position } = req.body;
    if (!employeeId || !weekStart || dayOfWeek === undefined || !startTime || !endTime || !position)
        return res.status(400).json({ error: 'Missing required fields' });
    const id = db.createShift(employeeId, weekStart, dayOfWeek, startTime, endTime, position);
    res.json({ id, employeeId, weekStart, dayOfWeek, startTime, endTime, position });
});

app.put('/api/shifts/:id', (req, res) => {
    const { dayOfWeek, startTime, endTime, position } = req.body;
    const id = parseInt(req.params.id);
    const shift = db.getShiftById(id);
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    db.updateShift(id, dayOfWeek, startTime, endTime, position);
    res.json({ success: true });
});

app.delete('/api/shifts/:id', (req, res) => {
    const id = parseInt(req.params.id);
    db.deleteShift(id);
    res.json({ success: true });
});

// ─── SAVED SCHEDULE ROUTES ────────────────────────────────────────────────────

app.get('/api/saved-schedules', (req, res) => {
    res.json(db.getAllSavedSchedules());
});

app.post('/api/saved-schedules', (req, res) => {
    const { name, weekStart } = req.body;
    if (!name || !weekStart) return res.status(400).json({ error: 'name and weekStart required' });
    const shifts = db.getShiftsForWeek(weekStart);
    if (shifts.length === 0) return res.status(400).json({ error: 'No shifts to save for this week' });
    const id = db.createSavedSchedule(name, weekStart, shifts);
    res.json({ id, name, weekStart });
});

app.post('/api/saved-schedules/:id/load', (req, res) => {
    const savedId = parseInt(req.params.id);
    const { targetWeekStart } = req.body;
    if (!targetWeekStart) return res.status(400).json({ error: 'targetWeekStart required' });

    const savedSchedule = db.getSavedScheduleById(savedId);
    if (!savedSchedule) return res.status(404).json({ error: 'Saved schedule not found' });

    const savedShifts = db.getShiftsForSavedSchedule(savedId);

    // Delete existing live shifts for that week
    db.deleteWeekShifts(targetWeekStart);

    // Re-create shifts in the target week
    for (const shift of savedShifts) {
        db.createShift(
            shift.employee_id, targetWeekStart, shift.day_of_week,
            shift.start_time, shift.end_time, shift.position
        );
    }

    res.json({ success: true, shiftsLoaded: savedShifts.length });
});

app.delete('/api/saved-schedules/:id', (req, res) => {
    const id = parseInt(req.params.id);
    db.deleteSavedSchedule(id);
    res.json({ success: true });
});

// ─── PDF GENERATION ───────────────────────────────────────────────────────────

function generateSchedulePDF(weekStart, shifts, employees) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ layout: 'landscape', margin: 30 });
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const pageW = doc.page.width;
        const pageH = doc.page.height;
        const margin = 30;

        // Helper to get week dates
        const weekDate = new Date(weekStart + 'T00:00:00');
        const getDayDate = (i) => {
            const d = new Date(weekDate);
            d.setDate(d.getDate() + i);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        };

        // Title
        doc.fontSize(16).font('Helvetica-Bold')
            .text(`Weekly Schedule — Week of ${weekDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, margin, margin, { align: 'center' });

        const startY = margin + 30;
        const nameColW = 100;
        const usableW = pageW - margin * 2 - nameColW;
        const colW = usableW / 7;
        const headerH = 40;

        // Build shift map: employeeId -> dayOfWeek -> shifts[]
        const shiftMap = {};
        for (const s of shifts) {
            if (!shiftMap[s.employee_id]) shiftMap[s.employee_id] = {};
            if (!shiftMap[s.employee_id][s.day_of_week]) shiftMap[s.employee_id][s.day_of_week] = [];
            shiftMap[s.employee_id][s.day_of_week].push(s);
        }

        // Calculate row heights
        const rowHeights = employees.map(emp => {
            let maxShifts = 1;
            for (let d = 0; d < 7; d++) {
                const count = (shiftMap[emp.id] && shiftMap[emp.id][d]) ? shiftMap[emp.id][d].length : 0;
                if (count > maxShifts) maxShifts = count;
            }
            return Math.max(45, maxShifts * 28);
        });

        // Header row
        doc.rect(margin, startY, nameColW, headerH).fill('#1e293b').stroke();
        doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold')
            .text('Employee', margin + 4, startY + 14, { width: nameColW - 8, align: 'center' });

        for (let d = 0; d < 7; d++) {
            const x = margin + nameColW + d * colW;
            doc.rect(x, startY, colW, headerH).fill('#1e293b').stroke();
            doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold')
                .text(days[d], x + 2, startY + 6, { width: colW - 4, align: 'center' });
            doc.fillColor('#94a3b8').fontSize(7).font('Helvetica')
                .text(getDayDate(d), x + 2, startY + 20, { width: colW - 4, align: 'center' });
        }

        // Employee rows
        let currentY = startY + headerH;
        const pastelColors = ['#f0fdf4', '#eff6ff', '#fdf4ff', '#fff7ed', '#f0fdfa', '#fef9c3', '#fdf2f8'];

        employees.forEach((emp, idx) => {
            const rowH = rowHeights[idx];
            const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

            // Name cell
            doc.rect(margin, currentY, nameColW, rowH).fill(rowBg).stroke('#e2e8f0');
            doc.fillColor('#1e293b').fontSize(8).font('Helvetica-Bold')
                .text(emp.name, margin + 4, currentY + 8, { width: nameColW - 8, align: 'left' });

            // Day cells
            for (let d = 0; d < 7; d++) {
                const x = margin + nameColW + d * colW;
                doc.rect(x, currentY, colW, rowH).fill(rowBg).stroke('#e2e8f0');

                const dayShifts = (shiftMap[emp.id] && shiftMap[emp.id][d]) ? shiftMap[emp.id][d] : [];
                dayShifts.forEach((shift, si) => {
                    const sy = currentY + 5 + si * 28;
                    doc.rect(x + 2, sy, colW - 4, 24).fill(pastelColors[d % pastelColors.length]).stroke('#cbd5e1');
                    doc.fillColor('#1e293b').fontSize(7).font('Helvetica-Bold')
                        .text(shift.position, x + 4, sy + 3, { width: colW - 8, align: 'left' });
                    doc.fillColor('#334155').fontSize(6.5).font('Helvetica')
                        .text(`${shift.start_time} – ${shift.end_time}`, x + 4, sy + 12, { width: colW - 8, align: 'left' });
                });
            }

            currentY += rowH;
        });

        // Footer
        doc.fillColor('#94a3b8').fontSize(7).font('Helvetica')
            .text(`Generated: ${new Date().toLocaleString()}`, margin, pageH - 20, { align: 'left' });

        doc.end();
    });
}

app.get('/api/pdf', async (req, res) => {
    const { weekStart } = req.query;
    if (!weekStart) return res.status(400).json({ error: 'weekStart required' });

    const shifts = db.getShiftsForWeek(weekStart);
    const employees = db.getAllEmployees();

    try {
        const pdfBuffer = await generateSchedulePDF(weekStart, shifts, employees);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="schedule_${weekStart}.pdf"`,
            'Content-Length': pdfBuffer.length,
        });
        res.send(pdfBuffer);
    } catch (err) {
        console.error('PDF generation error:', err);
        res.status(500).json({ error: 'PDF generation failed' });
    }
});

// ─── GMAIL AUTH ROUTES ────────────────────────────────────────────────────────

app.get('/auth/gmail', (req, res) => {
    if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
        return res.status(503).send('Gmail credentials not configured. Please set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env');
    }
    const url = gmail.getAuthUrl();
    res.redirect(url);
});

app.get('/auth/gmail/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send('No authorization code received.');
    try {
        await gmail.handleCallback(code);
        res.send(`<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f172a;color:#f1f5f9">
      <div style="text-align:center">
        <h2 style="color:#4ade80">✓ Gmail Connected!</h2>
        <p>You can close this tab and return to the scheduler.</p>
        <script>setTimeout(()=>window.close(),2000)</script>
      </div></body></html>`);
    } catch (err) {
        console.error('Gmail auth error:', err);
        res.status(500).send('Authentication failed: ' + err.message);
    }
});

app.get('/auth/gmail/status', (req, res) => {
    res.json({
        connected: gmail.isAuthorized(),
        configured: !!(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET),
    });
});

app.post('/auth/gmail/disconnect', (req, res) => {
    const fs = require('fs');
    const tokenPath = require('path').join(__dirname, 'tokens.json');
    if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath);
    res.json({ success: true });
});

// ─── EMAIL SEND ROUTE ─────────────────────────────────────────────────────────

app.post('/api/email/send', async (req, res) => {
    const { weekStart } = req.body;
    if (!weekStart) return res.status(400).json({ error: 'weekStart required' });

    if (!gmail.isAuthorized()) {
        return res.status(401).json({ error: 'Gmail not authorized. Please connect Gmail first.' });
    }

    const employees = db.getAllEmployees();
    if (employees.length === 0) return res.status(400).json({ error: 'No employees to email' });

    const shifts = db.getShiftsForWeek(weekStart);
    let pdfBuffer;
    try {
        pdfBuffer = await generateSchedulePDF(weekStart, shifts, employees);
    } catch (err) {
        return res.status(500).json({ error: 'PDF generation failed' });
    }

    const weekDate = new Date(weekStart + 'T00:00:00');
    const weekLabel = weekDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const subject = `Your Schedule – Week of ${weekLabel}`;

    const results = [];
    for (const emp of employees) {
        if (!emp.email) continue;
        try {
            await gmail.sendEmail(emp.email, emp.name, subject, pdfBuffer, weekLabel);
            results.push({ name: emp.name, email: emp.email, status: 'sent' });
        } catch (err) {
            console.error(`Failed to send to ${emp.email}:`, err.message);
            results.push({ name: emp.name, email: emp.email, status: 'failed', error: err.message });
        }
    }

    res.json({ results });
});

// ─── START SERVER ─────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🍽️  Restaurant Scheduler running at http://localhost:${PORT}\n`);
});
