import { useEffect, useState } from 'react'
import { Filter, ChevronLeft, ChevronRight, Package, XCircle } from 'lucide-react'
import api from '../api/axios'
import ProductCard from '../components/ProductCard'

export default function Products() {
    const [products, setProducts] = useState([])
    const [categories, setCategories] = useState([])
    const [meta, setMeta] = useState({ current_page: 1, last_page: 1 })
    const [filters, setFilters] = useState({ search: '', category: '', min_price: '', max_price: '', sort: '', page: 1 })
    const [searchText, setSearchText] = useState('')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        api.get('/categories').then((res) => setCategories(res.data))
    }, [])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true)
        const params = {
            search: filters.search || undefined,
            category: filters.category || undefined,
            min_price: filters.min_price || undefined,
            max_price: filters.max_price || undefined,
            sort: filters.sort || undefined,
            page: filters.page,
        }
        api
            .get('/products', { params })
            .then((res) => {
                setProducts(res.data.data)
                setMeta({ current_page: res.data.current_page, last_page: res.data.last_page })
            })
            .finally(() => setLoading(false))
    }, [filters])

    const update = (patch) => setFilters((f) => ({ ...f, page: 1, ...patch }))

    return (
        <div className="space-y-6 px-4 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Products</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {loading ? 'Loading...' : `${products.length} products found`}
                    </p>
                </div>
            </div>

            <div className="card p-4">
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            placeholder="Search products..."
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); update({ search: searchText }) } }}
                            className="input pr-10"
                        />
                        {searchText && (
                            <button
                                type="button"
                                onClick={() => setSearchText('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-transparent border-0 p-1 rounded hover:bg-gray-100 transition-colors"
                            >
                                <XCircle className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <select
                            value={filters.category}
                            onChange={(e) => update({ category: e.target.value })}
                            className="input flex-1 md:flex-none min-w-[150px]"
                        >
                            <option value="">All categories</option>
                            {categories.map((c) => (
                                <option key={c.id} value={c.slug}>{c.name}</option>
                            ))}
                        </select>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            aria-label="Minimum price in EGP"
                            placeholder="Min EGP"
                            value={filters.min_price}
                            onChange={(e) => update({ min_price: e.target.value })}
                            className="input flex-1 md:flex-none w-full md:w-28"
                        />
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            aria-label="Maximum price in EGP"
                            placeholder="Max EGP"
                            value={filters.max_price}
                            onChange={(e) => update({ max_price: e.target.value })}
                            className="input flex-1 md:flex-none w-full md:w-28"
                        />
                        <select
                            value={filters.sort}
                            onChange={(e) => update({ sort: e.target.value })}
                            className="input flex-1 md:flex-none min-w-[150px]"
                        >
                            <option value="">Newest</option>
                            <option value="price_asc">Price: low to high</option>
                            <option value="price_desc">Price: high to low</option>
                        </select>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="card overflow-hidden">
                            <div className="h-48 bg-gray-200 animate-pulse"></div>
                            <div className="p-4 space-y-3">
                                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                                <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                                <div className="h-6 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : products.length === 0 ? (
                <div className="text-center py-16">
                    <Package className="w-24 h-24 mx-auto mb-6 text-gray-300" />
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">No products found</h2>
                    <p className="text-gray-500 mb-6">Try adjusting your filters or search terms</p>
                    <button
                        onClick={() => { setSearchText(''); setFilters({ search: '', category: '', min_price: '', max_price: '', sort: '', page: 1 }) }}
                        className="btn-secondary inline-flex items-center gap-2"
                    >
                        <Filter className="w-4 h-4" />
                        Clear filters
                    </button>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {products.map((p, index) => (
                            <div key={p.id} className={`animate-fade-in ${index < 4 ? `animate-delay-${(index + 1) * 100}` : ''}`}>
                                <ProductCard product={p} />
                            </div>
                        ))}
                    </div>
                    {meta.last_page > 1 && (
                        <div className="flex items-center justify-center gap-4 mt-8">
                            <button
                                disabled={meta.current_page <= 1}
                                onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
                                className="btn-secondary inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Previous
                            </button>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-600 px-4 py-2 bg-white rounded-lg border border-gray-200">
                                    Page {meta.current_page} of {meta.last_page}
                                </span>
                            </div>
                            <button
                                disabled={meta.current_page >= meta.last_page}
                                onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                                className="btn-secondary inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Next
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}