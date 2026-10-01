import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import BillSheet from '@/components/BillSheet'
import Spinner from '@/components/Spinner'
import type { Order } from '@/types'

/** Prints several bills at once, one 150×150mm page per order: /print?ids=a,b,c */
export default function PrintBills() {
  const [searchParams] = useSearchParams()
  const idsParam = searchParams.get('ids') ?? ''

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ids = idsParam.split(',').filter(Boolean)
    let cancelled = false

    async function load() {
      setLoading(true)
      if (ids.length === 0) {
        setOrders([])
        setLoading(false)
        return
      }
      const { data, error } = await supabase.from('orders').select('*').in('id', ids)
      if (cancelled) return
      if (error) {
        setError(error.message)
      } else {
        // Keep the order the bills were picked in.
        const byId = new Map((data as Order[]).map((order) => [order.id, order]))
        setOrders(ids.map((id) => byId.get(id)).filter((order): order is Order => Boolean(order)))
      }
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [idsParam])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex items-center justify-between gap-3">
        <Link to="/" className="text-sm font-medium text-ink-muted hover:text-brand-600">
          ← ออเดอร์ทั้งหมด
        </Link>
        <span className="text-sm text-ink-muted">{orders.length} ใบ</span>
      </div>

      {error && <p className="no-print rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

      {orders.length === 0 && !error ? (
        <p className="no-print py-16 text-center text-sm text-ink-muted">ไม่มีบิลที่เลือกไว้</p>
      ) : (
        <>
          <button
            onClick={() => window.print()}
            className="no-print rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            พิมพ์ทั้งหมด ({orders.length} ใบ)
          </button>
          {orders.map((order) => (
            <BillSheet key={order.id} order={order} />
          ))}
        </>
      )}
    </div>
  )
}
