import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, adminOnly = false }) {
    const { user, loading } = useAuth()
    const location = useLocation()
    
    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                    <p className="text-gray-600">Verifying access...</p>
                </div>
            </div>
        )
    }
    
    if (!user) {
        return <Navigate to="/login" state={{ from: location.pathname }} replace />
    }
    
    if (adminOnly && user.role !== 'admin') {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="card p-8 text-center max-w-md">
                    <div className="text-6xl mb-4">🔒</div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
                    <p className="text-gray-600 mb-6">You don't have permission to access this page.</p>
                    <Navigate to="/" replace />
                </div>
            </div>
        )
    }
    
    return children
}
