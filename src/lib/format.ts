const thb = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function formatCurrency(value: number): string {
  return thb.format(value)
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const STATUS_LABEL: Record<string, string> = {
  draft: 'ฉบับร่าง',
  ready: 'พร้อมส่ง',
  delivered: 'จัดส่งแล้ว',
  cancelled: 'ยกเลิก',
}

export const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  ready: 'bg-brand-100 text-brand-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-600',
}
