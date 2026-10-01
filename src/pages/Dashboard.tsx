import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency, formatDate, STATUS_LABEL, STATUS_STYLE } from '@/lib/format'
import Spinner from '@/components/Spinner'
import type { Order } from '@/types'

export default function Dashboard() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Print-all mode: tick orders, then print them all in one go.
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
      if (cancelled) return
      if (error) setError(error.message)
      else setOrders((data as Order[]) ?? [])
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [user])

  function startPrintAll() {
    // Preselect every order that still needs to go out.
    setSelected(new Set(orders.filter((o) => o.status === 'draft' || o.status === 'ready').map((o) => o.id)))
    setSelecting(true)
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function printSelected() {
    // Keep the on-screen list order (newest first) for the printed stack.
    const ids = orders.filter((o) => selected.has(o.id)).map((o) => o.id)
    navigate(`/print?ids=${ids.join(',')}`)
  }

  const allSelected = orders.length > 0 && selected.size === orders.length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-ink">ออเดอร์ของฉัน</h1>
          <p className="text-sm text-ink-muted">รายการบิลทั้งหมด</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {orders.length > 0 && !selecting && (
            <button
              onClick={startPrintAll}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface-muted"
            >
              พิมพ์ทั้งหมด
            </button>
          )}
          <Link
            to="/new"
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            + เพิ่มออเดอร์
          </Link>
        </div>
      </div>

      {selecting && (
        <div className="sticky top-16 z-10 flex flex-col gap-2 rounded-xl border border-brand-200 bg-brand-50 p-3">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-ink">
              เลือกแล้ว <span className="font-semibold">{selected.size}</span> ใบ
            </span>
            <button
              onClick={() => setSelected(allSelected ? new Set() : new Set(orders.map((o) => o.id)))}
              className="text-xs font-semibold text-brand-700"
            >
              {allSelected ? 'ไม่เลือกเลย' : 'เลือกทั้งหมด'}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSelecting(false)}
              className="flex-1 rounded-lg border border-line bg-surface py-2 text-sm font-medium text-ink transition hover:bg-surface-muted"
            >
              ยกเลิก
            </button>
            <button
              disabled={selected.size === 0}
              onClick={printSelected}
              className="flex-[2] rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              พิมพ์ {selected.size} ใบ
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

      {!loading && orders.length === 0 && !error && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line bg-surface py-16 text-center">
          <p className="text-sm text-ink-muted">ยังไม่มีออเดอร์ เริ่มเพิ่มออเดอร์แรกของคุณ</p>
          <Link to="/new" className="mt-2 text-sm font-semibold text-brand-600 hover:text-brand-700">
            เพิ่มออเดอร์ใหม่ →
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {orders.map((order) =>
          selecting ? (
            <label
              key={order.id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border bg-surface p-3.5 transition ${
                selected.has(order.id) ? 'border-brand-500 ring-2 ring-brand-100' : 'border-line'
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(order.id)}
                onChange={() => toggleSelected(order.id)}
                className="size-4 shrink-0 accent-brand-600"
              />
              <OrderSummary order={order} />
            </label>
          ) : (
            <Link
              key={order.id}
              to={`/orders/${order.id}`}
              className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3.5 transition hover:border-brand-200 hover:shadow-sm"
            >
              <OrderSummary order={order} />
            </Link>
          ),
        )}
      </div>
    </div>
  )
}

function OrderSummary({ order }: { order: Order }) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
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
          {order.paid_qty} แถม {order.free_qty} • {formatDate(order.created_at)}
        </p>
      </div>
      <div className="shrink-0 text-right text-sm font-semibold text-brand-700">
        {formatCurrency(order.total_amount)}
      </div>
    </div>
  )
}
