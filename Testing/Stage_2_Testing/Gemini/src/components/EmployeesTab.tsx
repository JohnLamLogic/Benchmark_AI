import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Employee } from '../db';
import { Plus, Pencil, Trash2, Check } from 'lucide-react';

export default function EmployeesTab() {
    const employees = useLiveQuery(() => db.employees.toArray());
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        positions: ''
    });

    const handleAddClick = () => {
        setIsAdding(true);
        setFormData({ name: '', email: '', positions: '' });
    };

    const handleCancel = () => {
        setIsAdding(false);
        setEditingId(null);
    };

    const handleSave = async () => {
        if (!formData.name.trim()) return;

        const newEmployee: Employee = {
            id: editingId || crypto.randomUUID(),
            name: formData.name.trim(),
            email: formData.email.trim(),
            positions: formData.positions.split(',').map(p => p.trim()).filter(Boolean)
        };

        if (editingId) {
            await db.employees.put(newEmployee);
        } else {
            await db.employees.add(newEmployee);
        }

        handleCancel();
    };

    const handleEdit = (emp: Employee) => {
        setEditingId(emp.id);
        setIsAdding(true);
        setFormData({
            name: emp.name,
            email: emp.email,
            positions: emp.positions.join(', ')
        });
    };

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this employee?')) {
            await db.employees.delete(id);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">Team Members</h2>
                {!isAdding && (
                    <button
                        onClick={handleAddClick}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Employee
                    </button>
                )}
            </div>

            {isAdding && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in slide-in-from-top-4 duration-200">
                    <h3 className="text-lg font-medium text-slate-800 mb-4">
                        {editingId ? 'Edit Employee' : 'New Employee'}
                    </h3>
                    <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-slate-700">Name</label>
                            <div className="mt-1">
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                                    placeholder="John Doe"
                                />
                            </div>
                        </div>

                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-slate-700">Email</label>
                            <div className="mt-1">
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                                    placeholder="john@example.com"
                                />
                            </div>
                        </div>

                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-slate-700">Positions (comma-separated)</label>
                            <div className="mt-1">
                                <input
                                    type="text"
                                    value={formData.positions}
                                    onChange={e => setFormData({ ...formData, positions: e.target.value })}
                                    className="block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                                    placeholder="Server, Host"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            onClick={handleCancel}
                            className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                        >
                            <Check className="h-4 w-4 mr-2" />
                            Save
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
                <ul className="divide-y divide-slate-200">
                    {employees?.length === 0 ? (
                        <li className="px-6 py-12 text-center text-slate-500">
                            No employees added yet. Click "Add Employee" to get started.
                        </li>
                    ) : (
                        employees?.map((emp) => (
                            <li key={emp.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                <div>
                                    <h4 className="text-sm font-medium text-slate-900">{emp.name}</h4>
                                    <p className="text-sm text-slate-500">{emp.email}</p>
                                    <div className="mt-1 flex flex-wrap gap-2">
                                        {emp.positions.map((pos, idx) => (
                                            <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                {pos}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleEdit(emp)}
                                        className="p-2 text-slate-400 hover:text-blue-600 rounded-full hover:bg-blue-50 transition-colors"
                                        title="Edit"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(emp.id)}
                                        className="p-2 text-slate-400 hover:text-red-600 rounded-full hover:bg-red-50 transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </li>
                        ))
                    )}
                </ul>
            </div>
        </div>
    );
}
