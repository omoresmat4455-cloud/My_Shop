import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Package, Clock, CreditCard, DollarSign, CheckCircle, XCircle, Truck, AlertCircle, Calendar, ShoppingBag, Smartphone } from 'lucide-react'
import api from '../api/axios'
import { egp, errorMessage } from '../utils/format'

const statusConfig = {
    pending: {
        color: 'bg-warning-100 text-warning-800 border-warning-200',
        icon: Clock,
        label: 'Pending'
    },
    processing: {
        color: 'bg-info-100 text-info-800 border-info-200',
        icon: AlertCircle,
        label: 'Processing'
    },
    shipped: {
        color: 'bg-primary-100 text-primary-800 border-primary-200',
        icon: Truck,
        label: 'Shipped'
    },
    delivered: {
        color: 'bg-success-100 text-success-800 border-success-200',
        icon: CheckCircle,
        label: 'Delivered'
    },
    cancelled: {
        color: 'bg-accent-100 text-accent-800 border-accent-200',
        icon: XCircle,
        label: 'Cancelled'
    },
}

const paymentMethodLabels = {
    cod: 'Cash on delivery',
    card: 'Visa / Credit or debit card',
    vodafone: 'Vodafone Cash',
    orange: 'Orange Cash',
    etisalat: 'Etisalat Cash',
}

const paymentStatusLabels = {
    unpaid: 'غير مدفوع',
    awaiting_payment_confirmation: 'بانتظار تأكيد التحويل',
    paid: 'تم تأكيد الدفع',
    failed: 'تعذر تأكيد الدفع',
}

const attemptStatusLabels = {
    initiating: 'جارٍ تجهيز جلسة الدفع',
    pending: 'بانتظار نتيجة بوابة الدفع',
    awaiting_verification: 'تحويل المحفظة قيد المراجعة',
    approved: 'تمت مراجعة التحويل',
    rejected: 'تم رفض التحويل',
    failed: 'فشلت محاولة الدفع',
}

