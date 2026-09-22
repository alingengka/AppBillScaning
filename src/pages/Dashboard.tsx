import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency, formatDate, STATUS_LABEL, STATUS_STYLE } from '@/lib/format'
import Spinner from '@/components/Spinner'
import type { OrderWithItems } from '@/types'

export default function Dashboard() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (error) setError(error.message)
      else setOrders((data as OrderWithItems[]) ?? [])
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [user])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">ออเดอร์ของฉัน</h1>
          <p className="text-sm text-ink-muted">รายการบิลทั้งหมดที่สร้างจากการสแกนภาพ</p>
        </div>
        <Link
          to="/new"
          className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          + สแกนใหม่
        </Link>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

      {!loading && orders.length === 0 && !error && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line bg-surface py-16 text-center">
          <p className="text-sm text-ink-muted">ยังไม่มีออเดอร์ เริ่มสแกนภาพสินค้าชิ้นแรกของคุณ</p>
          <Link to="/new" className="mt-2 text-sm font-semibold text-brand-600 hover:text-brand-700">
            สแกนสินค้าใหม่ →
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {orders.map((order) => {
          const total =
            order.order_items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0) + (order.delivery_fee || 0)
          return (
            <Link
              key={order.id}
              to={`/orders/${order.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3.5 transition hover:border-brand-200 hover:shadow-sm"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-ink">
                    {order.customer_name || 'ลูกค้าไม่ระบุชื่อ'}
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[order.status]}`}>
                    {STATUS_LABEL[order.status]}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-ink-muted">
                  {order.order_items.length} รายการ • {formatDate(order.created_at)}
                </p>
              </div>
              <div className="shrink-0 text-right text-sm font-semibold text-brand-700">
                {formatCurrency(total)} ฿
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
