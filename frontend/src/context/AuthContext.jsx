import { createContext, useContext, useEffect, useState } from 'react'
import api from '../api/axios'
const AuthContext = createContext(null)
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    // On first load, restore the session from the saved token
    useEffect(() => {
        if (!localStorage.getItem('token')) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLoading(false)
            return
        }
        api
            .get('/me')
            .then((res) => setUser(res.data))
            .catch(() => localStorage.removeItem('token'))
            .finally(() => setLoading(false))
    }, [])
    const login = async (email, password) => {
        const { data } = await api.post('/login', { email, password })
        localStorage.setItem('token', data.token)
        setUser(data.user)
        return data.user
    }
    const register = async (payload) => {
        const { data } = await api.post('/register', payload)
        localStorage.setItem('token', data.token)
        setUser(data.user)
        return data.user
    }
    const logout = async () => {
        try {
            await api.post('/logout')
        } catch {
            // ignore: we clear the local session anyway
        }
        localStorage.removeItem('token')
        setUser(null)
    }
    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)