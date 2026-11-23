import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { placeholder } from '../components/ProductCard'
import { egp, errorMessage } from '../utils/format'
export default function ProductDetails() {
    const { id } = useParams()
    const { user } = useAuth()
    const { addToCart } = useCart()
    const navigate = useNavigate()
    const [product, setProduct] = useState(null)
    const [qty, setQty] = useState(1)
    const [message, setMessage] = useState('')
    useEffect(() => {
        api.get(`/products/${id}`)
            .then((res) => setProduct(res.data))
            .catch(() => setProduct(false))
    }, [id])
    if (product === null) return (
        <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-200 border-t-primary-600"></div>
            <p className="mt-3 text-gray-600">Loading product...</p>
        </div>
    )
    if (product === false) return (
        <div className="text-center py-16">
            <Search className="w-20 h-20 mx-auto mb-4 text-gray-300" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Product not found</h2>
            <p className="text-gray-500 mb-6">The product you're looking for doesn't exist</p>
            <Link to="/" className="btn-primary inline-block">Browse products</Link>
        </div>
    )
    const handleAdd = async () => {
        if (!user) return navigate('/login', { state: { from: `/products/${id}` } })
        try {
            await addToCart(product.id, qty)
            setMessage('Added to cart')
        } catch (err) {
            setMessage(errorMessage(err))
        }
    }
    return (
        <div className="grid md:grid-cols-2 gap-8 card p-8">
            <img src={product.image_url || placeholder} alt={product.name}
                className="w-full rounded-xl object-cover" />
            <div>
                <p className="text-sm text-primary-600 font-medium uppercase tracking-wide">{product.category?.name}</p>
                <h1 className="text-3xl font-bold text-gray-900 mt-2">{product.name}</h1>
                <p className="text-3xl font-bold text-primary-600 mt-4">{egp(product.price)}</p>
                <p className="mt-6 text-gray-700 whitespace-pre-line leading-relaxed">{product.description}</p>
                <p className="mt-4 text-sm font-medium">
                    {product.stock > 0 ? (
                        <span className="text-success-600">✓ {product.stock} in stock</span>
                    ) : (
                        <span className="text-accent-600">✗ Out of stock</span>
                    )}
                </p>
                {product.stock > 0 && (
                    <div className="flex items-center gap-4 mt-6">
                        <input
                            type="number" min="1" max={product.stock} value={qty}
                            onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
                            className="w-24 input text-center"
                        />
                        <button onClick={handleAdd} className="btn-primary px-8 py-3">
                            Add to cart
                        </button>
                    </div>
                )}
                {message && (
                    <div className={`mt-4 text-sm px-4 py-2 rounded-lg ${
                        message.includes('Added') 
                            ? 'bg-success-50 text-success-700 border border-success-200' 
                            : 'bg-accent-50 text-accent-700 border border-accent-200'
                    }`}>
                        {message}
                    </div>
                )}
            </div>
        </div>
    )
}