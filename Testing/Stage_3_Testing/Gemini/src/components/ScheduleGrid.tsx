"use client";

import { useState, useEffect } from "react";
import { Save, Download, Mail, Plus, X } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface Employee {
    id: number;
    name: string;
    positions: string;
}

interface Shift {
    id?: number;
    employeeId: number;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    position: string;
}

export default function ScheduleGrid() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [weekStartDate, setWeekStartDate] = useState(getMonday(new Date()).toISOString().split('T')[0]);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingShift, setEditingShift] = useState<Shift | null>(null);
    const [modalEmpId, setModalEmpId] = useState(0);
    const [modalDay, setModalDay] = useState(0);
    const [formStart, setFormStart] = useState("09:00");
    const [formEnd, setFormEnd] = useState("17:00");
    const [formPos, setFormPos] = useState("");

    const [savedWeeks, setSavedWeeks] = useState<{ id: number, start_date: string }[]>([]);

    useEffect(() => {
        fetchEmployees();
        fetchWeeks();
    }, []);

    useEffect(() => {
        fetchShiftsForWeek(weekStartDate);
    }, [weekStartDate]);

    function getMonday(d: Date) {
        d = new Date(d);
        var day = d.getDay(), diff = d.getDate() - day + (day == 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }

    const fetchEmployees = async () => {
        const res = await fetch('/api/employees');
        const data = await res.json();
        setEmployees(data);
    };

    const fetchWeeks = async () => {
        const res = await fetch('/api/weeks');
        const data = await res.json();
        setSavedWeeks(data);
    };

    const fetchShiftsForWeek = async (dateStr: string) => {
        const res = await fetch(`/api/weeks?date=${dateStr}`);
        const data = await res.json();
        if (data && data.shifts) {
            setShifts(data.shifts);
        } else {
            setShifts([]);
        }
    };

    const handleCellClick = (empId: number, dayIdx: number) => {
        const existing = shifts.find(s => s.employeeId === empId && s.dayOfWeek === dayIdx);
        setModalEmpId(empId);
        setModalDay(dayIdx);

        if (existing) {
            setEditingShift(existing);
            setFormStart(existing.startTime);
            setFormEnd(existing.endTime);
            setFormPos(existing.position);
        } else {
            setEditingShift(null);
            setFormStart("09:00");
            setFormEnd("17:00");
            setFormPos("");
        }
        setIsModalOpen(true);
    };

    const handleSaveShift = () => {
        const newShift: Shift = {
            ...(editingShift ? { id: editingShift.id } : {}),
            employeeId: modalEmpId,
            dayOfWeek: modalDay,
            startTime: formStart,
            endTime: formEnd,
            position: formPos
        };

        if (editingShift) {
            setShifts(shifts.map(s => (s.employeeId === modalEmpId && s.dayOfWeek === modalDay) ? newShift : s));
        } else {
            setShifts([...shifts, newShift]);
        }
        setIsModalOpen(false);
    };

    const handleDeleteShift = () => {
        setShifts(shifts.filter(s => !(s.employeeId === modalEmpId && s.dayOfWeek === modalDay)));
        setIsModalOpen(false);
    };

    const handleSaveWeek = async () => {
        const weekRes = await fetch('/api/weeks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                start_date: weekStartDate,
                shifts: shifts
            })
        });

        if (weekRes.ok) {
            fetchWeeks();
            alert("Week saved successfully!");
        } else {
            alert("Failed to save week.");
        }
    };

    const handleDownloadPDF = () => {
        const doc = new jsPDF("landscape");
        doc.setFont("helvetica", "bold");
        doc.text(`Weekly Schedule - Week of ${weekStartDate}`, 14, 15);

        const tableData = employees.map(emp => {
            const rowData = [emp.name];
            DAYS.forEach((_, dayIdx) => {
                const shift = shifts.find(s => s.employeeId === emp.id && s.dayOfWeek === dayIdx);
                rowData.push(shift ? `${shift.startTime} - ${shift.endTime}\n${shift.position}` : "");
            });
            return rowData;
        });

        autoTable(doc, {
            startY: 20,
            head: [["Employee", ...DAYS]],
            body: tableData,
            theme: "grid",
            styles: { cellWidth: "wrap" },
            headStyles: { fillColor: [79, 70, 229] } // Indigo 600
        });

        doc.save(`Schedule_${weekStartDate}.pdf`);
    };

    const handleSendEmails = async () => {
        try {
            const doc = new jsPDF("landscape");
            doc.setFont("helvetica", "bold");
            doc.text(`Weekly Schedule - Week of ${weekStartDate}`, 14, 15);

            const tableData = employees.map(emp => {
                const rowData = [emp.name];
                DAYS.forEach((_, dayIdx) => {
                    const shift = shifts.find(s => s.employeeId === emp.id && s.dayOfWeek === dayIdx);
                    rowData.push(shift ? `${shift.startTime} - ${shift.endTime}\n${shift.position}` : "");
                });
                return rowData;
            });

            autoTable(doc, {
                startY: 20,
                head: [["Employee", ...DAYS]],
                body: tableData,
                theme: "grid",
                styles: { cellWidth: "wrap" },
                headStyles: { fillColor: [79, 70, 229] }
            });

            const pdfBase64 = doc.output('datauristring');

            const res = await fetch('/api/emails/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pdfBase64, weekStartDate })
            });

            if (res.status === 401) {
                window.location.href = '/api/auth/google';
                return;
            }

            if (res.ok) {
                const data = await res.json();
                alert(`Successfully sent ${data.sent} emails!`);
            } else {
                alert("Failed to send emails.");
            }
        } catch (err) {
            alert("Error generating or sending emails.");
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Weekly Schedule</h2>

                <div className="flex gap-4">
                    <input
                        type="date"
                        value={weekStartDate}
                        onChange={(e) => setWeekStartDate(e.target.value)}
                        className="border p-2 rounded"
                    />
                    <select
                        className="border p-2 rounded"
                        onChange={(e) => {
                            if (e.target.value) setWeekStartDate(e.target.value);
                        }}
                    >
                        <option value="">Load Previous...</option>
                        {savedWeeks.map(w => (
                            <option key={w.id} value={w.start_date}>{w.start_date}</option>
                        ))}
                    </select>
                    <button onClick={handleSaveWeek} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                        <Save size={18} /> Save
                    </button>
                    <button onClick={handleSendEmails} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                        <Mail size={18} /> Send Out
                    </button>
                    <button onClick={handleDownloadPDF} className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900">
                        <Download size={18} /> PDF
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                        <tr>
                            <th className="p-3 border bg-gray-50 border-gray-200">Employee</th>
                            {DAYS.map(day => (
                                <th key={day} className="p-3 border bg-gray-50 border-gray-200 text-center w-32">{day}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {employees.map(emp => (
                            <tr key={emp.id}>
                                <td className="p-3 border border-gray-200 font-medium bg-gray-50">{emp.name}</td>
                                {DAYS.map((_, dayIdx) => {
                                    const shift = shifts.find(s => s.employeeId === emp.id && s.dayOfWeek === dayIdx);
                                    return (
                                        <td
                                            key={dayIdx}
                                            className="p-2 border border-gray-200 text-center cursor-pointer hover:bg-blue-50 transition-colors"
                                            onClick={() => handleCellClick(emp.id, dayIdx)}
                                        >
                                            {shift ? (
                                                <div className="bg-blue-100 text-blue-800 text-sm p-2 rounded">
                                                    <div className="font-semibold">{shift.startTime} - {shift.endTime}</div>
                                                    <div className="text-xs text-blue-600">{shift.position}</div>
                                                </div>
                                            ) : (
                                                <div className="text-gray-300 hover:text-blue-400 flex justify-center py-4">
                                                    <Plus size={20} />
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg w-96 shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">{editingShift ? 'Edit Shift' : 'Add Shift'}</h3>
                            <button onClick={() => setIsModalOpen(false)}><X size={20} /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm mb-1">Start Time</label>
                                    <input type="time" value={formStart} onChange={e => setFormStart(e.target.value)} className="w-full border p-2 rounded" />
                                </div>
                                <div>
                                    <label className="block text-sm mb-1">End Time</label>
                                    <input type="time" value={formEnd} onChange={e => setFormEnd(e.target.value)} className="w-full border p-2 rounded" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm mb-1">Position</label>
                                <input type="text" value={formPos} onChange={e => setFormPos(e.target.value)} className="w-full border p-2 rounded" placeholder="e.g. Server" />
                            </div>
                            <div className="flex gap-2 justify-end mt-6">
                                {editingShift && (
                                    <button onClick={handleDeleteShift} className="px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded">Remove</button>
                                )}
                                <button onClick={handleSaveShift} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
