import { useEffect, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import api from '../../api/axios'
import { egp, errorMessage } from '../../utils/format'
const statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled']
export default function AdminOrders() {
    const [orders, setOrders] = useState([])
    const [walletTransfers, setWalletTransfers] = useState([])
    const [loading, setLoading] = useState(true)
    const [reviewing, setReviewing] = useState(null)
    const [reviewError, setReviewError] = useState('')

    const load = () => {
        setLoading(true)
        setReviewError('')
        return Promise.all([
            api.get('/admin/orders'),
            api.get('/admin/wallet-transfers'),
        ]).then(([ordersResponse, transfersResponse]) => {
            setOrders(ordersResponse.data.data)
            setWalletTransfers(transfersResponse.data)
        }).catch((err) => {
            setReviewError(errorMessage(err, 'Failed to load orders and pending wallet transfers.'))
        }).finally(() => setLoading(false))
    }

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        load()
    }, [])

    if (loading) {
        return (
            <div className="text-center py-16">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-200 border-t-primary-600"></div>
                <p className="mt-3 text-gray-600">Loading orders...</p>
            </div>
        )
    }
    const changeStatus = async (order, status) => {
        try {
            await api.patch(`/admin/orders/${order.id}/status`, { status })
            load()
        } catch (err) {
            alert(errorMessage(err))
        }
    }
    const reviewTransfer = async (transfer, decision) => {
        const reason = decision === 'rejected'
            ? window.prompt('Reason for rejecting this transfer (optional):') || ''
            : ''
        if (decision === 'rejected' && reason.length > 1000) {
            setReviewError('The review reason must be 1000 characters or fewer.')
            return
        }
        setReviewing(transfer.id)
        setReviewError('')
        try {
            await api.post(`/admin/wallet-transfers/${transfer.id}/review`, { decision, reason })
            await load()
        } catch (err) {
            setReviewError(errorMessage(err, 'Could not review this transfer. Refresh and try again.'))
        } finally {
            setReviewing(null)
        }
    }
    const downloadReceipt = async (transfer) => {
        try {
            const { data } = await api.get(`/admin/wallet-transfers/${transfer.id}/receipt`, {
                responseType: 'blob',
            })
            const url = URL.createObjectURL(data)
            const link = document.createElement('a')
            link.href = url
            link.download = `wallet-receipt-order-${transfer.order_reference}`
            link.click()
            URL.revokeObjectURL(url)
        } catch (err) {
            setReviewError(errorMessage(err, 'Could not download the receipt.'))
        }
    }
    const markCodCollected = async (order) => {
        setReviewError('')
        try {
            await api.patch(`/admin/orders/${order.id}/cod-payment`, { collected: true })
            await load()
        } catch (err) {
            setReviewError(errorMessage(err, 'Could not record cash collection.'))
        }
    }
    return (
        <div className="space-y-6">
            {reviewError && (
                <div className="bg-accent-50 border border-accent-200 text-accent-700 px-4 py-3 rounded-lg" role="alert">
                    {reviewError}
                </div>
            )}
            <section className="card overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-3">
                    <div>
                        <h2 className="font-bold text-lg text-gray-900">Wallet transfers awaiting review</h2>
                        <p className="text-sm text-gray-500">Verify each transaction against the actual wallet statement before approving.</p>
                    </div>
                    <button onClick={load} disabled={loading} className="btn-primary px-3 py-2 inline-flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" /> Refresh
                    </button>
                </div>
                {walletTransfers.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500">No wallet transfers are awaiting review.</p>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {walletTransfers.map((transfer) => (
                            <div key={transfer.id} className="p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                <div className="space-y-1 text-sm">
                                    <p className="font-semibold text-gray-900">
                                        Order #{transfer.order_reference} · {transfer.wallet_method}
                                    </p>
                                    <p className="text-gray-700">{transfer.customer.name} ({transfer.customer.email})</p>
                                    <p className="text-gray-700">{egp(transfer.amount_egp)} · Transaction: {transfer.transaction_reference || 'Not provided'}</p>
                                    <p className="text-gray-700">Customer wallet number: <span dir="ltr">{transfer.wallet_sender_phone || 'Not provided'}</span></p>
                                    <p className="text-gray-500">Submitted {new Date(transfer.submitted_at).toLocaleString()}</p>
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                    {transfer.receipt_url && (
                                        <button onClick={() => downloadReceipt(transfer)} className="btn-secondary px-3 py-2 inline-flex items-center gap-2">
                                            <Download className="w-4 h-4" /> Receipt
                                        </button>
                                    )}
                                    <button
                                        onClick={() => reviewTransfer(transfer, 'rejected')}
                                        disabled={reviewing !== null}
                                        className="px-4 py-2 rounded-lg border border-accent-300 text-accent-700 hover:bg-accent-50 disabled:opacity-50"
                                    >Reject</button>
                                    <button
                                        onClick={() => reviewTransfer(transfer, 'approved')}
                                        disabled={reviewing !== null}
                                        className="btn-primary px-4 py-2 disabled:opacity-50"
                                    >{reviewing === transfer.id ? 'Reviewing...' : 'Approve verified transfer'}</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
            <section className="card overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th className="p-4 text-left font-semibold text-gray-700">#</th>
                        <th className="p-4 text-left font-semibold text-gray-700">Customer</th>
                        <th className="p-4 text-left font-semibold text-gray-700">Phone / City</th>
                        <th className="p-4 text-left font-semibold text-gray-700">Total</th>
                        <th className="p-4 text-left font-semibold text-gray-700">Payment</th>
                        <th className="p-4 text-left font-semibold text-gray-700">Status</th>
                        <th className="p-4 text-left font-semibold text-gray-700">Cash collection</th>
                    </tr>
                </thead>
                <tbody>
                    {orders.map((o) => (
                        <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors align-top">
                            <td className="p-4 font-medium text-gray-900">{o.id}</td>
                            <td className="p-4">
                                <div className="font-medium text-gray-900">{o.user?.name}</div>
                                <div className="text-xs text-gray-500 mt-1">{o.address}</div>
                            </td>
                            <td className="p-4">
                                <div className="text-gray-900">{o.phone}</div>
                                <div className="text-xs text-gray-500 mt-1">{o.city}</div>
                            </td>
                            <td className="p-4 font-medium text-gray-900">{egp(o.total)}</td>
                            <td className="p-4">
                                <span className="text-gray-700">{o.payment_method}</span>
                                <span className="text-gray-400 mx-1">/</span>
                                <span className="text-gray-700">{o.payment_status}</span>
                            </td>
                            <td className="p-4">
                                <select
                                    value={o.status}
                                    disabled={o.status === 'cancelled'}
                                    onChange={(e) => changeStatus(o, e.target.value)}
                                    className="input py-1.5 text-sm"
                                >
                                    {statuses.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                                </select>
                            </td>
                            <td className="p-4">
                                {o.payment_method === 'cod' && o.status === 'delivered' && o.payment_status !== 'paid' ? (
                                    <button onClick={() => markCodCollected(o)} className="btn-primary px-3 py-2 text-xs">
                                        Record cash received
                                    </button>
                                ) : o.payment_method === 'cod' ? (
                                    <span className="text-gray-500">{o.payment_status === 'paid' ? 'Collected' : 'Collect on delivery'}</span>
                                ) : '—'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            </div>
            </section>
        </div>
    )
}