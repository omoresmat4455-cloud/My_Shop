import { useEffect, useState } from 'react'
import api from '../../api/axios'
import { egp, errorMessage } from '../../utils/format'
const empty = {
    name: '', category_id: '', price: '', stock: '',
    description: '', is_active: true, image: null,
}
export default function AdminProducts() {
    const [products, setProducts] = useState([])
    const [categories, setCategories] = useState([])
    const [form, setForm] = useState(empty)
    const [editingId, setEditingId] = useState(null)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(true)

    const load = () => {
        setLoading(true)
        return api.get('/admin/products').then((res) => {
            setProducts(res.data)
        }).finally(() => setLoading(false))
    }

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        load()
        api.get('/categories').then((res) => setCategories(res.data))
    }, [])

    if (loading) {
        return (
            <div className="text-center py-16">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-200 border-t-primary-600"></div>
                <p className="mt-3 text-gray-600">Loading products...</p>
            </div>
        )
    }
    const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
    const reset = () => {
        setEditingId(null)
        setForm(empty)
        setError('')
    }
    const startEdit = (p) => {
        setEditingId(p.id)
        setForm({
            name: p.name,
            category_id: p.category_id,
            price: p.price,
            stock: p.stock,
            description: p.description || '',
            is_active: p.is_active,
            image: null,
        })
        window.scrollTo(0, 0)
    }
    const submit = async (e) => {
        e.preventDefault()
        setError('')
        const fd = new FormData()
            ;['name', 'category_id', 'price', 'stock', 'description'].forEach((k) =>
                fd.append(k, form[k])
            )
        fd.append('is_active', form.is_active ? 1 : 0)
        if (form.image) fd.append('image', form.image)
        try {
            if (editingId) {
                fd.append('_method', 'PUT')
                await api.post(`/admin/products/${editingId}`, fd)
            } else {
                await api.post('/admin/products', fd)
            }
            reset()
            load()
        } catch (err) {
            setError(errorMessage(err))
        }
    }
    const remove = async (p) => {
        if (!confirm(`Delete "${p.name}"?`)) return
        const { data } = await api.delete(`/admin/products/${p.id}`)
        if (data.message?.includes('deactivated')) alert(data.message)
        load()
    }
    return (
        <div className="space-y-8">
            <form onSubmit={submit} className="card p-6 grid md:grid-cols-2 gap-4">
                <h2 className="md:col-span-2 text-xl font-bold text-gray-900">
                    {editingId ? `Edit product #${editingId}` : 'New product'}
                </h2>
                {error && (
                    <div className="md:col-span-2 bg-accent-50 border border-accent-200 text-accent-700 px-4 py-3 rounded-lg text-sm">
                        {error}
                    </div>
                )}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input placeholder="Product name" className="input"
                        value={form.name} onChange={set('name')} required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select className="input"
                        value={form.category_id} onChange={set('category_id')} required>
                        <option value="">Choose category</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price (EGP)</label>
                    <input type="number" step="0.01" min="0" placeholder="0.00"
                        className="input"
                        value={form.price} onChange={set('price')} required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                    <input type="number" min="0" placeholder="0"
                        className="input"
                        value={form.stock} onChange={set('stock')} required />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea placeholder="Product description" rows="3"
                        className="input"
                        value={form.description} onChange={set('description')} />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
                    <input type="file" accept="image/jpeg,image/jpg,image/png"
                        onChange={(e) => {
                            const file = e.target.files[0]
                            if (file) {
                                // Validate file type
                                const validTypes = ['image/jpeg', 'image/jpg', 'image/png']
                                if (!validTypes.includes(file.type)) {
                                    alert('Please select a valid JPEG or PNG image')
                                    e.target.value = ''
                                    return
                                }
                                // Validate file size (max 5MB)
                                if (file.size > 5 * 1024 * 1024) {
                                    alert('Image size must be less than 5MB')
                                    e.target.value = ''
                                    return
                                }
                                setForm({ ...form, image: file })
                            }
                        }}
                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100" />
                    <p className="text-xs text-gray-500 mt-1">JPEG or PNG, max 5MB</p>
                    {form.image && (
                        <div className="mt-3">
                            <img 
                                src={URL.createObjectURL(form.image)} 
                                alt="Preview" 
                                className="w-32 h-32 object-cover rounded-lg border border-gray-200"
                            />
                        </div>
                    )}
                </div>
                <div className="flex items-center">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.is_active}
                            onChange={(e) => setForm({ ...form, is_active: e.target.checked })} 
                            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        <span className="text-sm text-gray-700">Active (visible in shop)</span>
                    </label>
                </div>
                <div className="md:col-span-2 flex gap-3 pt-2">
                    <button className="btn-primary">
                        {editingId ? 'Save changes' : 'Create product'}
                    </button>
                    {editingId && (
                        <button type="button" onClick={reset} className="btn-secondary">
                            Cancel
                        </button>
                    )}
                </div>
            </form>
            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[700px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="p-4 text-left font-semibold text-gray-700">Name</th>
                            <th className="p-4 text-left font-semibold text-gray-700">Category</th>
                            <th className="p-4 text-left font-semibold text-gray-700">Price</th>
                            <th className="p-4 text-left font-semibold text-gray-700">Stock</th>
                            <th className="p-4 text-left font-semibold text-gray-700">Active</th>
                            <th className="p-4 text-right font-semibold text-gray-700"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.map((p) => (
                            <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                                <td className="p-4 font-medium text-gray-900">{p.name}</td>
                                <td className="p-4 text-gray-600">{p.category?.name}</td>
                                <td className="p-4 text-gray-900">{egp(p.price)}</td>
                                <td className="p-4 text-gray-600">{p.stock}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        p.is_active 
                                            ? 'bg-success-100 text-success-700' 
                                            : 'bg-gray-100 text-gray-600'
                                    }`}>
                                        {p.is_active ? 'Yes' : 'No'}
                                    </span>
                                </td>
                                <td className="p-4 text-right space-x-3">
                                    <button onClick={() => startEdit(p)} className="text-primary-600 hover:text-primary-700 font-medium">Edit</button>
                                    <button onClick={() => remove(p)} className="text-accent-600 hover:text-accent-700 font-medium">Delete</button>
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