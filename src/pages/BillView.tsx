import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDateOnly, STATUS_LABEL, STATUS_STYLE } from '@/lib/format'
import Spinner from '@/components/Spinner'
import type { Order, OrderStatus, PaymentMethod, ShopSettings } from '@/types'

const PRINT_PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cod: '( จ่าย COD )',
  destination: '( ปลายทาง )',
  origin: '( ต้นทาง )',
}

export default function BillView() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()

  const [order, setOrder] = useState<Order | null>(null)
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
        supabase.from('orders').select('*').eq('id', orderId).single(),
        supabase.from('shop_settings').select('*').maybeSingle(),
      ])
      if (cancelled) return
      if (orderError) setError(orderError.message)
      else setOrder(orderData as Order)
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

  function billText(): string {
    if (!order) return ''
    const lines = [
      shop?.shop_name ?? 'บิลสั่งซื้อสินค้า',
      '—'.repeat(20),
      `กาแฟ ${order.paid_qty} แถม ${order.free_qty}`,
      `ยอดรวม: ${formatCurrency(order.total_amount)}`,
      '',
      order.bill_number ? `เลขบิล: ${order.bill_number}` : '',
      `ลูกค้า: ${order.customer_name || '-'}`,
      `โทร: ${order.customer_phone || '-'}`,
      `ปลายทาง: ${order.destination || '-'}`,
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

      {/* Printable bill, styled after the shop's paper label template:
          sender (shop) + thank-you header, customer-info box, order
          summary, payment-method checkboxes. */}
      <div className="print-bill rounded-2xl border border-line bg-surface p-5 shadow-sm print:border-0 print:shadow-none">
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-dashed border-line pb-4">
          <div className="text-sm">
            <p>
              <span className="font-semibold text-ink">ຜູ້ຝາກ</span>{' '}
              <span className="text-ink">{shop?.shop_name || 'บิลสั่งซื้อสินค้า'}</span>
            </p>
            {shop?.shop_phone && (
              <p>
                <span className="font-semibold text-ink">ເບີໂທ</span> <span className="text-ink">{shop.shop_phone}</span>
              </p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="font-['cursive'] text-lg italic text-ink">Thank you ♡</p>
            <p className="text-[9px] tracking-widest text-ink-muted">THANK YOU FOR YOUR SUPPORT</p>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-line">
          <div className="inline-block rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white">
            ຂໍ້ມູນລູກຄ້າ
          </div>
          <div className="flex flex-col gap-2.5 p-4 text-sm">
            <p className="flex items-center gap-2">
              <PersonIcon className="size-4 shrink-0 text-ink" />
              <span className="font-medium text-ink">ชื่อ:</span>
              <span className="text-ink">{order.customer_name || '-'}</span>
            </p>
            <p className="flex items-center gap-2">
              <PhoneIcon className="size-4 shrink-0 text-ink" />
              <span className="font-medium text-ink">เบอร์โทร:</span>
              <span className="text-ink">{order.customer_phone || '-'}</span>
            </p>
            <p className="flex items-center gap-2">
              <PinIcon className="size-4 shrink-0 text-ink" />
              <span className="font-medium text-ink">ที่อยู่:</span>
              <span className="text-ink">{order.destination || '-'}</span>
            </p>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between rounded-xl bg-surface-muted p-4">
          <div>
            <p className="text-base font-semibold text-ink">
              กาแฟ {order.paid_qty} แถม {order.free_qty}
            </p>
            <p className="text-xs text-ink-muted">
              จ่าย {order.paid_qty} ชิ้น + แถม {order.free_qty} ชิ้น
              {order.bill_number ? ` • เลขบิล ${order.bill_number}` : ''}
            </p>
            {order.note && <p className="mt-1 text-xs italic text-ink-muted">หมายเหตุ: {order.note}</p>}
          </div>
          <p className="shrink-0 text-lg font-bold text-brand-700">{formatCurrency(order.total_amount)}</p>
        </div>

        <div className="rounded-xl border border-line">
          <div className="inline-block rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white">
            ຂໍ້ງານຊຳລະເງີນ
          </div>
          <div className="flex flex-wrap items-center gap-3 p-4 text-sm">
            {(Object.keys(PRINT_PAYMENT_LABELS) as PaymentMethod[]).map((method) => (
              <span key={method} className="flex items-center gap-1.5">
                <span
                  className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                    order.payment_method === method ? 'border-ink bg-ink text-white' : 'border-line'
                  }`}
                >
                  {order.payment_method === method && '✓'}
                </span>
                <span className="text-ink">{PRINT_PAYMENT_LABELS[method]}</span>
              </span>
            ))}
          </div>
        </div>

        <p className="mt-3 text-right text-[10px] text-ink-muted">{formatDateOnly(order.order_date)}</p>
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

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 20c1-3.5 4-5.5 7-5.5s6 2 7 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M6.5 4h2.3l1.2 4-2 1.4a11 11 0 0 0 5.6 5.6l1.4-2 4 1.2v2.3c0 1-.8 1.8-1.8 1.7A16 16 0 0 1 4.8 5.8C4.7 4.8 5.5 4 6.5 4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 21s6.5-5.9 6.5-11A6.5 6.5 0 0 0 5.5 10c0 5.1 6.5 11 6.5 11Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}
