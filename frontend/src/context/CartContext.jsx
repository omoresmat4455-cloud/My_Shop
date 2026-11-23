import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import api from '../api/axios'
import { useAuth } from './AuthContext'
const CartContext = createContext(null)
const emptyCart = { items: [], total: 0 }
export function CartProvider({ children }) {
    const { user } = useAuth()
    const [cart, setCart] = useState(emptyCart)
    const refresh = useCallback(async () => {
        if (!user) {
            setCart(emptyCart)
            return
        }
        const { data } = await api.get('/cart')
        setCart(data)
    }, [user])
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        refresh().catch(() => { })
    }, [refresh])
    // Every cart endpoint returns the full cart, so we just replace the state
    const addToCart = async (productId, quantity = 1) => {
        const { data } = await api.post('/cart', { product_id: productId, quantity })
        setCart(data)
    }
    const updateQty = async (itemId, quantity) => {
        const { data } = await api.put(`/cart/${itemId}`, { quantity })
        setCart(data)
    }
    const removeItem = async (itemId) => {
        const { data } = await api.delete(`/cart/${itemId}`)
        setCart(data)
    }
    const count = cart.items.reduce((sum, item) => sum + item.quantity, 0)
    return (
        <CartContext.Provider
            value={{ cart, count, refresh, addToCart, updateQty, removeItem }}
        >
            {children}
        </CartContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useCart = () => useContext(CartContext)