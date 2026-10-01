import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { addDays, formatCurrency, formatDateOnly, formatDayHeading, localDate, STATUS_LABEL, STATUS_STYLE } from '@/lib/format'
import Spinner from '@/components/Spinner'
import type { Order } from '@/types'

type RangeKey = 'today' | 'yesterday' | '7d' | '30d' | 'all' | 'custom'

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'วันนี้' },
  { key: 'yesterday', label: 'เมื่อวาน' },
  { key: '7d', label: '7 วัน' },
  { key: '30d', label: '30 วัน' },
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'custom', label: 'เลือกวันที่' },
]

/** The from/to order_date bounds (inclusive, YYYY-MM-DD) for a range; null = open-ended. */
function rangeBounds(range: RangeKey, customFrom: string, customTo: string): { from: string | null; to: string | null } {
  const today = localDate()
  switch (range) {
    case 'today':
      return { from: today, to: today }
    case 'yesterday':
      return { from: addDays(today, -1), to: addDays(today, -1) }
    case '7d':
      return { from: addDays(today, -6), to: today }
    case '30d':
      return { from: addDays(today, -29), to: today }
    case 'custom':
      return { from: customFrom || null, to: customTo || null }
    default:
      return { from: null, to: null }
  }
}

export default function Dashboard() {
  const { user } = useAuth()
  // The date filter lives in the URL so it survives opening a bill and coming back.
  const [searchParams, setSearchParams] = useSearchParams()
  const range = (searchParams.get('range') as RangeKey | null) ?? '7d'
  const customFrom = searchParams.get('from') ?? ''
  const customTo = searchParams.get('to') ?? ''
  const { from, to } = rangeBounds(range, customFrom, customTo)

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
      let query = supabase.from('orders').select('*')
      if (from) query = query.gte('order_date', from)
      if (to) query = query.lte('order_date', to)
      const { data, error } = await query
        .order('order_date', { ascending: false })
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (error) {
        setError(error.message)
      } else {
        setError(null)
        setOrders((data as Order[]) ?? [])
      }
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [user, from, to])

  function setRange(next: RangeKey) {
    const params: Record<string, string> = { range: next }
    if (next === 'custom') {
      // Start the custom range from whatever is showing now.
      params.from = customFrom || from || addDays(localDate(), -6)
      params.to = customTo || to || localDate()
    }
    setSearchParams(params, { replace: true })
  }

  function setCustomDate(key: 'from' | 'to', value: string) {
    setSearchParams({ range: 'custom', from: customFrom, to: customTo, [key]: value }, { replace: true })
  }

  // Totals for the range; cancelled orders don't count toward sales.
  const summary = useMemo(() => {
    const active = orders.filter((o) => o.status !== 'cancelled')
    return {
      count: active.length,
      total: active.reduce((sum, o) => sum + o.total_amount, 0),
      bags: active.reduce((sum, o) => sum + o.paid_qty + o.free_qty, 0),
      pending: orders.filter((o) => o.status === 'draft' || o.status === 'ready').length,
    }
  }, [orders])

  // Orders grouped by day (already sorted newest day first).
  const days = useMemo(() => {
    const groups = new Map<string, Order[]>()
    for (const order of orders) {
      const day = order.order_date.slice(0, 10)
      groups.set(day, [...(groups.get(day) ?? []), order])
    }
    return [...groups.entries()].map(([day, dayOrders]) => ({
      day,
      orders: dayOrders,
      total: dayOrders.filter((o) => o.status !== 'cancelled').reduce((sum, o) => sum + o.total_amount, 0),
    }))
  }, [orders])

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

      {/* Date range */}
      <div className="flex flex-col gap-2">
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setRange(option.key)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                range === option.key
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-line bg-surface text-ink hover:border-brand-300 hover:bg-brand-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="flex items-center gap-2 text-sm">
            <input
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => setCustomDate('from', e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <span className="text-ink-muted">ถึง</span>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => setCustomDate('to', e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
        )}
      </div>

      {/* Summary for the range */}
      {!loading && !error && (
        <div className="grid grid-cols-4 gap-2">
          <SummaryTile label="ออเดอร์" value={summary.count.toLocaleString('lo-LA')} />
          <SummaryTile className="col-span-2" label="ยอดขาย (KIP)" value={summary.total.toLocaleString('lo-LA')} />
          <SummaryTile label="รอส่ง" value={summary.pending.toLocaleString('lo-LA')} />
        </div>
      )}

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
          <p className="text-sm text-ink-muted">
            {range === 'all' ? 'ยังไม่มีออเดอร์ เริ่มเพิ่มออเดอร์แรกของคุณ' : 'ไม่มีออเดอร์ในช่วงวันที่นี้'}
          </p>
          <Link to="/new" className="mt-2 text-sm font-semibold text-brand-600 hover:text-brand-700">
            เพิ่มออเดอร์ใหม่ →
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {days.map((day) => (
          <section key={day.day} className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between gap-2 px-1">
              <h2 className="text-sm font-semibold text-ink">{formatDayHeading(day.day)}</h2>
              <p className="text-xs text-ink-muted">
                {day.orders.length} ออเดอร์ · {formatCurrency(day.total)}
              </p>
            </div>
            {day.orders.map((order) =>
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
          </section>
        ))}
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
          {order.paid_qty} แถม {order.free_qty} • {formatDateOnly(order.order_date)}
        </p>
      </div>
      <div className="shrink-0 text-right text-sm font-semibold text-brand-700">
        {formatCurrency(order.total_amount)}
      </div>
    </div>
  )
}

function SummaryTile({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={`min-w-0 rounded-xl border border-line bg-surface px-3 py-2.5 ${className}`}>
      <p className="text-[11px] text-ink-muted">{label}</p>
      <p className="truncate text-base font-semibold text-ink">{value}</p>
    </div>
  )
}
