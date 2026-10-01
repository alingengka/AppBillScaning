import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { formValuesToColumns, orderToFormValues, type OrderFormValues } from '@/lib/orderForm'
import OrderFields from '@/components/OrderFields'
import BillSheet from '@/components/BillSheet'
import OpenSourceButton from '@/components/BillWithSource'
import Spinner from '@/components/Spinner'
import type { Order } from '@/types'

/** Fix a saved order's details (e.g. something the AI misread) after the fact. */
export default function EditOrder() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()

  const [order, setOrder] = useState<Order | null>(null)
  const [values, setValues] = useState<OrderFormValues | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orderId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data, error } = await supabase.from('orders').select('*').eq('id', orderId).single()
      if (cancelled) return
      if (error) {
        setError(error.message)
      } else {
        setOrder(data as Order)
        setValues(orderToFormValues(data as Order))
      }
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [orderId])

  async function handleSave() {
    if (!order || !values) return
    if (!values.customerName.trim()) {
      setError('กรุณากรอกชื่อลูกค้า')
      return
    }
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('orders').update(formValuesToColumns(values)).eq('id', order.id)
    setSaving(false)
    if (error) setError(error.message)
    else navigate(`/orders/${order.id}`)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }

  if (!order || !values) {
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
      <div className="flex items-center justify-between">
        <Link to={`/orders/${order.id}`} className="text-sm font-medium text-ink-muted hover:text-brand-600">
          ← กลับไปที่บิล
        </Link>
        <h1 className="text-sm font-semibold text-ink">แก้ไขออเดอร์</h1>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-4">
        <OrderFields values={values} onChange={(patch) => setValues({ ...values, ...patch })} />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-ink-muted">ตัวอย่างบิลหลังแก้ไข</p>
        <BillSheet order={{ ...order, ...formValuesToColumns(values) }} />
        <OpenSourceButton order={order} className="self-start" />
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Link
          to={`/orders/${order.id}`}
          className="flex-1 rounded-lg border border-line bg-surface py-2.5 text-center text-sm font-semibold text-ink transition hover:bg-surface-muted"
        >
          ยกเลิก
        </Link>
        <button
          disabled={saving}
          onClick={() => void handleSave()}
          className="flex-[2] rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
        </button>
      </div>
    </div>
  )
}
