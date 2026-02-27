import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, startOfWeek, addWeeks, subWeeks } from 'date-fns';
import { db, type Shift } from '../db';
import { ChevronLeft, ChevronRight, Copy, Download, Plus, X, Trash2, Users, Save } from 'lucide-react';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';

export default function ScheduleTab() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');

    const employees = useLiveQuery(() => db.employees.toArray()) || [];
    const allSchedules = useLiveQuery(() => db.schedules.toArray()) || [];
    const [localShifts, setLocalShifts] = useState<Shift[]>([]);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        let isMounted = true;
        db.schedules.get(weekStartStr).then(schedule => {
            if (isMounted) {
                setLocalShifts(schedule?.shifts || []);
                setIsDirty(false);
            }
        });
        return () => { isMounted = false; };
    }, [weekStartStr]);

    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [preloadModalOpen, setPreloadModalOpen] = useState(false);
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
    const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
    const [shiftForm, setShiftForm] = useState({
        startTime: '09:00',
        endTime: '17:00',
        position: ''
    });

    const daysOfWeek = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
    });

    const handlePrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
    const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));

    const handleDownloadPdf = async () => {
        const input = document.getElementById('schedule-grid');
        if (!input) return;

        try {
            const width = input.scrollWidth;
            const height = input.scrollHeight;

            const dataUrl = await toPng(input, {
                quality: 0.95,
                backgroundColor: '#ffffff',
                pixelRatio: 2,
                width: width,
                height: height,
                style: {
                    transform: 'none',
                    margin: '0'
                }
            });

            const pdf = new jsPDF({
                orientation: width > height ? 'landscape' : 'portrait',
                unit: 'px',
                format: [width, height]
            });

            pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
            pdf.save(`Schedule_${weekStartStr}.pdf`);
        } catch (err) {
            console.error('Failed to generate PDF', err);
            alert('There was an error generating the PDF.');
        }
    };

    const handleSaveSchedule = async () => {
        await db.schedules.put({
            id: weekStartStr,
            weekStartDate: weekStartStr,
            shifts: localShifts
        });
        setIsDirty(false);
    };

    const handleOpenPreload = () => {
        setPreloadModalOpen(true);
    };

    const applyPreload = async (selectedScheduleId: string) => {
        const selectedSchedule = await db.schedules.get(selectedScheduleId);

        if (selectedSchedule && selectedSchedule.shifts.length > 0) {
            if (confirm('This will overwrite the current unsaved schedule. Are you sure?')) {
                const newShifts = selectedSchedule.shifts.map(s => ({
                    ...s,
                    id: crypto.randomUUID(),
                    dayOfWeek: s.dayOfWeek // Inherit relative weekday positions
                }));
                setLocalShifts(newShifts);
                setIsDirty(true);
                setPreloadModalOpen(false);
            }
        }
    };

    const openShiftModal = (employeeId: string, dayIdx: number, existingShift?: Shift) => {
        setSelectedEmployeeId(employeeId);
        setSelectedDay(dayIdx);
        if (existingShift) {
            setEditingShiftId(existingShift.id);
            setShiftForm({
                startTime: existingShift.startTime,
                endTime: existingShift.endTime,
                position: existingShift.position
            });
        } else {
            setEditingShiftId(null);
            // Try to auto-select position if employee only has one
            const emp = employees.find(e => e.id === employeeId);
            setShiftForm({
                startTime: '09:00',
                endTime: '17:00',
                position: emp?.positions.length === 1 ? emp.positions[0] : ''
            });
        }
        setModalOpen(true);
    };

    const closeShiftModal = () => {
        setModalOpen(false);
        setSelectedDay(null);
        setSelectedEmployeeId(null);
        setEditingShiftId(null);
    };

    const saveShift = () => {
        if (!selectedEmployeeId || selectedDay === null || !shiftForm.position) {
            alert('Please fill out all fields.');
            return;
        }

        let updatedShifts;

        if (editingShiftId) {
            updatedShifts = localShifts.map(s =>
                s.id === editingShiftId
                    ? { ...s, startTime: shiftForm.startTime, endTime: shiftForm.endTime, position: shiftForm.position }
                    : s
            );
        } else {
            const newShift: Shift = {
                id: crypto.randomUUID(),
                employeeId: selectedEmployeeId,
                dayOfWeek: selectedDay,
                startTime: shiftForm.startTime,
                endTime: shiftForm.endTime,
                position: shiftForm.position
            };
            updatedShifts = [...localShifts, newShift];
        }

        setLocalShifts(updatedShifts);
        setIsDirty(true);
        closeShiftModal();
    };

    const deleteShift = () => {
        if (!editingShiftId) return;
        const updatedShifts = localShifts.filter(s => s.id !== editingShiftId);

        setLocalShifts(updatedShifts);
        setIsDirty(true);
        closeShiftModal();
    };

    return (
        <div className="space-y-6 relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={handlePrevWeek}
                        className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors bg-white shadow-sm"
                    >
                        <ChevronLeft className="h-5 w-5 text-slate-600" />
                    </button>
                    <div className="text-xl font-bold text-slate-800 w-64 text-center">
                        Week of {format(weekStart, 'MMM d, yyyy')}
                    </div>
                    <button
                        onClick={handleNextWeek}
                        className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors bg-white shadow-sm"
                    >
                        <ChevronRight className="h-5 w-5 text-slate-600" />
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSaveSchedule}
                        disabled={!isDirty}
                        className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors shadow-sm ${isDirty
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                        title={isDirty ? "Save changes to this week's schedule" : "No unsaved changes"}
                    >
                        <Save className="h-4 w-4 mr-2" />
                        Save
                    </button>
                    <button
                        onClick={handleOpenPreload}
                        className="inline-flex items-center px-4 py-2 border border-slate-300 bg-white text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        <Copy className="h-4 w-4 mr-2" />
                        Load Saved
                    </button>
                    <button
                        onClick={handleDownloadPdf}
                        className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Export PDF
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
                <div id="schedule-grid" className="min-w-[1000px] bg-white">
                    {/* Header Row */}
                    <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50/50">
                        <div className="px-4 py-3 font-medium text-sm text-slate-500 tracking-wider border-r border-slate-200 flex items-center justify-center">
                            Team Member
                        </div>
                        {daysOfWeek.map((day, i) => (
                            <div key={i} className={`px-2 py-3 text-center border-slate-200 ${i !== 6 ? 'border-r' : ''} ${format(new Date(), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd') ? 'bg-blue-50/50' : ''}`}>
                                <div className={`font-semibold text-sm ${format(new Date(), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd') ? 'text-blue-600' : 'text-slate-700'}`}>
                                    {format(day, 'EEEE')}
                                </div>
                                <div className={`text-xs mt-0.5 ${format(new Date(), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd') ? 'text-blue-500 font-medium' : 'text-slate-500'}`}>
                                    {format(day, 'MMM d')}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Employee Rows */}
                    <div className="divide-y divide-slate-100">
                        {employees.length === 0 ? (
                            <div className="p-12 text-center text-slate-500 bg-slate-50/30">
                                <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                                <p>No team members found.</p>
                                <p className="text-sm mt-1">Add employees in the Employees tab first to start scheduling.</p>
                            </div>
                        ) : (
                            employees.map(employee => (
                                <div key={employee.id} className="grid grid-cols-8 hover:bg-slate-50/50 transition-colors group/row">
                                    {/* Name wrapper */}
                                    <div className="px-4 py-3 border-r border-slate-200 flex flex-col justify-center min-h-[90px] bg-white group-hover/row:bg-slate-50/50 transition-colors">
                                        <span className="font-semibold text-slate-900 leading-tight">{employee.name}</span>
                                        <span className="text-xs text-slate-500 mt-1 line-clamp-2" title={employee.positions.join(', ')}>
                                            {employee.positions.join(', ')}
                                        </span>
                                    </div>

                                    {/* Days */}
                                    {daysOfWeek.map((day, i) => {
                                        const shiftsForDay = localShifts.filter(
                                            s => s.employeeId === employee.id && s.dayOfWeek === i
                                        );

                                        return (
                                            <div
                                                key={i}
                                                onClick={(e) => {
                                                    // Only open new shift if clicking the cell background (not an existing shift)
                                                    if (e.target === e.currentTarget) {
                                                        openShiftModal(employee.id, i);
                                                    }
                                                }}
                                                className={`p-2 border-slate-200 min-h-[90px] cursor-pointer group/cell relative flex flex-col gap-2 transition-all ${i !== 6 ? 'border-r' : ''} ${format(new Date(), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd') ? 'bg-blue-50/20' : ''} hover:bg-indigo-50/80`}
                                            >
                                                {shiftsForDay.length > 0 ? (
                                                    shiftsForDay.map(shift => (
                                                        <div
                                                            key={shift.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openShiftModal(employee.id, i, shift);
                                                            }}
                                                            className="bg-indigo-100/80 border border-indigo-200 text-indigo-900 rounded-md w-full p-2 flex flex-col justify-center items-center shadow-sm relative overflow-hidden hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer"
                                                        >
                                                            <span className="text-sm font-bold tracking-tight">{shift.startTime} - {shift.endTime}</span>
                                                            <span className="text-[11px] font-semibold mt-1 uppercase tracking-widest opacity-80 bg-indigo-200/50 px-2 py-0.5 rounded-full">{shift.position}</span>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="opacity-0 group-hover/cell:opacity-100 transition-opacity bg-indigo-50 text-indigo-600 rounded-md border border-indigo-200 border-dashed w-full h-full min-h-[50px] flex items-center justify-center pointer-events-none">
                                                        <Plus className="h-5 w-5" />
                                                    </div>
                                                )}

                                                {/* Add extra button when hovering cell that already has shifts */}
                                                {shiftsForDay.length > 0 && (
                                                    <div
                                                        onClick={() => openShiftModal(employee.id, i)}
                                                        className="opacity-0 group-hover/cell:opacity-100 transition-opacity bg-indigo-50 text-indigo-600 rounded-md border border-indigo-200 border-dashed w-full py-1.5 flex items-center justify-center cursor-pointer hover:bg-indigo-100 mt-auto"
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Shift Modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in slide-in-from-bottom-4 duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold border-b-2 border-indigo-500 pb-1 pr-4 inline-block">
                                {editingShiftId ? 'Edit Shift' : 'Assign Shift'}
                            </h3>
                            <button onClick={closeShiftModal} className="text-slate-400 hover:text-slate-600 p-1 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Start Time</label>
                                    <input
                                        type="time"
                                        value={shiftForm.startTime}
                                        onChange={e => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                                        className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 border bg-slate-50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">End Time</label>
                                    <input
                                        type="time"
                                        value={shiftForm.endTime}
                                        onChange={e => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                                        className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 border bg-slate-50"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Position / Role</label>
                                <select
                                    value={shiftForm.position}
                                    onChange={e => setShiftForm({ ...shiftForm, position: e.target.value })}
                                    className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 border bg-slate-50"
                                >
                                    <option value="" disabled>Select a position...</option>
                                    {employees.find(e => e.id === selectedEmployeeId)?.positions.map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                    {/* Fallback if employee positions are empty */}
                                    {employees.find(e => e.id === selectedEmployeeId)?.positions.length === 0 && (
                                        <option value="General" disabled>No positions assigned to this employee</option>
                                    )}
                                </select>
                                <p className="text-xs text-slate-500 mt-2 flex items-center">
                                    <span className="inline-block w-1.5 h-1.5 bg-indigo-400 rounded-full mr-1.5"></span>
                                    Only roles assigned to this employee are visible.
                                </p>
                            </div>

                            <div className="flex justify-between items-center mt-8 pt-4 border-t border-slate-100">
                                {editingShiftId ? (
                                    <button
                                        onClick={deleteShift}
                                        className="inline-flex items-center text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        <Trash2 className="h-4 w-4 mr-1.5" />
                                        Delete Shift
                                    </button>
                                ) : (
                                    <div></div>
                                )}
                                <div className="flex space-x-3">
                                    <button
                                        onClick={closeShiftModal}
                                        className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={saveShift}
                                        className="px-5 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-medium shadow-sm transition-colors"
                                    >
                                        Save Shift
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Preload Schedule Modal */}
            {preloadModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in slide-in-from-bottom-4 duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold border-b-2 border-indigo-500 pb-1 pr-4 inline-block">
                                Load Saved Schedule
                            </h3>
                            <button onClick={() => setPreloadModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                            {allSchedules.length === 0 ? (
                                <p className="text-slate-500 text-center py-4">No saved schedules available to load.</p>
                            ) : (
                                <div className="grid gap-3">
                                    {allSchedules
                                        .sort((a, b) => new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime())
                                        .map(sch => (
                                            <button
                                                key={sch.id}
                                                onClick={() => applyPreload(sch.id)}
                                                className="flex flex-col text-left px-4 py-3 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors"
                                            >
                                                <span className="font-bold text-slate-800">
                                                    Week of {format(new Date(sch.weekStartDate + 'T00:00:00'), 'MMM d, yyyy')}
                                                </span>
                                                <span className="text-sm text-slate-500 mt-1">
                                                    {sch.shifts.length} total shifts
                                                </span>
                                            </button>
                                        ))}
                                </div>
                            )}
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => setPreloadModalOpen(false)}
                                className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Need to import Users from lucide-react, I will manually add it using regex.
