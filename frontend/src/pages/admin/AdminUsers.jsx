import { useEffect, useState } from 'react'
import api from '../../api/axios'
import { errorMessage } from '../../utils/format'

export default function AdminUsers() {
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)

    const loadUsers = async () => {
        try {
            const res = await api.get('/admin/users')
            setUsers(res.data)
        } catch (err) {
            console.error('Failed to load users:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadUsers()
    }, [])

    const toggleRole = async (user, newRole) => {
        try {
            await api.patch(`/admin/users/${user.id}/role`, { role: newRole })
            loadUsers()
        } catch (err) {
            alert(errorMessage(err, 'Failed to update role'))
        }
    }

    const toggleStatus = async (user) => {
        try {
            await api.patch(`/admin/users/${user.id}/status`, { is_active: !user.is_active })
            loadUsers()
        } catch (err) {
            alert(errorMessage(err, 'Failed to update status'))
        }
    }

    if (loading) {
        return (
            <div className="text-center py-16">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-200 border-t-primary-600"></div>
                <p className="mt-3 text-gray-600">Loading users...</p>
            </div>
        )
    }

    return (
        <div className="card overflow-hidden">
            <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">User Management</h2>
                <p className="text-gray-500 text-sm mt-1">Manage user roles and permissions</p>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[800px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th className="p-4 text-left font-semibold text-gray-700">ID</th>
                        <th className="p-4 text-left font-semibold text-gray-700">Name</th>
                        <th className="p-4 text-left font-semibold text-gray-700">Email</th>
                        <th className="p-4 text-left font-semibold text-gray-700">Role</th>
                        <th className="p-4 text-left font-semibold text-gray-700">Status</th>
                        <th className="p-4 text-left font-semibold text-gray-700">Orders</th>
                        <th className="p-4 text-right font-semibold text-gray-700">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((user) => (
                        <tr key={user.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="p-4 font-medium text-gray-900">#{user.id}</td>
                            <td className="p-4">
                                <div className="font-medium text-gray-900">{user.name}</div>
                            </td>
                            <td className="p-4 text-gray-600">{user.email}</td>
                            <td className="p-4">
                                <select
                                    value={user.role}
                                    onChange={(e) => toggleRole(user, e.target.value)}
                                    className="input py-1.5 text-sm"
                                    disabled={user.id === 1}
                                >
                                    <option value="user">User</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </td>
                            <td className="p-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    user.is_active 
                                        ? 'bg-success-100 text-success-700' 
                                        : 'bg-gray-100 text-gray-600'
                                }`}>
                                    {user.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </td>
                            <td className="p-4 text-gray-600">{user.orders_count || 0}</td>
                            <td className="p-4 text-right space-x-2">
                                <button
                                    onClick={() => toggleStatus(user)}
                                    className={`text-sm font-medium ${
                                        user.is_active 
                                            ? 'text-warning-600 hover:text-warning-700' 
                                            : 'text-success-600 hover:text-success-700'
                                    }`}
                                    disabled={user.id === 1}
                                >
                                    {user.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            </div>
        </div>
    )
}
