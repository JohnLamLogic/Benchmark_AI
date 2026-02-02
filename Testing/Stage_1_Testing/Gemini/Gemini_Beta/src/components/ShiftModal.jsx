import React, { useState, useEffect } from 'react';
import { X, Clock, Briefcase, Trash2 } from 'lucide-react';
import { POSITIONS } from '../utils';
import './ShiftModal.css';

export default function ShiftModal({ isOpen, onClose, onSave, onDelete, shiftData, employeeName, day }) {
    const [time, setTime] = useState('');
    const [position, setPosition] = useState(POSITIONS[0]);

    useEffect(() => {
        if (isOpen) {
            if (shiftData) {
                setTime(shiftData.time);
                setPosition(shiftData.position);
            } else {
                setTime('');
                setPosition(POSITIONS[0]);
            }
        }
    }, [isOpen, shiftData]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            time,
            position
        });
        onClose();
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content glass-panel">
                <div className="modal-header">
                    <h3>
                        {shiftData ? 'Edit Shift' : 'Add Shift'}
                    </h3>
                    <button className="btn-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-subtitle">
                    <span>{employeeName}</span> • <span className="highlight-day">{day}</span>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>
                            <Clock size={16} /> Time
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. 9:00 AM - 5:00 PM"
                            value={time}
                            onChange={(e) => setTime(e.target.value)}
                            className="glass-input full-width-input"
                            autoFocus
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>
                            <Briefcase size={16} /> Position
                        </label>
                        <select
                            value={position}
                            onChange={(e) => setPosition(e.target.value)}
                            className="glass-input full-width-input"
                        >
                            {POSITIONS.map(pos => (
                                <option key={pos} value={pos}>{pos}</option>
                            ))}
                        </select>
                    </div>

                    <div className="modal-actions">
                        {shiftData && (
                            <button
                                type="button"
                                className="btn-delete"
                                onClick={() => {
                                    onDelete();
                                    onClose();
                                }}
                            >
                                <Trash2 size={18} /> Delete
                            </button>
                        )}
                        <div className="spacer"></div>
                        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn-primary">Save</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
