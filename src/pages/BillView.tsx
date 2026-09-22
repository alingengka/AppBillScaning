import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, STATUS_LABEL, STATUS_STYLE } from '@/lib/format'
import Spinner from '@/components/Spinner'
import type { OrderStatus, OrderWithItems, ShopSettings } from '@/types'

export default function BillView() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()

  const [order, setOrder] = useState<OrderWithItems | null>(null)
  const [shop, setShop] = useState<ShopSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!orderId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const [{ data: orderData, error: orderError }, { data: shopData }] = await Promise.all([
        supabase.from('orders').select('*, order_items(*)').eq('id', orderId).single(),
        supabase.from('shop_settings').select('*').maybeSingle(),
      ])
      if (cancelled) return
      if (orderError) setError(orderError.message)
      else setOrder(orderData as OrderWithItems)
      setShop((shopData as ShopSettings) ?? null)
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [orderId])

  async function updateStatus(status: OrderStatus) {
    if (!order) return
    setUpdating(true)
    const { error } = await supabase.from('orders').update({ status }).eq('id', order.id)
    if (!error) setOrder({ ...order, status })
    setUpdating(false)
  }

  async function deleteOrder() {
    if (!order) return
    if (!confirm('ลบออเดอร์นี้ใช่หรือไม่? การลบไม่สามารถย้อนกลับได้')) return
    setUpdating(true)
    const { error } = await supabase.from('orders').delete().eq('id', order.id)
    setUpdating(false)
    if (!error) navigate('/')
  }

  const subtotal = order ? order.order_items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0) : 0
  const total = subtotal + (order?.delivery_fee || 0)

  function billText(): string {
    if (!order) return ''
    const lines = [
      shop?.shop_name ?? 'บิลสั่งซื้อสินค้า',
      '—'.repeat(20),
      ...order.order_items.map(
        (it) => `${it.name}  x${it.quantity}  ${formatCurrency(it.quantity * it.unit_price)}฿`,
      ),
      '—'.repeat(20),
      `ค่าจัดส่ง: ${formatCurrency(order.delivery_fee)}฿`,
      `ยอดสุทธิ: ${formatCurrency(total)}฿`,
      '',
      `ลูกค้า: ${order.customer_name || '-'}`,
      `โทร: ${order.customer_phone || '-'}`,
      `ที่อยู่: ${order.delivery_address || '-'}`,
      order.note ? `หมายเหตุ: ${order.note}` : '',
    ]
    return lines.filter(Boolean).join('\n')
  }

  async function handleShare() {
    const text = billText()
    if (navigator.share) {
      try {
        await navigator.share({ title: 'บิลออเดอร์', text })
        return
      } catch {
        /* user cancelled — fall through to copy */
      }
    }
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <p className="text-sm text-red-600">{error || 'ไม่พบออเดอร์นี้'}</p>
        <Link to="/" className="text-sm font-semibold text-brand-600">
          กลับหน้าออเดอร์
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex items-center justify-between">
        <Link to="/" className="text-sm font-medium text-ink-muted hover:text-brand-600">
          ← ออเดอร์ทั้งหมด
        </Link>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[order.status]}`}>
          {STATUS_LABEL[order.status]}
        </span>
      </div>

      {/* Printable bill */}
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm print:border-0 print:shadow-none">
        <div className="mb-4 flex items-start justify-between border-b border-dashed border-line pb-4">
          <div>
            <h1 className="text-lg font-bold text-ink">{shop?.shop_name || 'บิลสั่งซื้อสินค้า'}</h1>
            {shop?.shop_phone && <p className="text-xs text-ink-muted">โทร {shop.shop_phone}</p>}
            {shop?.shop_address && <p className="text-xs text-ink-muted">{shop.shop_address}</p>}
          </div>
          <div className="text-right text-xs text-ink-muted">
            <p>{formatDate(order.created_at)}</p>
            <p className="font-mono">#{order.id.slice(0, 8)}</p>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-muted">
              <th className="pb-2 font-medium">สินค้า</th>
              <th className="pb-2 text-center font-medium">จำนวน</th>
              <th className="pb-2 text-right font-medium">ราคา</th>
            </tr>
          </thead>
          <tbody>
            {order.order_items.map((it) => (
              <tr key={it.id} className="border-t border-line/70">
                <td className="py-2 pr-2 text-ink">{it.name}</td>
                <td className="py-2 text-center text-ink-muted">{it.quantity}</td>
                <td className="py-2 text-right text-ink">{formatCurrency(it.quantity * it.unit_price)} ฿</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 border-t border-line pt-3 text-sm">
          <div className="flex justify-between py-0.5 text-ink-muted">
            <span>ยอดรวมสินค้า</span>
            <span>{formatCurrency(subtotal)} ฿</span>
          </div>
          <div className="flex justify-between py-0.5 text-ink-muted">
            <span>ค่าจัดส่ง</span>
            <span>{formatCurrency(order.delivery_fee)} ฿</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-line pt-2 text-base font-bold text-ink">
            <span>ยอดสุทธิ</span>
            <span className="text-brand-700">{formatCurrency(total)} ฿</span>
          </div>
        </div>

        {(order.customer_name || order.customer_phone || order.delivery_address || order.note) && (
          <div className="mt-4 rounded-xl bg-surface-muted p-3 text-sm">
            <p className="mb-1 text-xs font-semibold text-ink-muted">ข้อมูลจัดส่ง</p>
            {order.customer_name && <p className="text-ink">{order.customer_name}</p>}
            {order.customer_phone && <p className="text-ink-muted">{order.customer_phone}</p>}
            {order.delivery_address && <p className="text-ink-muted">{order.delivery_address}</p>}
            {order.note && <p className="mt-1 text-ink-muted italic">หมายเหตุ: {order.note}</p>}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="no-print flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex-1 rounded-lg border border-line bg-surface py-2.5 text-sm font-semibold text-ink transition hover:bg-surface-muted"
          >
            พิมพ์บิล
          </button>
          <button
            onClick={() => void handleShare()}
            className="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            {copied ? 'คัดลอกแล้ว ✓' : 'แชร์ให้ไรเดอร์'}
          </button>
        </div>

        <div className="flex gap-2">
          {order.status !== 'ready' && (
            <button
              disabled={updating}
              onClick={() => void updateStatus('ready')}
              className="flex-1 rounded-lg border border-brand-200 bg-brand-50 py-2 text-xs font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-50"
            >
              ทำเครื่องหมายว่าพร้อมส่ง
            </button>
          )}
          {order.status !== 'delivered' && (
            <button
              disabled={updating}
              onClick={() => void updateStatus('delivered')}
              className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 py-2 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
            >
              จัดส่งสำเร็จแล้ว
            </button>
          )}
          <button
            disabled={updating}
            onClick={() => void deleteOrder()}
            className="rounded-lg border border-line px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
          >
            ลบ
          </button>
        </div>
      </div>
    </div>
  )
}
