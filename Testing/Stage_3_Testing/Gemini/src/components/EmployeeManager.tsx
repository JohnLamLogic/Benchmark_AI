"use client";

import { useState, useEffect } from 'react';
import { UserPlus, Pencil, Trash2 } from 'lucide-react';

export default function EmployeeManager() {
    const [employees, setEmployees] = useState<{ id: number; name: string; email: string; positions: string }[]>([]);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [positions, setPositions] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        const res = await fetch('/api/employees');
        const data = await res.json();
        setEmployees(data);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingId) {
            await fetch(`/api/employees/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, positions })
            });
            setEditingId(null);
        } else {
            await fetch('/api/employees', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, positions })
            });
        }
        setName('');
        setEmail('');
        setPositions('');
        fetchEmployees();
    };

    const handleEdit = (emp: any) => {
        setEditingId(emp.id);
        setName(emp.name);
        setEmail(emp.email);
        setPositions(emp.positions);
    };

    const handleDelete = async (id: number) => {
        if (window.confirm("Delete employee?")) {
            await fetch(`/api/employees/${id}`, { method: 'DELETE' });
            fetchEmployees();
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-bold mb-4">Manage Employees</h2>

            <form onSubmit={handleSubmit} className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                <input
                    type="text"
                    placeholder="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="border p-2 rounded w-full"
                    required
                />
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border p-2 rounded w-full"
                    required
                />
                <input
                    type="text"
                    placeholder="Positions (e.g. Server, Host)"
                    value={positions}
                    onChange={(e) => setPositions(e.target.value)}
                    className="border p-2 rounded w-full"
                    required
                />
                <button type="submit" className="bg-blue-600 text-white p-2 rounded flex items-center justify-center gap-2 hover:bg-blue-700">
                    <UserPlus size={20} />
                    {editingId ? 'Update' : 'Add Employee'}
                </button>
            </form>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-100 border-b">
                            <th className="p-3">Name</th>
                            <th className="p-3">Email</th>
                            <th className="p-3">Positions</th>
                            <th className="p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {employees.map(emp => (
                            <tr key={emp.id} className="border-b hover:bg-gray-50">
                                <td className="p-3 font-medium">{emp.name}</td>
                                <td className="p-3">{emp.email}</td>
                                <td className="p-3">{emp.positions}</td>
                                <td className="p-3 flex gap-2">
                                    <button onClick={() => handleEdit(emp)} className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                                        <Pencil size={18} />
                                    </button>
                                    <button onClick={() => handleDelete(emp.id)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {employees.length === 0 && (
                            <tr>
                                <td colSpan={4} className="p-4 text-center text-gray-500">No employees added yet.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
