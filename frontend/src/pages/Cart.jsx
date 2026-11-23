import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag, Trash2, Minus, Plus } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { egp, errorMessage } from '../utils/format'
import { placeholder } from '../components/ProductCard'
export default function Cart() {
    const { cart, updateQty, removeItem } = useCart()
    const [localQuantities, setLocalQuantities] = useState({})
    const quantityTimers = useRef(new Map())
    const pendingQuantities = useRef(new Map())
    const syncingItems = useRef(new Set())
    
    const change = async (item, quantity) => {
        if (quantity < 1 || quantity > item.product.stock) return
        setLocalQuantities(prev => ({ ...prev, [item.id]: quantity }))
        pendingQuantities.current.set(item.id, quantity)

        const flushQuantity = async () => {
            if (syncingItems.current.has(item.id)) return
            syncingItems.current.add(item.id)
            try {
                while (pendingQuantities.current.has(item.id)) {
                    const latestQuantity = pendingQuantities.current.get(item.id)
                    pendingQuantities.current.delete(item.id)
                    await updateQty(item.id, latestQuantity)
                }
                setLocalQuantities(prev => {
                    const next = { ...prev }
                    delete next[item.id]
                    return next
                })
            } catch (err) {
                pendingQuantities.current.delete(item.id)
                setLocalQuantities(prev => {
                    const next = { ...prev }
                    delete next[item.id]
                    return next
                })
                alert(errorMessage(err))
            } finally {
                syncingItems.current.delete(item.id)
                const timer = quantityTimers.current.get(item.id)
                if (timer) {
                    clearTimeout(timer)
                    quantityTimers.current.delete(item.id)
                }
                if (pendingQuantities.current.has(item.id)) flushQuantity()
            }
        }

        const existingTimer = quantityTimers.current.get(item.id)
        if (existingTimer) clearTimeout(existingTimer)
        quantityTimers.current.set(item.id, setTimeout(() => {
            quantityTimers.current.delete(item.id)
            flushQuantity()
        }, 200))
    }
    const total = cart.items.reduce(
        (sum, item) => sum + Number(item.product.price) * (localQuantities[item.id] ?? item.quantity),
        0
    )
    if (cart.items.length === 0) {
        return (
            <div className="text-center py-16">
                <ShoppingBag className="w-20 h-20 mx-auto mb-4 text-gray-300" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
                <p className="text-gray-500 mb-6">Looks like you haven't added any items yet</p>
                <Link to="/" className="btn-primary inline-block">
                    Continue shopping
                </Link>
            </div>
        )
    }
    return (
        <div className="grid lg:grid-cols-3 gap-4 md:gap-6 px-4 max-w-7xl mx-auto">
            <div className="lg:col-span-2 space-y-4">
                {cart.items.map((item, index) => (
                    <div key={item.id} className={`card p-4 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center hover-lift animate-fade-in ${index < 3 ? `animate-delay-${index * 100}` : ''}`}>
                        <img src={item.product.image_url || placeholder} alt={item.product.name}
                            className="w-full sm:w-24 sm:h-24 h-32 object-cover rounded-lg" />
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{item.product.name}</p>
                            <p className="text-sm text-gray-500 mt-1">{egp(item.product.price)}</p>
                        </div>
                        <div className="flex items-center justify-between sm:justify-normal gap-2 mt-3 sm:mt-0">
                            <div className="flex items-center gap-1 rounded-full border border-gray-300 p-1">
                                <button
                                    type="button"
                                    aria-label={`Decrease ${item.product.name} quantity`}
                                    onClick={() => change(item, (localQuantities[item.id] ?? item.quantity) - 1)}
                                    disabled={(localQuantities[item.id] ?? item.quantity) <= 1}
                                    className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Minus className="w-4 h-4" />
                                </button>
                                <span className="w-8 text-center font-semibold tabular-nums">
                                    {localQuantities[item.id] ?? item.quantity}
                                </span>
                                <button
                                    type="button"
                                    aria-label={`Increase ${item.product.name} quantity`}
                                    onClick={() => change(item, (localQuantities[item.id] ?? item.quantity) + 1)}
                                    disabled={(localQuantities[item.id] ?? item.quantity) >= item.product.stock}
                                    className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                                <div className="w-px h-6 bg-gray-300 mx-1"></div>
                                <button 
                                    onClick={() => removeItem(item.id)} 
                                    className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-accent-50 hover:text-accent-600 transition-colors"
                                    title="Remove item"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="w-24 sm:w-32 text-right font-bold text-lg text-gray-900">
                                {egp(item.product.price * (localQuantities[item.id] ?? item.quantity))}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
            <aside className="card p-4 md:p-6 h-fit animate-scale-in">
                <h2 className="font-bold text-xl mb-4 text-gray-900">Order summary</h2>
                <div className="flex justify-between mb-6 text-lg">
                    <span className="text-gray-600">Total</span>
                    <span className="font-bold text-primary-600">{egp(total)}</span>
                </div>
                <Link to="/checkout"
                    className="btn-primary block text-center py-3 btn-press">
                    Proceed to checkout
                </Link>
            </aside>
        </div>
    )
}