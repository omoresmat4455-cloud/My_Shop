import { Link, useNavigate } from 'react-router-dom'
import { ShoppingBag, Menu, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useState } from 'react'
export default function Navbar() {
    const { user, logout } = useAuth()
    const { count } = useCart()
    const navigate = useNavigate()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const handleLogout = async () => {
        await logout()
        navigate('/')
    }
    return (
        <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-50 shadow-sm">
            <nav className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-2 group">
                    <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-sm group-hover:shadow-md transition-all duration-200">
                        M
                    </div>
                    <span className="font-bold text-2xl text-gray-900">
                        MyShop
                    </span>
                </Link>
                <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="lg:hidden p-2 text-gray-600 hover:text-primary-600 transition-colors"
                >
                    {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
                <div className="hidden lg:flex items-center gap-4 text-sm font-medium">
                    <Link to="/cart" className="relative group text-gray-600 hover:text-primary-600 transition-colors">
                        <span className="flex items-center gap-1">
                            <ShoppingBag className="w-5 h-5" />
                            Cart
                            {count > 0 && (
                                <span className="absolute -top-2 -right-2 bg-accent-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                                    {count}
                                </span>
                            )}
                        </span>
                    </Link>
                    {user ? (
                        <>
                            {user.role === 'admin' && (
                                <Link to="/admin" className="text-gray-600 hover:text-primary-600 transition-colors">Admin</Link>
                            )}
                            <Link to="/orders" className="text-gray-600 hover:text-primary-600 transition-colors">My orders</Link>
                            <span className="text-gray-500 hidden sm:inline">{user.name}</span>
                            <button onClick={handleLogout} className="text-gray-600 hover:text-accent-600 transition-colors">
                                Logout
                            </button>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="text-gray-600 hover:text-primary-600 transition-colors">Login</Link>
                            <Link
                                to="/register"
                                className="btn-primary"
                            >
                                Register
                            </Link>
                        </>
                    )}
                </div>
            </nav>
            {mobileMenuOpen && (
                <div className="lg:hidden border-t border-gray-200 bg-white/95 backdrop-blur-lg">
                    <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-3 text-sm font-medium">
                        <Link
                            to="/cart"
                            className="flex items-center gap-2 text-gray-600 hover:text-primary-600 transition-colors py-2"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            <ShoppingBag className="w-5 h-5" />
                            Cart
                            {count > 0 && (
                                <span className="bg-accent-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                                    {count}
                                </span>
                            )}
                        </Link>
                        {user ? (
                            <>
                                {user.role === 'admin' && (
                                    <Link
                                        to="/admin"
                                        className="text-gray-600 hover:text-primary-600 transition-colors py-2"
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        Admin
                                    </Link>
                                )}
                                <Link
                                    to="/orders"
                                    className="text-gray-600 hover:text-primary-600 transition-colors py-2"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    My orders
                                </Link>
                                <span className="text-gray-500 py-2">{user.name}</span>
                                <button
                                    onClick={() => {
                                        handleLogout()
                                        setMobileMenuOpen(false)
                                    }}
                                    className="text-gray-600 hover:text-accent-600 transition-colors py-2 text-left"
                                >
                                    Logout
                                </button>
                            </>
                        ) : (
                            <>
                                <Link
                                    to="/login"
                                    className="text-gray-600 hover:text-primary-600 transition-colors py-2"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    Login
                                </Link>
                                <Link
                                    to="/register"
                                    className="btn-primary text-center py-2"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    Register
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            )}
        </header>
    )
}