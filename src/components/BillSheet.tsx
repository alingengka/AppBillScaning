import type { CSSProperties, ReactNode } from 'react'
import { formatCurrency } from '@/lib/format'
import type { Order, PaymentMethod } from '@/types'

// Horizontal centre (as % of the template width) of each payment checkbox
// printed on bill-template.png.
const PAYMENT_CHECKBOX_LEFT: Record<PaymentMethod, number> = {
  cod: 17.3,
  destination: 43.7,
  origin: 71.6,
}

/**
 * Printable bill: the shop's own 150×150mm paper label template
 * (public/bill-template.png) used unchanged as the page, with the order's
 * data written onto its blank lines and checkboxes. Positions are
 * percentages of the template, so the screen preview and the printed page
 * line up identically.
 */
export default function BillSheet({ order }: { order: Order }) {
  return (
    <div className="print-bill relative aspect-square w-full overflow-hidden rounded-2xl border border-line bg-white shadow-sm [container-type:inline-size]">
      <img src="/bill-template.png" alt="" className="absolute inset-0 size-full select-none" draggable={false} />

      <div className="absolute inset-0 font-['Noto_Sans_Lao','Phetsarath_OT',sans-serif] text-black">
        <BillLine left={28.2} bottom={43.4} width={59.3}>
          {order.customer_name}
        </BillLine>
        <BillLine left={29.8} bottom={50.0} width={57.7}>
          {order.customer_phone}
        </BillLine>
        <p
          className="absolute line-clamp-2 break-words text-[3.2cqw] font-semibold leading-[5.08cqw]"
          style={{ left: '29.8%', top: '52.6%', width: '57.7%' }}
        >
          {order.destination}
        </p>

        {order.payment_method && (
          <CheckMark
            className="absolute size-[5.5%] -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${PAYMENT_CHECKBOX_LEFT[order.payment_method]}%`, top: '75.6%' }}
          />
        )}

        {/* Order summary in the blank strip under the payment box. */}
        <div
          className="absolute flex items-baseline justify-between gap-[2cqw]"
          style={{ left: '12%', right: '10%', top: '85%' }}
        >
          <p className="text-[3.4cqw] font-bold">
            ກາເຟ {order.paid_qty} ແຖມ {order.free_qty}
          </p>
          <p className="text-[3.8cqw] font-bold">{formatCurrency(order.total_amount)}</p>
        </div>
        <p className="absolute truncate text-[2.4cqw] text-neutral-700" style={{ left: '12%', right: '10%', top: '90.5%' }}>
          {[formatNumericDate(order.order_date), order.bill_number && `ບິນ ${order.bill_number}`, order.note]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
    </div>
  )
}

/** One line of text sitting on a dotted line of the template; `bottom` is the
 * dotted line's height as % from the top of the template. */
function BillLine({ left, bottom, width, children }: { left: number; bottom: number; width: number; children: ReactNode }) {
  return (
    <p
      className="absolute -translate-y-full truncate text-[3.2cqw] font-semibold leading-tight"
      style={{ left: `${left}%`, top: `${bottom}%`, width: `${width}%` }}
    >
      {children}
    </p>
  )
}

function CheckMark({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M4.5 12.5l5 5L19.5 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** "2026-10-01" → "01/10/2026": numeric, so it reads the same in Lao or Thai. */
function formatNumericDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}
