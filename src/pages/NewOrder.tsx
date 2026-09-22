import { useRef, useState, type ChangeEvent, type ClipboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { smartScanOrder } from '@/lib/smartScan'
import { formatCurrency } from '@/lib/format'
import Spinner from '@/components/Spinner'

const COMBO_PRESETS = [
  { label: '1 แถม 1', paid: 1, free: 1, total: 280000 },
  { label: '2 แถม 2', paid: 2, free: 2, total: 550000 },
  { label: '3 แถม 3', paid: 3, free: 3, total: 800000 },
  { label: '5 แถม 5', paid: 5, free: 5, total: 1200000 },
  { label: '10 แถม 10', paid: 10, free: 10, total: 2200000 },
] as const

const SCAN_CONCURRENCY = 3
const SAVE_CONCURRENCY = 3

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

interface Draft {
  id: string
  file: File
  preview: string
  status: 'scanning' | 'scanned' | 'error'
  scanError: string | null
  customerName: string
  customerPhone: string
  orderDate: string
  paidQty: number
  freeQty: number
  totalAmount: number
  billNumber: string
  destination: string
  note: string
}

function newDraft(file: File): Draft {
  return {
    id: crypto.randomUUID(),
    file,
    preview: URL.createObjectURL(file),
    status: 'scanning',
    scanError: null,
    customerName: '',
    customerPhone: '',
    orderDate: today(),
    paidQty: 1,
    freeQty: 1,
    totalAmount: 0,
    billNumber: '',
    destination: '',
    note: '',
  }
}

async function mapWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let index = 0
  async function worker() {
    while (index < items.length) {
      const item = items[index++]
      await fn(item)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

export default function NewOrder() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [drafts, setDrafts] = useState<Draft[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedCount, setSavedCount] = useState(0)

  function patchDraft(id: string, patch: Partial<Draft> | ((d: Draft) => Partial<Draft>)) {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...(typeof patch === 'function' ? patch(d) : patch) } : d)),
    )
  }

  function removeDraft(id: string) {
    setDrafts((prev) => {
      const target = prev.find((d) => d.id === id)
      if (target) URL.revokeObjectURL(target.preview)
      return prev.filter((d) => d.id !== id)
    })
  }

  async function scanDrafts(targets: Draft[]) {
    const combos = COMBO_PRESETS.map((p) => ({ paid: p.paid, free: p.free, total: p.total }))
    await mapWithConcurrency(targets, SCAN_CONCURRENCY, async (draft) => {
      try {
        const result = await smartScanOrder(draft.file, combos)
        patchDraft(draft.id, (d) => ({
          status: 'scanned',
          scanError: null,
          customerName: result.customer_name ?? d.customerName,
          customerPhone: result.customer_phone ?? d.customerPhone,
          paidQty: result.paid_qty ?? d.paidQty,
          freeQty: result.free_qty ?? d.freeQty,
          totalAmount: result.total_amount ?? d.totalAmount,
          note: result.note ? (d.note ? `${d.note}\n${result.note}` : result.note) : d.note,
        }))
      } catch (err) {
        patchDraft(draft.id, {
          status: 'error',
          scanError: err instanceof Error ? err.message : 'สแกนภาพไม่สำเร็จ',
        })
      }
    })
  }

  function addFiles(files: File[]) {
    if (files.length === 0) return
    const created = files.map(newDraft)
    setDrafts((prev) => [...prev, ...created])
    void scanDrafts(created)
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(e.target.files ?? []))
    e.target.value = ''
  }

  function handlePaste(e: ClipboardEvent<HTMLDivElement>) {
    const files = [...e.clipboardData.items]
      .filter((i) => i.type.startsWith('image/'))
      .map((i) => i.getAsFile())
      .filter((f): f is File => f !== null)
    addFiles(files)
  }

  function retryScan(draft: Draft) {
    patchDraft(draft.id, { status: 'scanning', scanError: null })
    void scanDrafts([draft])
  }

  function applyPreset(id: string, preset: (typeof COMBO_PRESETS)[number]) {
    patchDraft(id, { paidQty: preset.paid, freeQty: preset.free, totalAmount: preset.total })
  }

  async function handleSaveAll(status: 'draft' | 'ready') {
    if (!user || drafts.length === 0) return

    const missingName = drafts.filter((d) => !d.customerName.trim())
    if (missingName.length > 0) {
      setSaveError(`กรุณากรอกชื่อลูกค้าให้ครบ (ขาดอยู่ ${missingName.length} รายการ — มีกรอบสีแดง)`)
      return
    }

    setSaving(true)
    setSaveError(null)
    setSavedCount(0)
    const failed: Draft[] = []

    await mapWithConcurrency(drafts, SAVE_CONCURRENCY, async (draft) => {
      try {
        const path = `${user.id}/${Date.now()}-${draft.file.name.replace(/[^\w.-]/g, '_')}`
        const { error: uploadError } = await supabase.storage.from('screenshots').upload(path, draft.file)
        if (uploadError) throw uploadError

        const { error: orderError } = await supabase.from('orders').insert({
          user_id: user.id,
          customer_name: draft.customerName.trim(),
          customer_phone: draft.customerPhone || null,
          destination: draft.destination || null,
          note: draft.note || null,
          status,
          order_date: draft.orderDate,
          paid_qty: draft.paidQty,
          free_qty: draft.freeQty,
          total_amount: draft.totalAmount,
          bill_number: draft.billNumber || null,
          source_image_path: path,
        })
        if (orderError) throw orderError

        setSavedCount((n) => n + 1)
        URL.revokeObjectURL(draft.preview)
      } catch (err) {
        failed.push(draft)
        patchDraft(draft.id, { scanError: err instanceof Error ? err.message : 'บันทึกออเดอร์นี้ไม่สำเร็จ' })
      }
    })

    setSaving(false)

    if (failed.length === 0) {
      navigate('/')
    } else {
      setDrafts(failed)
      setSaveError(`บันทึกสำเร็จบางส่วน เหลือ ${failed.length} รายการที่บันทึกไม่ผ่าน (ดู error ใต้แต่ละภาพ)`)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold text-ink">เพิ่มออเดอร์ใหม่</h1>
        <p className="text-sm text-ink-muted">
          แนบภาพแชทสั่งของได้หลายภาพพร้อมกัน — แต่ละภาพจะกลายเป็น 1 ออเดอร์ ให้ AI อ่านให้อัตโนมัติ
        </p>
      </div>

      {/* Add images */}
      <div
        onPaste={handlePaste}
        tabIndex={0}
        className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-brand-200 bg-surface p-5 text-center outline-none focus:border-brand-400"
      >
        <div className="flex flex-col items-center gap-2 py-2 text-ink-muted">
          <CameraIcon className="size-9 text-brand-400" />
          <p className="text-sm">เลือกได้หลายภาพพร้อมกัน ถ่ายรูป หรือวาง (Ctrl+V)</p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5 text-sm font-medium text-brand-700 transition hover:bg-brand-100"
        >
          เพิ่มภาพ
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Draft order cards */}
      {drafts.map((draft) => (
        <DraftCard
          key={draft.id}
          draft={draft}
          onPatch={(patch) => patchDraft(draft.id, patch)}
          onRemove={() => removeDraft(draft.id)}
          onRetryScan={() => retryScan(draft)}
          onApplyPreset={(preset) => applyPreset(draft.id, preset)}
        />
      ))}

      {saveError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{saveError}</p>}
      {saving && (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
          กำลังบันทึก... สำเร็จแล้ว {savedCount}/{drafts.length}
        </p>
      )}

      {drafts.length > 0 && (
        <div className="flex gap-2 pb-4">
          <button
            type="button"
            onClick={() => void handleSaveAll('draft')}
            disabled={saving}
            className="flex-1 rounded-lg border border-line bg-surface py-3 text-sm font-semibold text-ink transition hover:bg-surface-muted disabled:opacity-50"
          >
            บันทึกฉบับร่างทั้งหมด ({drafts.length})
          </button>
          <button
            type="button"
            onClick={() => void handleSaveAll('ready')}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {saving && <Spinner className="size-4 text-white" />}
            สร้างบิลทั้งหมด ({drafts.length})
          </button>
        </div>
      )}
    </div>
  )
}

