const kip = new Intl.NumberFormat('lo-LA', { maximumFractionDigits: 0 })

export function formatCurrency(value: number): string {
  return `${kip.format(value)} KIP`
}

export function formatDate(iso: string): string {
  // calendar: 'gregory' avoids the Thai locale's default Buddhist-era year,
  // which would show e.g. 2569 instead of 2026 and confuse Lao Kip records.
  return new Date(iso).toLocaleString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    calendar: 'gregory',
  })
}

export function formatDateOnly(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    calendar: 'gregory',
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
