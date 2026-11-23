import { useEffect, useState } from 'react'
import api from '../../api/axios'
import { errorMessage } from '../../utils/format'

const empty = { name: '', slug: '' }

export default function AdminCategories() {
    const [categories, setCategories] = useState([])
    const [form, setForm] = useState(empty)
    const [editingId, setEditingId] = useState(null)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(true)

    const loadCategories = async () => {
        try {
            const res = await api.get('/admin/categories')
            setCategories(res.data)
        } catch (err) {
            console.error('Failed to load categories:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadCategories()
    }, [])

    const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

    const reset = () => {
        setEditingId(null)
        setForm(empty)
        setError('')
    }

    const startEdit = (cat) => {
        setEditingId(cat.id)
        setForm({ name: cat.name, slug: cat.slug })
        window.scrollTo(0, 0)
    }

    const submit = async (e) => {
        e.preventDefault()
        setError('')
        try {
            if (editingId) {
                await api.put(`/admin/categories/${editingId}`, form)
            } else {
                await api.post('/admin/categories', form)
            }
            reset()
            loadCategories()
        } catch (err) {
            setError(errorMessage(err, 'Failed to save category'))
        }
    }

    const remove = async (cat) => {
        if (!confirm(`Delete "${cat.name}"?`)) return
        try {
            await api.delete(`/admin/categories/${cat.id}`)
            loadCategories()
        } catch (err) {
            alert(errorMessage(err, 'Failed to delete category'))
        }
    }

    if (loading) {
        return (
            <div className="text-center py-16">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-200 border-t-primary-600"></div>
                <p className="mt-3 text-gray-600">Loading categories...</p>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <form onSubmit={submit} className="card p-6 max-w-md">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                    {editingId ? `Edit category #${editingId}` : 'New category'}
                </h2>
                {error && (
                    <div className="bg-accent-50 border border-accent-200 text-accent-700 px-4 py-3 rounded-lg text-sm mb-4">
                        {error}
                    </div>
                )}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input
                            placeholder="Category name"
                            className="input"
                            value={form.name}
                            onChange={set('name')}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                        <input
                            placeholder="category-slug"
                            className="input"
                            value={form.slug}
                            onChange={set('slug')}
                            required
                        />
                    </div>
                </div>
                <div className="flex gap-3 mt-6">
                    <button className="btn-primary">
                        {editingId ? 'Save changes' : 'Create category'}
                    </button>
                    {editingId && (
                        <button type="button" onClick={reset} className="btn-secondary">
                            Cancel
                        </button>
                    )}
                </div>
            </form>

            <div className="card overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900">Categories</h2>
                    <p className="text-gray-500 text-sm mt-1">Manage product categories</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[600px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="p-4 text-left font-semibold text-gray-700">ID</th>
                            <th className="p-4 text-left font-semibold text-gray-700">Name</th>
                            <th className="p-4 text-left font-semibold text-gray-700">Slug</th>
                            <th className="p-4 text-left font-semibold text-gray-700">Products</th>
                            <th className="p-4 text-right font-semibold text-gray-700">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {categories.map((cat) => (
                            <tr key={cat.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                                <td className="p-4 font-medium text-gray-900">#{cat.id}</td>
                                <td className="p-4 font-medium text-gray-900">{cat.name}</td>
                                <td className="p-4 text-gray-600">{cat.slug}</td>
                                <td className="p-4 text-gray-600">{cat.products_count || 0}</td>
                                <td className="p-4 text-right space-x-3">
                                    <button
                                        onClick={() => startEdit(cat)}
                                        className="text-primary-600 hover:text-primary-700 font-medium"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => remove(cat)}
                                        className="text-accent-600 hover:text-accent-700 font-medium"
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            </div>
        </div>
    )
}
