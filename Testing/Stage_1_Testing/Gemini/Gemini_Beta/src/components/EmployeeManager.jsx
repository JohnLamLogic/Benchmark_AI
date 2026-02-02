import React, { useState } from 'react';
import { User, X, Plus } from 'lucide-react';
import './EmployeeManager.css';

export default function EmployeeManager({ employees, onAdd, onDelete }) {
    const [newName, setNewName] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (newName.trim()) {
            onAdd(newName.trim());
            setNewName('');
        }
    };

    return (
        <div className="employee-manager">
            <div className="employee-list">
                {employees.length === 0 ? (
                    <p className="no-employees">No team members added.</p>
                ) : (
                    employees.map(emp => (
                        <div key={emp.id} className="employee-item">
                            <div className="employee-info">
                                <div className="avatar">
                                    <User size={16} />
                                </div>
                                <span className="employee-name">{emp.name}</span>
                            </div>
                            <button
                                className="btn-icon-delete"
                                onClick={() => onDelete(emp.id)}
                                aria-label="Delete employee"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    ))
                )}
            </div>

            <form onSubmit={handleSubmit} className="add-employee-form">
                <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="New employee name..."
                    className="glass-input"
                />
                <button type="submit" className="btn-add" disabled={!newName.trim()}>
                    <Plus size={20} />
                </button>
            </form>
        </div>
    );
}
