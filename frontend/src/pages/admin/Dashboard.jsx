import { useEffect, useState } from 'react'
import api from '../../api/axios'
import { egp } from '../../utils/format'
import {
    ShoppingBag,
    Clock,
    DollarSign,
    Package,
    Users,
    TrendingUp,
    PieChart as PieChartIcon,
    BarChart3,
} from 'lucide-react'
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts'

const COLORS = {
    primary: '#2563EB',
    secondary: '#0F766E',
    success: '#15803D',
    warning: '#B45309',
    accent: '#B91C1C',
    neutral: '#94A3B8',
}

export default function Dashboard() {
    const [stats, setStats] = useState({
        orders: 0,
        pending_orders: 0,
        processing_orders: 0,
        shipped_orders: 0,
        delivered_orders: 0,
        cancelled_orders: 0,
        revenue: 0,
        products: 0,
        customers: 0,
    })
    const [recentOrders, setRecentOrders] = useState([])
    const [revenueData, setRevenueData] = useState([])
    const [topProducts, setTopProducts] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        Promise.all([
            api.get('/admin/stats'),
            api.get('/admin/orders?limit=5'),
            api.get('/admin/revenue-chart'),
            api.get('/admin/top-products'),
        ])
            .then(([statsRes, ordersRes, revenueRes, productsRes]) => {
                setStats(statsRes.data)
                setRecentOrders(ordersRes.data.data || [])
                setRevenueData(revenueRes.data || [])
                setTopProducts(productsRes.data || [])
            })
            .catch((err) => {
                console.error('Failed to load dashboard:', err)
            })
            .finally(() => {
                setLoading(false)
            })
    }, [])

    if (loading) {
        return (
            <div className="py-16 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
                <p className="mt-3 text-gray-600">Loading dashboard...</p>
            </div>
        )
    }

    const cards = [
        ['Orders', stats.orders, <ShoppingBag className="h-6 w-6" />, COLORS.primary],
        ['Pending orders', stats.pending_orders, <Clock className="h-6 w-6" />, COLORS.warning],
        ['Revenue (paid)', egp(stats.revenue), <DollarSign className="h-6 w-6" />, COLORS.success],
        ['Products', stats.products, <Package className="h-6 w-6" />, COLORS.secondary],
        ['Customers', stats.customers, <Users className="h-6 w-6" />, COLORS.neutral],
    ]

    const statusColors = {
        pending: 'bg-warning-100 text-warning-800',
        processing: 'bg-info-100 text-info-800',
        shipped: 'bg-primary-100 text-primary-800',
        delivered: 'bg-success-100 text-success-800',
        cancelled: 'bg-accent-100 text-accent-800',
    }

    const statusData = [
        { name: 'Pending', value: stats.pending_orders || 0, color: COLORS.warning },
        { name: 'Processing', value: stats.processing_orders || 0, color: COLORS.primary },
        { name: 'Shipped', value: stats.shipped_orders || 0, color: '#6366F1' },
        { name: 'Delivered', value: stats.delivered_orders || 0, color: COLORS.success },
        { name: 'Cancelled', value: stats.cancelled_orders || 0, color: COLORS.accent },
    ]

    return (
        <div className="space-y-6 px-4 md:space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Dashboard</h1>
                <p className="mt-1 text-sm text-gray-500">Overview of your store performance</p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-5">
                {cards.map(([label, value, icon]) => (
                    <div key={label} className="card p-4 transition-shadow hover:shadow-lg md:p-5">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
                            <span className="text-xl">{icon}</span>
                        </div>
                        <p className="mt-2 text-xl font-bold text-gray-900 md:text-2xl">{value}</p>
                    </div>
                ))}
            </div>

            <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
                <div className="card p-4 md:col-span-2 md:p-6">
                    <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-900 md:text-lg">
                        <TrendingUp className="h-5 w-5 text-primary-600" />
                        Revenue Trend
                    </h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={revenueData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="date" stroke="#6b7280" fontSize={11} />
                            <YAxis stroke="#6b7280" fontSize={11} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'white',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                }}
                                formatter={(value) => [egp(value), 'Revenue']}
                            />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="revenue"
                                stroke={COLORS.primary}
                                strokeWidth={2}
                                dot={{ fill: COLORS.primary }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="card p-4 md:p-6">
                    <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-900 md:text-lg">
                        <PieChartIcon className="h-5 w-5 text-primary-600" />
                        Orders by Status
                    </h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={statusData}
                                cx="50%"
                                cy="45%"
                                outerRadius={75}
                                dataKey="value"
                                nameKey="name"
                            >
                                {statusData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value) => [value, 'Orders']} />
                            <Legend
                                verticalAlign="bottom"
                                align="center"
                                wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="card p-4 md:p-6">
                <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-900 md:text-lg">
                    <BarChart3 className="h-5 w-5 text-primary-600" />
                    Top Selling Products
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topProducts}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                            dataKey="name"
                            stroke="#6b7280"
                            fontSize={11}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                        />
                        <YAxis stroke="#6b7280" fontSize={11} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                            }}
                            formatter={(value) => [value, 'Units Sold']}
                        />
                        <Legend />
                        <Bar dataKey="sold" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="card overflow-hidden">
                <div className="border-b border-gray-200 p-4 md:p-6">
                    <h2 className="text-lg font-bold text-gray-900 md:text-xl">Recent Orders</h2>
                    <p className="mt-1 text-sm text-gray-500">Latest customer orders</p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] text-sm">
                        <thead className="border-b border-gray-200 bg-gray-50">
                            <tr>
                                <th className="p-3 text-left font-semibold text-gray-700 md:p-4">#</th>
                                <th className="p-3 text-left font-semibold text-gray-700 md:p-4">Customer</th>
                                <th className="p-3 text-left font-semibold text-gray-700 md:p-4">Total</th>
                                <th className="p-3 text-left font-semibold text-gray-700 md:p-4">Status</th>
                                <th className="p-3 text-left font-semibold text-gray-700 md:p-4">Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-6 text-center text-gray-500 md:p-8">
                                        No recent orders
                                    </td>
                                </tr>
                            ) : (
                                recentOrders.map((order) => (
                                    <tr
                                        key={order.id}
                                        className="border-t border-gray-100 transition-colors hover:bg-gray-50"
                                    >
                                        <td className="p-3 font-medium text-gray-900 md:p-4">#{order.id}</td>
                                        <td className="p-3 text-gray-900 md:p-4">{order.user?.name || 'Guest'}</td>
                                        <td className="p-3 font-medium text-gray-900 md:p-4">{egp(order.total)}</td>
                                        <td className="p-3 md:p-4">
                                            <span
                                                className={`rounded-full px-2 py-1 text-xs font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}
                                            >
                                                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                            </span>
                                        </td>
                                        <td className="p-3 text-gray-600 md:p-4">
                                            {new Date(order.created_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
