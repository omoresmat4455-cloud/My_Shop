import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CreditCard, Smartphone, ShoppingBag } from 'lucide-react'
import api from '../api/axios'
import { useCart } from '../context/CartContext'
import { egp, errorMessage } from '../utils/format'

const paymentMethods = [
    { value: 'cod', label: 'Cash on delivery', detail: 'Pay when your order is delivered' },
    { value: 'vodafone', label: 'Vodafone Cash', detail: 'Transfer from your own wallet app' },
    { value: 'orange', label: 'Orange Cash', detail: 'Transfer from your own wallet app' },
    { value: 'etisalat', label: 'Etisalat Cash', detail: 'Transfer from your own wallet app' },
    { value: 'card', label: 'Visa / Credit or debit card', detail: 'Continue to secure card checkout' },
]

export default function Checkout() {
    const { cart, refresh } = useCart()
    const navigate = useNavigate()
    const idempotencyKey = useRef(null)
    const [form, setForm] = useState({
        address: '', city: '', phone: '', payment_method: 'cod',
    })
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const [availableMethods, setAvailableMethods] = useState(null)
    const [methodsError, setMethodsError] = useState('')

    useEffect(() => {
        let active = true
        api.get('/payment-methods')
            .then(({ data }) => {
                if (active) setAvailableMethods(
                    Object.fromEntries(data.methods.map((method) => [method.id, method]))
                )
            })
            .catch(() => {
                if (active) {
                    setMethodsError('تعذر تحميل طرق الدفع. أعد المحاولة قبل تأكيد الطلب.')
                    setAvailableMethods({})
                }
            })
        return () => { active = false }
    }, [])

    const set = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.value }))
    const submit = async (e) => {
        e.preventDefault()
        setError('')
        setBusy(true)
        try {
            if (!idempotencyKey.current) {
                idempotencyKey.current = window.crypto?.randomUUID?.()
                    || `${Date.now()}-${Math.random().toString(36).slice(2)}`
            }
            const { data } = await api.post('/orders', form, {
                headers: { 'Idempotency-Key': idempotencyKey.current },
            })
            let followUpWarning = ''
            try {
                await refresh()
            } catch {
                followUpWarning = 'تعذر تحديث سلة التسوق، لكن تم إنشاء طلبك.'
            }
            if (form.payment_method === 'card') {
                try {
                    const payment = await api.post(`/orders/${data.order.id}/pay`, {
                        payment_method: 'card',
                    })
                    if (payment.data.payment_url) {
                        window.location.assign(payment.data.payment_url)
                        return
                    }
                    followUpWarning = payment.data.message || 'تعذر بدء الدفع بالبطاقة. يمكنك إعادة المحاولة من صفحة الطلبات.'
                } catch (paymentError) {
                    followUpWarning = errorMessage(
                        paymentError,
                        'تم إنشاء الطلب، لكن تعذر بدء الدفع بالبطاقة. يمكنك إعادة المحاولة من صفحة الطلبات.'
                    )
                }
            }
            navigate('/orders', {
                state: {
                    placedOrder: data.order,
                    message: data.message,
                    payment_instructions: data.payment_instructions,
                    warning: followUpWarning,
                },
                replace: true,
            })
        } catch (err) {
            setError(errorMessage(
                err,
                'تعذر إرسال الطلب. تحقق من اتصال الإنترنت وحاول مرة أخرى.'
            ))
        } finally {
            setBusy(false)
        }
    }
    if (cart.items.length === 0) {
        return (
            <div className="text-center py-16">
                <ShoppingBag className="w-20 h-20 mx-auto mb-4 text-gray-300" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
                <p className="text-gray-500 mb-6">Add items before checkout</p>
                <Link to="/" className="btn-primary inline-block">Shop now</Link>
            </div>
        )
    }
    return (
        <form onSubmit={submit} className="max-w-2xl mx-auto card p-6 md:p-8 space-y-5">
            <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>
                <p className="text-gray-500 text-sm mt-1">راجع بياناتك واختر طريقة الدفع</p>
            </div>
            {error && (
                <div className="bg-accent-50 border border-accent-200 text-accent-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                </div>
            )}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Street address</label>
                <input placeholder="Enter your street address" className="input"
                    value={form.address} onChange={set('address')} required />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input placeholder="Enter your city" className="input"
                    value={form.city} onChange={set('city')} required />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile number</label>
                <input placeholder="01xxxxxxxxx" className="input"
                    value={form.phone} onChange={set('phone')} pattern="01[0-9]{9}" required />
            </div>
            <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">طريقة الدفع</label>
                {methodsError && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm" role="alert">
                        {methodsError}
                        <button
                            type="button"
                            className="underline ml-2"
                            onClick={() => {
                                setMethodsError('')
                                setAvailableMethods(null)
                                api.get('/payment-methods')
                                    .then(({ data }) => setAvailableMethods(
                                        Object.fromEntries(data.methods.map((method) => [method.id, method]))
                                    ))
                                    .catch(() => {
                                        setMethodsError('تعذر تحميل طرق الدفع. تحقق من اتصال الخادم.')
                                        setAvailableMethods({})
                                    })
                            }}
                        >إعادة المحاولة</button>
                    </div>
                )}
                {availableMethods === null && <p className="text-sm text-gray-500">جارٍ تحميل طرق الدفع...</p>}
                {paymentMethods.map((method) => {
                    const enabled = availableMethods?.[method.value]?.enabled ?? false
                    return (
                    <label key={method.value} className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                        form.payment_method === method.value
                            ? 'border-primary-500 bg-primary-50'
                            : enabled ? 'border-gray-200 hover:border-primary-300' : 'border-gray-200 bg-gray-50 opacity-70'
                    }`}>
                        <input type="radio" name="payment_method" value={method.value}
                            checked={form.payment_method === method.value}
                            onChange={set('payment_method')} disabled={!enabled} className="w-4 h-4" />
                        {method.value === 'card'
                            ? <CreditCard className="w-5 h-5 text-primary-600" />
                            : method.value === 'cod'
                                ? <ShoppingBag className="w-5 h-5 text-gray-600" />
                                : <Smartphone className="w-5 h-5 text-primary-600" />}
                        <span>
                            <span className="block font-medium text-gray-800">{method.label}</span>
                            <span className="block text-xs text-gray-500">
                                {!enabled && availableMethods !== null
                                    ? method.value === 'card'
                                        ? 'غير متاح حاليًا — يلزم إعداد بوابة الدفع'
                                        : 'غير متاح حاليًا — يرجى التواصل مع المتجر'
                                    : method.detail}
                            </span>
                        </span>
                    </label>
                    )
                })}
                {['vodafone', 'orange', 'etisalat'].includes(form.payment_method) && (
                    <p className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                        سيظهر رقم المحفظة ومبلغ التحويل بعد إنشاء الطلب. لن نطلب الرقم السري أو رمز OTP.
                    </p>
                )}
            </div>
            <div className="flex justify-between border-t-2 border-gray-200 pt-4 text-lg">
                <span className="text-gray-600">Total</span>
                <span className="font-bold text-primary-600">{egp(cart.total)}</span>
            </div>
            <button type="submit" disabled={busy || availableMethods === null || !availableMethods?.[form.payment_method]?.enabled}
                className="btn-primary w-full py-3">
                {busy ? 'جارٍ إرسال الطلب...' : 'تأكيد الطلب'}
            </button>
        </form>
    )
}