function DraftCard({
  draft,
  onPatch,
  onRemove,
  onRetryScan,
  onApplyPreset,
}: {
  draft: Draft
  onPatch: (patch: Partial<Draft>) => void
  onRemove: () => void
  onRetryScan: () => void
  onApplyPreset: (preset: (typeof COMBO_PRESETS)[number]) => void
}) {
  const nameMissing = !draft.customerName.trim()

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-start gap-3">
        <img src={draft.preview} alt="ภาพแชท" className="size-16 shrink-0 rounded-lg border border-line object-cover" />
        <div className="min-w-0 flex-1">
          {draft.status === 'scanning' && (
            <p className="flex items-center gap-1.5 text-xs text-brand-600">
              <Spinner className="size-3.5" />
              กำลังให้ AI อ่านออเดอร์...
            </p>
          )}
          {draft.status === 'scanned' && !draft.scanError && (
            <p className="text-xs text-emerald-600">อ่านแล้ว ตรวจสอบข้อมูลก่อนบันทึก</p>
          )}
          {draft.scanError && (
            <div className="flex items-center gap-2">
              <p className="text-xs text-red-600">{draft.scanError}</p>
              <button
                type="button"
                onClick={onRetryScan}
                className="shrink-0 text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                ลองใหม่
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="เอาภาพนี้ออก"
          className="shrink-0 rounded-md p-1.5 text-ink-muted transition hover:bg-red-50 hover:text-red-600"
        >
          <TrashIcon className="size-4" />
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {COMBO_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onApplyPreset(preset)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
              draft.paidQty === preset.paid && draft.freeQty === preset.free && draft.totalAmount === preset.total
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
            value={draft.customerName}
            onChange={(e) => onPatch({ customerName: e.target.value })}
            className={`rounded-lg border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-100 ${
              nameMissing ? 'border-red-300 focus:border-red-400' : 'border-line focus:border-brand-500'
            }`}
          />
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1">
          <span className="font-medium text-ink">เบอร์โทร</span>
          <input
            value={draft.customerPhone}
            onChange={(e) => onPatch({ customerPhone: e.target.value })}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1">
          <span className="font-medium text-ink">วันที่</span>
          <input
            type="date"
            value={draft.orderDate}
            onChange={(e) => onPatch({ orderDate: e.target.value })}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">ชิ้นจ่ายเงิน</span>
          <input
            type="number"
            min={0}
            value={draft.paidQty}
            onChange={(e) => onPatch({ paidQty: Number(e.target.value) })}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">ชิ้นแถม</span>
          <input
            type="number"
            min={0}
            value={draft.freeQty}
            onChange={(e) => onPatch({ freeQty: Number(e.target.value) })}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">ยอดรวม (KIP)</span>
          <input
            type="number"
            min={0}
            value={draft.totalAmount}
            onChange={(e) => onPatch({ totalAmount: Number(e.target.value) })}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </label>

        <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1">
          <span className="font-medium text-ink">เลขบิล</span>
          <input
            value={draft.billNumber}
            onChange={(e) => onPatch({ billNumber: e.target.value })}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1">
          <span className="font-medium text-ink">ปลายทาง</span>
          <input
            value={draft.destination}
            onChange={(e) => onPatch({ destination: e.target.value })}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </label>

        <label className="col-span-2 flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">หมายเหตุ</span>
          <textarea
            value={draft.note}
            onChange={(e) => onPatch({ note: e.target.value })}
            rows={2}
            className="resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </label>
      </div>
    </div>
  )
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1-2h7l1 2h2A1.5 1.5 0 0 1 20 8.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V8.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-.7 12.1a1.5 1.5 0 0 1-1.5 1.4H8.2a1.5 1.5 0 0 1-1.5-1.4L6 7h12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
