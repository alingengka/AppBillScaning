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

/** Today's date in the device's own time zone, as YYYY-MM-DD (not UTC, which
 * would still be "yesterday" before 7am in Laos). */
export function localDate(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Shifts a YYYY-MM-DD date by whole days. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return localDate(new Date(y, m - 1, d + days))
}

/** "2026-10-01" → "พฤ. 01 ต.ค. 2026", read as a local calendar day. */
export function formatDayHeading(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('th-TH', {
    weekday: 'short',
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