export default function Orders() {
    const location = useLocation()
    const navigate = useNavigate()
    const [orders, setOrders] = useState(null)
    const [loadError, setLoadError] = useState('')
    const [pageMessage, setPageMessage] = useState(location.state?.message || '')
    const [checkoutWarning] = useState(location.state?.warning || '')
    const [paymentModal, setPaymentModal] = useState({ open: false, order: null, instructions: null })
    const [paymentLoading, setPaymentLoading] = useState(false)
    const [paymentError, setPaymentError] = useState('')
    const [transferReference, setTransferReference] = useState('')
    const [walletSenderPhone, setWalletSenderPhone] = useState('')
    const [receipt, setReceipt] = useState(null)

    const loadOrders = async () => {
        setLoadError('')
        try {
            const { data } = await api.get('/orders')
            setOrders(data)
        } catch (err) {
            setLoadError(errorMessage(err, 'تعذر تحميل الطلبات. تحقق من الاتصال ثم أعد المحاولة.'))
        }
    }

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadOrders()
    }, [])

    const beginPayment = async (order) => {
        try {
            setPaymentError('')
            setPaymentLoading(true)
            if (order.payment_method === 'card') {
                const { data } = await api.post(`/orders/${order.id}/pay`, {
                    payment_method: 'card',
                })
                if (!data.payment_url) {
                    throw new Error(data.message || 'Secure card checkout is unavailable. Please try again later.')
                }
                window.location.assign(data.payment_url)
                return
            }

            const { data } = await api.get(`/orders/${order.id}`)
            setTransferReference('')
            setWalletSenderPhone('')
            setReceipt(null)
            setPaymentModal({ open: true, order: data, instructions: data.payment_instructions })
        } catch (err) {
            setPaymentError(errorMessage(
                err,
                'تعذر بدء الدفع. تحقق من الاتصال وحاول مرة أخرى.'
            ))
        } finally {
            setPaymentLoading(false)
        }
    }

    const submitWalletTransfer = async (event) => {
        event.preventDefault()
        if (!paymentModal.order) return
        setPaymentError('')
        setPaymentLoading(true)
        const body = new FormData()
        body.append('wallet_sender_phone', walletSenderPhone.trim())
        if (transferReference.trim()) body.append('transaction_reference', transferReference.trim())
        if (receipt) body.append('receipt', receipt)
        try {
            const { data } = await api.post(
                `/orders/${paymentModal.order.id}/wallet-transfer`,
                body
            )
            setPaymentModal({ open: false, order: null, instructions: null })
            setPageMessage(data.message)
            await loadOrders()
        } catch (err) {
            setPaymentError(errorMessage(
                err,
                'تعذر إرسال بيانات التحويل. تحقق من الملف والاتصال ثم حاول مرة أخرى.'
            ))
        } finally {
            setPaymentLoading(false)
        }
    }

    if (orders === null) return (
        <div className="flex items-center justify-center py-12">
            <div className="text-center">
                {loadError
                    ? <><p className="text-accent-700 mb-3">{loadError}</p><button onClick={loadOrders} className="btn-primary px-5 py-2">إعادة المحاولة</button></>
                    : <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-200 border-t-primary-600"></div>}
            </div>
        </div>
    )

    if (orders.length === 0) return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <div className="text-center max-w-md">
                <div className="w-32 h-32 mx-auto mb-6 bg-primary-100 rounded-full flex items-center justify-center">
                    <Package className="w-16 h-16 text-primary-600" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-3">No orders yet</h2>
                <p className="text-gray-500 mb-8 text-lg">Start shopping to see your orders here</p>
                <Link to="/" className="btn-primary inline-flex items-center gap-2 px-8 py-3 text-lg">
                    <ShoppingBag className="w-5 h-5" />
                    Browse products
                </Link>
            </div>
        </div>
    )

    return (
        <>
            <div className="space-y-8 px-4 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">My Orders</h1>
                    <p className="text-gray-500 mt-1">{orders.length} order{orders.length !== 1 ? 's' : ''}</p>
                </div>
                {pageMessage && (
                    <div className="bg-success-50 border border-success-200 text-success-800 px-4 py-3 rounded-lg" role="status">
                        {pageMessage}
                        {location.state?.message && (
                            <button
                                className="underline ml-2"
                                onClick={() => {
                                    setPageMessage('')
                                    navigate(location.pathname, { replace: true, state: null })
                                }}
                            >إغلاق</button>
                        )}
                    </div>
                )}
                {checkoutWarning && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg" role="status">
                        {checkoutWarning}
                    </div>
                )}
                {location.state?.payment_instructions && (
                    <div className="card p-4 md:p-6 border border-primary-200 bg-primary-50 space-y-2">
                        <h2 className="font-bold text-gray-900">تعليمات تحويل المحفظة</h2>
                        <p>المحفظة: {location.state.payment_instructions.wallet}</p>
                        <p>رقم التحويل: <span dir="ltr">{location.state.payment_instructions.recipient_number}</span></p>
                        <p>المبلغ: {egp(location.state.payment_instructions.amount_egp)}</p>
                        <p>رقم الطلب: #{location.state.payment_instructions.order_reference}</p>
                        <p className="text-sm text-gray-700">حوّل من تطبيق محفظتك ثم أرسل رقم العملية أو الإيصال من زر الطلب. لن نطلب الرقم السري أو رمز OTP.</p>
                    </div>
                )}
                {loadError && <div className="bg-accent-50 border border-accent-200 text-accent-700 px-4 py-3 rounded-lg">{loadError}</div>}
                {paymentError && !paymentModal.open && (
                    <div className="bg-accent-50 border border-accent-200 text-accent-700 px-4 py-3 rounded-lg" role="alert">
                        {paymentError}
                    </div>
                )}
            </div>
            {orders.map((order, index) => {
                const StatusIcon = statusConfig[order.status]?.icon || Clock
                return (
                    <div key={order.id} className={`card overflow-hidden hover:shadow-xl transition-all duration-300 hover-lift animate-slide-in ${index < 3 ? `animate-delay-${index * 100}` : ''}`}>
                        <div className="p-4 md:p-6 border-b border-gray-200 bg-gray-50">
                            <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                                        <span className="font-bold text-lg md:text-xl text-gray-900">Order #{order.id}</span>
                                        <span className={`px-3 py-1 rounded-full text-xs md:text-sm font-semibold border ${statusConfig[order.status]?.color}`}>
                                            <span className="flex items-center gap-2">
                                                <StatusIcon className="w-4 h-4" />
                                                {statusConfig[order.status]?.label}
                                            </span>
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <Calendar className="w-4 h-4" />
                                        <span>
                                            {new Date(order.created_at).toLocaleDateString('en-US', { 
                                                year: 'numeric', 
                                                month: 'long', 
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold flex items-center gap-2 ${
                                        order.payment_status === 'paid' 
                                            ? 'bg-success-50 text-success-800 border border-success-200' 
                                            : 'bg-warning-50 text-warning-800 border border-warning-200'
                                    }`}>
                                        {order.payment_method === 'card' ? (
                                            <CreditCard className="w-4 h-4" />
                                        ) : order.payment_method === 'cod' ? (
                                            <DollarSign className="w-4 h-4" />
                                        ) : (
                                            <Smartphone className="w-4 h-4" />
                                        )}
                                        {paymentMethodLabels[order.payment_method] || 'Payment'} - {paymentStatusLabels[order.payment_status] || order.payment_status}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 md:p-6">
                            {order.latest_payment_attempt?.status && (
                                <div className={`mb-4 rounded-lg border p-3 text-sm ${
                                    order.latest_payment_attempt.status === 'rejected' ||
                                    order.latest_payment_attempt.status === 'failed'
                                        ? 'border-accent-200 bg-accent-50 text-accent-800'
                                        : 'border-amber-200 bg-amber-50 text-amber-800'
                                }`}>
                                    {attemptStatusLabels[order.latest_payment_attempt.status] || order.latest_payment_attempt.status}
                                    {order.latest_payment_attempt.review_reason
                                        ? `: ${order.latest_payment_attempt.review_reason}`
                                        : ''}
                                </div>
                            )}
                            <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wide">Order Items</h3>
                            <ul className="space-y-4">
                                {order.items.map((item) => (
                                    <li key={item.id} className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors gap-4">
                                        <div className="flex items-center gap-4 min-w-0 flex-1">
                                            <img 
                                                src={item.product.image_url} 
                                                alt={item.product.name}
                                                className="w-12 h-12 md:w-14 md:h-14 object-cover rounded-xl flex-shrink-0"
                                                onError={(e) => {
                                                    e.target.src = 'https://placehold.co/56x56?text=No+Image'
                                                }}
                                            />
                                            <div className="min-w-0">
                                                <p className="font-semibold text-gray-900 truncate">{item.product.name}</p>
                                                <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                                            </div>
                                        </div>
                                        <span className="font-bold text-base md:text-lg text-gray-900 flex-shrink-0">{egp(item.price * item.quantity)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="p-4 md:p-6 bg-gray-50 border-t border-gray-200">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div>
                                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Total Amount</p>
                                    <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">{egp(order.total)}</p>
                                </div>
                                {order.payment_method !== 'cod' &&
                                    order.payment_status !== 'paid' &&
                                    order.status !== 'cancelled' && order.status !== 'delivered' && (
                                        ['awaiting_verification', 'initiating', 'pending'].includes(order.latest_payment_attempt?.status)
                                            ? <span className="text-sm text-amber-700">
                                                {order.latest_payment_attempt.status === 'awaiting_verification'
                                                    ? 'تم استلام بيانات التحويل وهي قيد المراجعة'
                                                    : 'محاولة الدفع قيد المعالجة'}
                                            </span>
                                            : <button
                                            onClick={() => beginPayment(order)}
                                            disabled={paymentLoading}
                                            className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-base md:text-lg font-semibold w-full sm:w-auto"
                                        >
                                            {order.payment_method === 'card'
                                                ? <CreditCard className="w-5 h-5" />
                                                : <Smartphone className="w-5 h-5" />}
                                            {paymentLoading ? 'جارٍ التحضير...' : order.payment_method === 'card'
                                                ? 'الدفع الآمن بالبطاقة'
                                                : 'إرسال بيانات التحويل'}
                                            </button>
                                    )}
                                {order.payment_method === 'cod' && order.payment_status !== 'paid' && (
                                    <span className="text-sm text-gray-600">سيتم تحصيل المبلغ عند التسليم</span>
                                )}
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>

        {paymentModal.open && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="card p-6 max-w-lg w-full animate-scale-in max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-gray-900">تعليمات تحويل المحفظة</h2>
                        <button
                            onClick={() => setPaymentModal({ open: false, order: null, instructions: null })}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <XCircle className="w-6 h-6" />
                        </button>
                    </div>
                    {paymentModal.instructions ? (
                        <>
                            <div className="rounded-lg bg-primary-50 border border-primary-200 p-4 space-y-2 text-gray-800">
                                <p><strong>المحفظة:</strong> {paymentModal.instructions.wallet}</p>
                                <p><strong>حوّل إلى رقم المتجر:</strong> <span dir="ltr">{paymentModal.instructions.recipient_number}</span></p>
                                <p><strong>المبلغ:</strong> {egp(paymentModal.instructions.amount_egp)}</p>
                                <p><strong>رقم الطلب:</strong> #{paymentModal.instructions.order_reference}</p>
                            </div>
                            <p className="text-sm text-gray-600 my-4">
                                حوّل المبلغ من تطبيق محفظتك، ثم أرسل رقم العملية أو إيصال التحويل. لن نطلب رقمك السري أو رمز OTP. رفع الإيصال لا يعني تأكيد الدفع؛ سيُراجع التحويل يدويًا.
                            </p>
                            <form onSubmit={submitWalletTransfer} className="space-y-4">
                                <label className="block text-sm font-medium text-gray-700">
                                    رقم محفظتك التي أرسلت منها التحويل
                                    <input
                                        type="tel"
                                        inputMode="numeric"
                                        dir="ltr"
                                        value={walletSenderPhone}
                                        onChange={(event) => setWalletSenderPhone(event.target.value)}
                                        placeholder="01xxxxxxxxx"
                                        pattern="01[0-9]{9}"
                                        maxLength={11}
                                        autoComplete="tel"
                                        required
                                        className="input mt-1"
                                    />
                                    <span className="block mt-1 text-xs text-gray-500">
                                        أدخل رقم محفظتك أنت (مثال Orange Cash يبدأ بـ 012). سيتم التحويل إلى رقم المتجر الموضح أعلاه.
                                    </span>
                                </label>
                                <label className="block text-sm font-medium text-gray-700">
                                    رقم العملية (اختياري عند رفع الإيصال)
                                    <input
                                        value={transferReference}
                                        onChange={(event) => setTransferReference(event.target.value)}
                                        maxLength={255}
                                        className="input mt-1"
                                        autoComplete="off"
                                    />
                                </label>
                                <label className="block text-sm font-medium text-gray-700">
                                    إيصال التحويل (اختياري عند إدخال رقم العملية، حد أقصى 5 ميجابايت)
                                    <input
                                        type="file"
                                        accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                                        onChange={(event) => {
                                            const file = event.target.files?.[0] || null
                                            const extension = file?.name.split('.').pop()?.toLowerCase()
                                            const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf']
                                            if (file && (
                                                !['jpg', 'jpeg', 'png', 'pdf'].includes(extension)
                                                || (file.type && !allowedTypes.includes(file.type))
                                            )) {
                                                setPaymentError('يرجى اختيار صورة JPG أو PNG أو ملف PDF.')
                                                event.target.value = ''
                                                setReceipt(null)
                                                return
                                            }
                                            if (file && file.size > 5 * 1024 * 1024) {
                                                setPaymentError('حجم الإيصال يجب ألا يتجاوز 5 ميجابايت.')
                                                event.target.value = ''
                                                setReceipt(null)
                                                return
                                            }
                                            setPaymentError('')
                                            setReceipt(file)
                                        }}
                                        className="block w-full text-sm mt-1"
                                    />
                                </label>
                                {paymentError && <p className="text-sm text-accent-700" role="alert">{paymentError}</p>}
                                <button disabled={paymentLoading || !/^01[0-9]{9}$/.test(walletSenderPhone.trim()) || (!transferReference.trim() && !receipt)} className="btn-primary w-full py-3">
                                    {paymentLoading ? 'جارٍ إرسال البيانات...' : 'إرسال للتحقق'}
                                </button>
                            </form>
                        </>
                    ) : (
                        <p className="text-sm text-accent-700">{paymentError || 'تعذر تحميل تعليمات التحويل.'}</p>
                    )}
                    <button
                        onClick={() => setPaymentModal({ open: false, order: null, instructions: null })}
                        className="mt-4 w-full py-2 text-gray-600 hover:text-gray-900 font-medium"
                    >إغلاق</button>
                </div>
            </div>
        )}
        </>
    )
}
