import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { errorMessage } from '../utils/format'
export default function Register() {
    const { register } = useAuth()
    const navigate = useNavigate()
    const [form, setForm] = useState({
        name: '', email: '', password: '', password_confirmation: '',
    })
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
    const submit = async (e) => {
        e.preventDefault()
        setError('')
        setBusy(true)
        try {
            await register(form)
            navigate('/')
        } catch (err) {
            setError(errorMessage(err, 'Registration failed'))
        } finally {
            setBusy(false)
        }
    }
    return (
        <form onSubmit={submit} className="max-w-sm mx-auto card p-8 mt-16 space-y-5">
            <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Create account</h1>
                <p className="text-gray-500 text-sm mt-1">Join us today</p>
            </div>
            {error && (
                <div className="bg-accent-50 border border-accent-200 text-accent-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                </div>
            )}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input placeholder="Enter your name" autoComplete="name" className="input"
                    value={form.name} onChange={set('name')} required />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" autoComplete="email" placeholder="Enter your email" className="input"
                    value={form.email} onChange={set('email')} required />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password"  autoComplete="new-password" placeholder="Min 8 characters"
                    className="input"
                    value={form.password} onChange={set('password')} required />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input type="password"  autoComplete="new-password" placeholder="Confirm your password"
                    className="input"
                    value={form.password_confirmation} onChange={set('password_confirmation')} required />
            </div>
            <button disabled={busy} className="btn-primary w-full py-3">
                {busy ? 'Creating account...' : 'Create account'}
            </button>
            <p className="text-sm text-center text-gray-600">
                Already have an account? <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">Sign in</Link>
            </p>
        </form>
    )
}