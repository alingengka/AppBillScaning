import { formatCurrency } from '@/lib/format'
import { COMBO_PRESETS } from '@/lib/combos'
import type { OrderFormValues } from '@/lib/orderForm'
import type { PaymentMethod } from '@/types'

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cod', label: 'จ่าย COD' },
  { value: 'destination', label: 'ปลายทาง' },
  { value: 'origin', label: 'ต้นทาง' },
]

export default function OrderFields({
  values,
  onChange,
}: {
  values: OrderFormValues
  onChange: (patch: Partial<OrderFormValues>) => void
}) {
  const nameMissing = !values.customerName.trim()

  return (
    <>
    <div className="mb-3 flex flex-wrap gap-1.5">
      {COMBO_PRESETS.map((preset) => (
        <button
          key={preset.label}
          type="button"
          onClick={() => onChange({ paidQty: preset.paid, freeQty: preset.free, totalAmount: preset.total })}
          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
            values.paidQty === preset.paid && values.freeQty === preset.free && values.totalAmount === preset.total
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-line bg-surface text-ink hover:border-brand-300 hover:bg-brand-50'
          }`}
        >
          {preset.label} ({formatCurrency(preset.total)})
        </button>
      ))}
    </div>

    <div className="grid grid-cols-2 gap-2.5">
      <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1">
        <span className="font-medium text-ink">ชื่อลูกค้า *</span>
        <input
          value={values.customerName}
          onChange={(e) => onChange({ customerName: e.target.value })}
          className={`rounded-lg border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-100 ${
            nameMissing ? 'border-red-300 focus:border-red-400' : 'border-line focus:border-brand-500'
          }`}
        />
      </label>
      <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1">
        <span className="font-medium text-ink">เบอร์โทร</span>
        <input
          value={values.customerPhone}
          onChange={(e) => onChange({ customerPhone: e.target.value })}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </label>
      <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1">
        <span className="font-medium text-ink">วันที่</span>
        <input
          type="date"
          value={values.orderDate}
          onChange={(e) => onChange({ orderDate: e.target.value })}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">ชิ้นจ่ายเงิน</span>
        <input
          type="number"
          min={0}
          value={values.paidQty}
          onChange={(e) => onChange({ paidQty: Number(e.target.value) })}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">ชิ้นแถม</span>
        <input
          type="number"
          min={0}
          value={values.freeQty}
          onChange={(e) => onChange({ freeQty: Number(e.target.value) })}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </label>
      <label className="col-span-2 flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">ยอดรวม (KIP)</span>
        <input
          type="number"
          min={0}
          value={values.totalAmount}
          onChange={(e) => onChange({ totalAmount: Number(e.target.value) })}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </label>

      <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1">
        <span className="font-medium text-ink">เลขบิล</span>
        <input
          value={values.billNumber}
          onChange={(e) => onChange({ billNumber: e.target.value })}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </label>
      <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1">
        <span className="font-medium text-ink">ที่อยู่ลูกค้า</span>
        <input
          value={values.destination}
          onChange={(e) => onChange({ destination: e.target.value })}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </label>

      <div className="col-span-2 flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">เงื่อนไขชำระเงิน</span>
        <div className="flex flex-wrap gap-1.5">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => onChange({ paymentMethod: values.paymentMethod === m.value ? null : m.value })}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                values.paymentMethod === m.value
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-line bg-surface text-ink hover:border-brand-300 hover:bg-brand-50'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <label className="col-span-2 flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">หมายเหตุ</span>
        <textarea
          value={values.note}
          onChange={(e) => onChange({ note: e.target.value })}
          rows={2}
          className="resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </label>
    </div>
    </>
  )
}
