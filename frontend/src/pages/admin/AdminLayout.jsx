import { NavLink, Outlet } from 'react-router-dom'
const link = ({ isActive }) =>
    `px-4 py-2 rounded-lg font-medium transition-all ${
        isActive 
            ? 'bg-primary-600 text-white shadow-md' 
            : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-primary-300 hover:text-primary-600'
    }`
export default function AdminLayout() {
    return (
        <div>
            <div className="flex gap-3 mb-8 text-sm flex-wrap">
                <NavLink to="/admin" end className={link}>Dashboard</NavLink>
                <NavLink to="/admin/products" className={link}>Products</NavLink>
                <NavLink to="/admin/orders" className={link}>Orders</NavLink>
                <NavLink to="/admin/users" className={link}>Users</NavLink>
                <NavLink to="/admin/categories" className={link}>Categories</NavLink>
            </div>
            <Outlet />
        </div>
    )
}
