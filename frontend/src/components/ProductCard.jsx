import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { egp, errorMessage } from '../utils/format'

export const placeholder = 'https://placehold.co/400x300?text=No+Image'

export default function ProductCard({ product }) {
    const { user } = useAuth()
    const { addToCart } = useCart()
    const navigate = useNavigate()
    const [busy, setBusy] = useState(false)

    const handleAdd = async () => {
        if (!user) return navigate('/login')

        setBusy(true)
        try {
            await addToCart(product.id, 1)
        } catch (err) {
            alert(errorMessage(err, 'Could not add to cart'))
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="card group flex h-full min-w-0 flex-col overflow-hidden hover-lift animate-fade-in">
            <Link
                to={`/products/${product.id}`}
                className="relative block h-48 shrink-0 overflow-hidden sm:h-52"
            >
                <img
                    src={product.image_url || placeholder}
                    alt={product.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />

                {product.stock < 1 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <span className="font-semibold text-white">Out of Stock</span>
                    </div>
                )}
            </Link>

            <div className="flex flex-1 flex-col p-4">
                <p className="min-h-4 text-xs font-medium uppercase tracking-wide text-primary-600">
                    {product.category?.name || '\u00A0'}
                </p>

                <Link
                    to={`/products/${product.id}`}
                    className="mt-1 line-clamp-2 min-h-12 font-semibold text-gray-900 transition-colors hover:text-primary-600"
                >
                    {product.name}
                </Link>

                <div className="mt-auto pt-3">
                    <p className="flex h-14 items-start text-lg font-bold leading-7 text-gray-900 sm:text-xl">
                        {egp(product.price)}
                    </p>

                    <button
                        onClick={handleAdd}
                        disabled={busy || product.stock < 1}
                        className="btn-primary btn-press mt-3 h-12 w-full"
                    >
                        {product.stock < 1
                            ? 'Out of stock'
                            : busy
                              ? 'Adding...'
                              : 'Add to cart'}
                    </button>
                </div>
            </div>
        </div>
    )
}
