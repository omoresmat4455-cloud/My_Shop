import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertCircle, CheckCircle, CreditCard, RefreshCw, Smartphone, XCircle } from 'lucide-react'
import api from '../api/axios'
import { egp } from '../utils/format'

const paymentMethodNames = {
    card: 'Card',
    vodafone: 'Vodafone Cash',
    orange: 'Orange Cash',
    etisalat: 'Etisalat Cash',
}

export default function PaymentResult() {
    const [params] = useSearchParams()
    const orderId = params.get('order_id')
    const [order, setOrder] = useState(null)
    const [status, setStatus] = useState('checking')
    const [refreshKey, setRefreshKey] = useState(0)

    useEffect(() => {
        let cancelled = false
        let timeout
        let attempts = 0

        const checkPayment = async () => {
            if (!orderId) {
                setStatus('unverified')
                return
            }

            try {
                const { data } = await api.get(`/orders/${encodeURIComponent(orderId)}`)
                if (cancelled) return

                setOrder(data)
                if (data.payment_status === 'paid') {
                    setStatus('paid')
                    return
                }
                if (data.payment_status === 'failed') {
                    setStatus('failed')
                    return
                }

                attempts += 1
                if (attempts < 8) {
                    timeout = setTimeout(checkPayment, 1500)
                } else {
                    setStatus('pending')
                }
            } catch {
                if (!cancelled) setStatus('unverified')
            }
        }

        checkPayment()

        return () => {
            cancelled = true
            clearTimeout(timeout)
        }
    }, [orderId, refreshKey])

    const method = paymentMethodNames[order?.payment_method] || 'online payment'
    const paymentIcon = ['vodafone', 'orange', 'etisalat'].includes(order?.payment_method)
        ? <Smartphone className="w-16 h-16 md:w-20 md:h-20 mx-auto text-primary-500" />
        : <CreditCard className="w-16 h-16 md:w-20 md:h-20 mx-auto text-success-500" />

    const result = {
        checking: {
            icon: <AlertCircle className="w-16 h-16 md:w-20 md:h-20 mx-auto text-primary-500" />,
            title: 'Verifying payment',
            message: 'We are checking the payment status with the server.',
        },
        paid: {
            icon: <CheckCircle className="w-16 h-16 md:w-20 md:h-20 mx-auto text-success-500" />,
            title: 'Payment confirmed',
            message: `Your payment via ${method} has been confirmed.`,
        },
        failed: {
            icon: <XCircle className="w-16 h-16 md:w-20 md:h-20 mx-auto text-accent-500" />,
            title: 'Payment failed',
            message: 'Payment could not be completed. You can try again from your orders page.',
        },
        pending: {
            icon: <AlertCircle className="w-16 h-16 md:w-20 md:h-20 mx-auto text-warning-500" />,
            title: 'الدفع قيد التحقق',
            message: 'لم يؤكد مزود الدفع العملية حتى الآن. لا تعتبر العملية مدفوعة قبل تحديث الحالة من الخادم.',
        },
        unverified: {
            icon: <AlertCircle className="w-16 h-16 md:w-20 md:h-20 mx-auto text-warning-500" />,
            title: 'تعذر التحقق من حالة الدفع',
            message: 'لم نتمكن من جلب حالة الطلب من الخادم. راجع طلباتك قبل محاولة الدفع مرة أخرى.',
        },
    }[status]

    return (
        <div className="text-center py-12 md:py-16 px-4 space-y-6">
            {status === 'paid' ? paymentIcon : result.icon}
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{result.title}</h1>
            <p className="text-gray-600 text-base md:text-lg max-w-md mx-auto">{result.message}</p>
            {order && (
                <div className="max-w-md mx-auto rounded-lg bg-gray-50 border border-gray-200 p-4 text-left space-y-2">
                    <p><strong>رقم الطلب:</strong> #{order.id}</p>
                    <p><strong>المبلغ:</strong> {egp(order.total)}</p>
                    <p><strong>طريقة الدفع:</strong> {method}</p>
                    <p><strong>حالة الدفع:</strong> {order.payment_status === 'paid'
                        ? 'تم تأكيد الدفع'
                        : order.payment_status === 'failed'
                            ? 'تعذر تأكيد الدفع'
                            : 'قيد التحقق'}</p>
                </div>
            )}
            {['pending', 'unverified'].includes(status) && (
                <button
                    onClick={() => {
                        setStatus('checking')
                        setRefreshKey((current) => current + 1)
                    }}
                    className="btn-secondary inline-flex items-center gap-2 px-5 py-3"
                >
                    <RefreshCw className="w-4 h-4" /> تحديث حالة الدفع
                </button>
            )}
            <Link to="/orders" className="btn-primary inline-block px-8 py-3">
                Go to my orders
            </Link>
        </div>
    )
}
