import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { DAYS } from '../utils';
import ShiftModal from './ShiftModal';
import './ScheduleGrid.css';

export default function ScheduleGrid({ employees, shifts, onAddShift, onEditShift, onDeleteShift }) {
    const [modalState, setModalState] = useState({
        isOpen: false,
        employeeId: null,
        day: null,
        shiftData: null
    });

    const getShifts = (empId, day) => {
        return shifts.filter(s => s.employeeId === empId && s.day === day);
    };

    const handleCellClick = (empId, day) => {
        // Clicking cell background opens "Add"
        setModalState({
            isOpen: true,
            employeeId: empId,
            day: day,
            shiftData: null
        });
    };

    const handleShiftClick = (e, shift) => {
        e.stopPropagation(); // Prevent cell click
        setModalState({
            isOpen: true,
            employeeId: shift.employeeId,
            day: shift.day,
            shiftData: shift
        });
    }

    const handleSaveShift = (data) => {
        const { employeeId, day, shiftData } = modalState;
        if (shiftData) {
            // Edit
            onEditShift({ ...shiftData, ...data });
        } else {
            // Add
            onAddShift({ employeeId, day, ...data });
        }
    };

    const handleDeleteClick = () => {
        const { shiftData } = modalState;
        if (shiftData) {
            onDeleteShift(shiftData.id);
        }
    };

    const closeModal = () => {
        setModalState({ ...modalState, isOpen: false });
    };

    const getEmployeeName = () => {
        return employees.find(e => e.id === modalState.employeeId)?.name || '';
    };

    return (
        <div className="schedule-grid-container">
            <div className="grid-scroll-area">
                <div className="grid-header">
                    <div className="header-cell corner-cell">Employee</div>
                    {DAYS.map(day => (
                        <div key={day} className="header-cell day-cell">
                            {day}
                        </div>
                    ))}
                </div>

                <div className="grid-body">
                    {employees.length === 0 ? (
                        <div className="grid-empty">
                            Add team members to start scheduling
                        </div>
                    ) : (
                        employees.map(emp => (
                            <div key={emp.id} className="grid-row">
                                <div className="row-header">
                                    <span className="emp-name">{emp.name}</span>
                                </div>
                                {DAYS.map(day => {
                                    const dailyShifts = getShifts(emp.id, day);
                                    return (
                                        <div
                                            key={`${emp.id}-${day}`}
                                            className="grid-cell"
                                            onClick={() => handleCellClick(emp.id, day)}
                                        >
                                            {dailyShifts.map(shift => (
                                                <div
                                                    key={shift.id}
                                                    className="shift-card"
                                                    onClick={(e) => handleShiftClick(e, shift)}
                                                >
                                                    <div className="shift-time">{shift.time}</div>
                                                    <div className="shift-pos">{shift.position}</div>
                                                </div>
                                            ))}

                                            <div className="add-indicator">
                                                <Plus size={14} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>
            </div>

            <ShiftModal
                isOpen={modalState.isOpen}
                onClose={closeModal}
                onSave={handleSaveShift}
                onDelete={handleDeleteClick}
                shiftData={modalState.shiftData}
                employeeName={getEmployeeName()}
                day={modalState.day}
            />
        </div>
    );
}
