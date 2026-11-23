import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { errorMessage } from '../utils/format'
export default function Login() {
    const { login } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const [form, setForm] = useState({ email: '', password: '' })
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const submit = async (e) => {
        e.preventDefault()
        setError('')
        setBusy(true)
        try {
            await login(form.email, form.password)
            navigate(location.state?.from || '/')
        } catch (err) {
            setError(errorMessage(err, 'Login failed'))
        } finally {
            setBusy(false)
        }
    }
    return (
        <form onSubmit={submit} className="max-w-sm mx-auto card p-8 mt-16 space-y-5">
            <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
                <p className="text-gray-500 text-sm mt-1">Sign in to your account</p>
            </div>
            {error && (
                <div className="bg-accent-50 border border-accent-200 text-accent-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                </div>
            )}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                    type="email"
                    placeholder="Enter your email"
                    className="input"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                    type="password"
                    placeholder="Enter your password"
                    className="input"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                />
            </div>
            <button disabled={busy} className="btn-primary w-full py-3">
                {busy ? 'Signing in...' : 'Sign in'}
            </button>
            <p className="text-sm text-center text-gray-600">
                Don't have an account? <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">Create one</Link>
            </p>
        </form>
    )
}